"""Structured replacement requests match the existing fail-closed protocol."""

import copy
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import httpx
import pytest

from app.services.aircraft_library.models import (
    ANSWER_SCHEMA,
    Models,
    ModelUnavailable,
    verified_completion,
)

EVIDENCE = [{
    "passage_id": 1, "document_id": "doc_correction", "page": 1, "label": "1",
    "method": "text", "metadata": {"icao": "C182"},
    "text": "Power limit is 100 hp. Fuel capacity is 20 gallons.",
}]


def claim(text):
    return {"text": text, "citations": [{"passage_id": 1, "excerpt_id": 0}]}


def response(claims):
    value = {"insufficient_evidence": False, "reason": "", "claims": claims}
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(value)}}]})


def model(handler, output="json_schema"):
    return Models({
        "AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://models.example/v1",
        "AIRCRAFT_LIBRARY_LLM_MODEL": "structured-fixture",
        "AIRCRAFT_LIBRARY_LLM_RESPONSE_FORMAT": output,
    }, transport=httpx.MockTransport(handler))


def properties(payload):
    return payload["response_format"]["json_schema"]["schema"]["properties"]


@pytest.mark.parametrize("count", [1, 3, 12])
def test_only_rejected_positions_get_exact_structured_replacement_count(count):
    requests = []
    retained = [claim("Fuel capacity is 20 gallons.")] if count < 12 else []

    def provider(request):
        payload = json.loads(request.content)
        requests.append(payload)
        shape = properties(payload)
        if len(requests) == 2:
            assert shape["claims"]["minItems"] == shape["claims"]["maxItems"] == count
            assert shape["insufficient_evidence"] == {"type": "boolean", "enum": [False]}
            return response([claim("Power limit is 100 hp.")] * count)
        assert shape["claims"]["maxItems"] == 12
        assert "minItems" not in shape["claims"]
        assert shape["insufficient_evidence"] == {"type": "boolean"}
        if len(requests) == 1:
            return response([claim("Power limit is 999 hp.")] * count + retained)
        return response(retained or [claim("Power limit is 100 hp.")])

    before = copy.deepcopy(ANSWER_SCHEMA)
    models = model(provider)
    options = copy.deepcopy(models.generation_options)
    accepted = verified_completion(models, EVIDENCE, "Summarize", max_attempts=2)
    assert len(accepted["claims"]) == count + len(retained)
    if retained:
        assert accepted["claims"][-1]["text"] == retained[0]["text"]
    models.complete(EVIDENCE, "A later ordinary request")
    assert len(requests) == 3
    assert models.generation_options == options
    assert ANSWER_SCHEMA == before


@pytest.mark.parametrize("bad_shape", [True, False])
def test_exact_schema_never_replaces_actual_cardinality_or_source_validation(bad_shape):
    calls = []

    def provider(request):
        payload = json.loads(request.content)
        calls.append(payload)
        if len(calls) == 1:
            return response([claim("Power limit is 999 hp.")])
        assert properties(payload)["claims"]["maxItems"] == 1
        return response([claim("Power limit is 100 hp.")] * 2 if bad_shape else [claim("Power limit is 999 hp.")])

    with pytest.raises(ModelUnavailable, match="replace all 1" if bad_shape else "numeric values"):
        verified_completion(model(provider), EVIDENCE, "Summarize", max_attempts=2)
    assert len(calls) == 2


def test_plain_json_correction_keeps_existing_wire_format():
    calls = []

    def provider(request):
        payload = json.loads(request.content)
        calls.append(payload)
        assert payload["response_format"] == {"type": "json_object"}
        return response([claim("Power limit is 999 hp." if len(calls) == 1 else "Power limit is 100 hp.")])

    result = verified_completion(model(provider, "json_object"), EVIDENCE, "Summarize", max_attempts=2)
    assert result["claims"][0]["text"] == "Power limit is 100 hp."
    assert len(calls) == 2


@pytest.mark.parametrize("adapter_error", [False, True])
def test_legacy_two_argument_adapter_is_not_reinvoked_after_an_internal_type_error(adapter_error):
    calls = []
    models = model(lambda request: pytest.fail("Legacy adapter bypassed"))

    def legacy(evidence, question):
        calls.append(question)
        if len(calls) == 1:
            text = "Power limit is 999 hp."
        elif adapter_error:
            raise TypeError("Adapter failed after starting its request")
        else:
            text = "Power limit is 100 hp."
        return {"insufficient_evidence": False, "claims": [claim(text)]}

    models.complete = legacy
    if adapter_error:
        with pytest.raises(TypeError, match="Adapter failed"):
            verified_completion(models, EVIDENCE, "Summarize")
    else:
        assert verified_completion(models, EVIDENCE, "Summarize")["claims"]
    assert len(calls) == 2


def test_concurrent_corrections_do_not_change_each_other_or_initial_requests():
    barrier = Barrier(3)
    seen = []

    def provider(request):
        payload = json.loads(request.content)
        question = json.loads(payload["messages"][1]["content"])["question"]
        shape = properties(payload)
        count = int(question) if question != "normal" else None
        assert shape["claims"].get("minItems") == count
        assert shape["claims"]["maxItems"] == (count or 12)
        assert shape["insufficient_evidence"].get("enum") == ([False] if count else None)
        seen.append(question)
        barrier.wait(timeout=5)
        return response([claim("Power limit is 100 hp.")] * (count or 1))

    models = model(provider)
    before = copy.deepcopy(models.generation_options)
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(models.complete_replacements, EVIDENCE, str(n), n) for n in (1, 3)]
        futures.append(pool.submit(models.complete, EVIDENCE, "normal"))
        assert [len(f.result()["claims"]) for f in futures] == [1, 3, 1]
    assert sorted(seen) == ["1", "3", "normal"]
    assert models.generation_options == before


@pytest.mark.parametrize("count", [True, False, 0, 13, "1"])
def test_invalid_replacement_count_never_reaches_provider(count):
    def provider(request):
        pytest.fail("Invalid replacement request reached provider")

    with pytest.raises(ValueError, match="one to twelve"):
        model(provider).complete_replacements(EVIDENCE, "Summarize", count)


# The retained provider failure cited a complete example placard but discarded
# its equipment and original-certificate conditions. These are functional,
# non-aircraft-specific controls; private actual wires remain outside the tree.
CONDITIONAL_OPERATIONS = {
    'passage_id': 2, 'document_id': 'doc_correction', 'page': 2, 'label': '2',
    'method': 'text', 'metadata': {'scope': 'type'},
    'text': ('The DAY-NIGHT-VFR-IFR entry shown in this example varies as the airplane is equipped. '
             'This airplane is certified for DAY-NIGHT-VFR-IFR operations as of the date of '
             'the original airworthiness certificate. No aerobatic maneuvers are approved.'),
}
UNQUALIFIED_CERTIFICATION = 'The airplane is certified for DAY-NIGHT-VFR-IFR operations.'
QUALIFIED_CERTIFICATION = (
    'The manual shows an example DAY-NIGHT-VFR-IFR entry that varies as the airplane is equipped; '
    'its certification statement is as of the date of the original airworthiness certificate.'
)


def operation_claim(text):
    return {'text': text, 'citations': [{'passage_id': 2, 'excerpt_id': 0}]}


def operation_answer(text):
    return {'insufficient_evidence': False, 'claims': [operation_claim(text)]}


def test_equipment_dependent_historical_certification_cannot_lose_conditions():
    from app.services.aircraft_library.models import validate_answer
    with pytest.raises(ModelUnavailable, match='applicability conditions') as failure:
        validate_answer(operation_answer(UNQUALIFIED_CERTIFICATION), [CONDITIONAL_OPERATIONS])
    assert failure.value.feedback['applicability_requirements'] == {
        'flight_operations': ['day', 'ifr', 'night', 'vfr'],
        'conditions': ['equipment_dependent_example', 'original_certificate_date'],
    }
    assert CONDITIONAL_OPERATIONS['text'] not in str(failure.value)


@pytest.mark.parametrize('text', [
    QUALIFIED_CERTIFICATION,
    'The example DAY-NIGHT-VFR-IFR entry depends on installed equipment; certification is as of the original airworthiness certificate issuance.',
    'No aerobatic maneuvers, including spins, are approved.',
    'Night IFR operations are not approved.',
    'The airplane is not certified for night IFR operations.',
])
def test_example_reporting_and_explicit_prohibitions_do_not_assert_current_approval(text):
    from app.services.aircraft_library.models import validate_answer
    result = validate_answer(operation_answer(text), [CONDITIONAL_OPERATIONS])
    assert result['claims'][0]['text'] == text


@pytest.mark.parametrize('text', [
    'Placards state the airplane is certified for DAY-NIGHT-VFR-IFR operations.',
    'The airplane is approved for DAY-NIGHT-VFR-IFR operations; consult the manual.',
    'The example airplane is certified for DAY-NIGHT-VFR-IFR operations.',
    'The airplane is certified for DAY-NIGHT-VFR-IFR operations as equipped.',
    'The example entry varies as equipped; the airplane is certified for DAY-NIGHT-VFR-IFR operations.',
])
def test_generic_disclaimer_or_one_qualification_does_not_replace_all_source_conditions(text):
    from app.services.aircraft_library.models import validate_answer
    with pytest.raises(ModelUnavailable, match='applicability conditions'):
        validate_answer(operation_answer(text), [CONDITIONAL_OPERATIONS])


def test_unconditional_statement_does_not_borrow_other_page_or_document_conditions():
    from app.services.aircraft_library.models import validate_answer
    source = {**CONDITIONAL_OPERATIONS, 'text': UNQUALIFIED_CERTIFICATION}
    for other in [
        {**CONDITIONAL_OPERATIONS, 'passage_id': 3, 'page': 3},
        {**CONDITIONAL_OPERATIONS, 'passage_id': 3, 'document_id': 'other'},
    ]:
        assert validate_answer(operation_answer(UNQUALIFIED_CERTIFICATION), [source, other])['claims']
    source['text'] += ' A fuel-pump example varies with installed equipment.'
    assert validate_answer(operation_answer(UNQUALIFIED_CERTIFICATION), [source])['claims']


def test_selecting_shorter_excerpt_cannot_hide_available_same_page_conditions():
    from app.services.aircraft_library.models import validate_answer, source_excerpts
    source = {**CONDITIONAL_OPERATIONS, 'text': UNQUALIFIED_CERTIFICATION}
    context = {**CONDITIONAL_OPERATIONS, 'passage_id': 3}
    assert source_excerpts(source)
    with pytest.raises(ModelUnavailable, match='applicability conditions'):
        validate_answer(operation_answer(UNQUALIFIED_CERTIFICATION), [source, context])


@pytest.mark.parametrize('policy', [
    'numeric-citation-only-v1', 'rejected-assertion-repair-v2',
    'signed-source-feedback-v3', 'signed-source-feedback-v4',
])
def test_predecessor_policy_reconstructs_original_conditional_claim_behavior(policy):
    requests = []
    def provider(request):
        requests.append(json.loads(request.content))
        return response([operation_claim(UNQUALIFIED_CERTIFICATION)])
    accepted = verified_completion(model(provider), [CONDITIONAL_OPERATIONS], 'Summarize',
                                   correction_policy=policy)
    assert accepted['claims'][0]['text'] == UNQUALIFIED_CERTIFICATION
    assert len(requests) == 1


def test_bounded_condition_repair_preserves_accepted_claim_and_failed_operating_entry():
    requests = []
    retained = claim('Power limit is 100 hp.')
    evidence = EVIDENCE + [CONDITIONAL_OPERATIONS]
    def provider(request):
        payload = json.loads(request.content)
        requests.append(payload)
        if len(requests) == 1:
            return response([retained, operation_claim(UNQUALIFIED_CERTIFICATION)])
        feedback = json.loads(payload['messages'][1]['content'])['question']
        assert 'applicability_requirements' in feedback
        assert 'equipment_dependent_example' in feedback
        assert 'original_certificate_date' in feedback
        assert 'Power limit is 100 hp.' not in feedback
        assert properties(payload)['claims']['maxItems'] == 1
        if len(requests) == 2:
            return response([operation_claim('No aerobatic maneuvers are approved.')])
        return response([operation_claim(QUALIFIED_CERTIFICATION)])
    result = verified_completion(model(provider), evidence, 'Summarize')
    assert len(requests) == 3
    assert [c['text'] for c in result['claims']] == [retained['text'], QUALIFIED_CERTIFICATION]


@pytest.mark.parametrize('replacement', [
    'No aerobatic maneuvers are approved.',
    'The manual shows an example VFR entry that varies as equipped, as of the original airworthiness certificate.',
    'The manual shows DAY-NIGHT-VFR-IFR operations; check the source before use.',
])
def test_topic_or_operating_label_dropping_cannot_launder_condition_failure(replacement):
    calls = []
    def provider(request):
        calls.append(json.loads(request.content))
        return response([operation_claim(UNQUALIFIED_CERTIFICATION if len(calls) == 1 else replacement)])
    with pytest.raises(ModelUnavailable, match='applicability conditions'):
        verified_completion(model(provider), [CONDITIONAL_OPERATIONS], 'Summarize')
    assert len(calls) == 3


@pytest.mark.parametrize('text', [
    'The example DAY-NIGHT-VFR-IFR entry does not vary as equipped; certification is as of the original airworthiness certificate issuance.',
    'There is no example DAY-NIGHT-VFR-IFR entry; it varies as equipped and certification is as of the original airworthiness certificate date.',
    'The example DAY-NIGHT-VFR-IFR entry varies as equipped, but certification is not as of the date of the original airworthiness certificate.',
])
def test_negated_qualification_cannot_satisfy_repair_obligations(text):
    calls = []
    def provider(request):
        calls.append(json.loads(request.content))
        return response([operation_claim(UNQUALIFIED_CERTIFICATION if len(calls) == 1 else text)])
    with pytest.raises(ModelUnavailable, match='applicability conditions'):
        verified_completion(model(provider), [CONDITIONAL_OPERATIONS], 'Summarize')
    assert len(calls) == 3


def test_conditional_job_failure_preserves_prefix_and_resumes_with_same_source(tmp_path):
    from app.services.aircraft_library.models import source_excerpts
    from app.services.aircraft_library.store import Store
    from app.services.aircraft_library.worker import Worker
    from .test_aircraft_library import manual
    from .test_aircraft_library_resume import Provider

    store = Store(tmp_path / 'library')
    raw = manual('General inspection notes. ' + 'Inspect engine controls before servicing. ' * 43,
                 CONDITIONAL_OPERATIONS['text'])
    doc = store.ingest(raw, {'icao': 'C172'})
    identifier = doc['id']
    before = copy.deepcopy(store.passages([identifier]))

    class ConditionalProvider(Provider):
        fail = True
        def complete(self, evidence, question):
            conditional = next((p for p in evidence if 'DAY-NIGHT' in p['text']), None)
            if conditional is None:
                return super().complete(evidence, question)
            self.calls.append([p['passage_id'] for p in evidence])
            text = UNQUALIFIED_CERTIFICATION if self.fail else QUALIFIED_CERTIFICATION
            assert source_excerpts(conditional)
            return {'insufficient_evidence': False, 'claims': [{
                'text': text, 'citations': [{'passage_id': conditional['passage_id'], 'excerpt_id': 0}],
            }]}

    provider = ConditionalProvider()
    worker = Worker(store, provider)
    try:
        job = store.create_job('distill', {'document_id': identifier})
        assert worker.run_one()
        failed = store.job(job['id'])
        assert failed['state'] == 'failed' and 'applicability conditions' in failed['error']
        assert CONDITIONAL_OPERATIONS['text'] not in failed['error']
        partial = copy.deepcopy(store.get(identifier)['artifacts']['distillation'])
        assert partial['status'] == 'partial' and partial['completed_batches'] == 1
        assert len(provider.calls) == 4  # one accepted scope, then three rejected candidates
        provider.calls.clear()
        provider.fail = False
        resumed = store.create_job('distill', {'document_id': identifier})
        assert worker.run_one()
        assert store.job(resumed['id'])['state'] == 'completed'
        final = store.get(identifier)['artifacts']['distillation']
        assert final['completed_batches'] == final['total_batches'] == 2
        assert final['sections'][:1] == partial['sections']
        assert final['evidence_identity'] == partial['evidence_identity']
        assert len(provider.calls) == 1
        assert store.passages([identifier]) == before
        assert (store.objects / (doc['sha256'] + '.pdf')).read_bytes() == raw
        assert store.job(job['id'])['state'] == 'failed'
    finally:
        worker.close()


def test_numeric_rejection_does_not_lose_conditional_operating_assertion_obligations():
    calls = []
    def provider(request):
        calls.append(json.loads(request.content))
        if len(calls) == 1:
            return response([operation_claim(UNQUALIFIED_CERTIFICATION + ' Fuel capacity is 999 gallons.')])
        if len(calls) == 2:
            return response([operation_claim('No aerobatic maneuvers are approved.')])
        return response([operation_claim(QUALIFIED_CERTIFICATION)])
    accepted = verified_completion(model(provider), [CONDITIONAL_OPERATIONS], 'Summarize')
    assert len(calls) == 3
    assert accepted['claims'][0]['text'] == QUALIFIED_CERTIFICATION


@pytest.mark.parametrize('text', [
    'No aerobatic maneuvers are approved, and the airplane is certified for DAY-NIGHT-VFR-IFR operations.',
    'No changes are needed, and this aircraft is authorized for DAY-NIGHT-VFR-IFR operations.',
    'The airplane has approval for DAY-NIGHT-VFR-IFR operations.',
    'The airplane holds current certification for DAY-NIGHT-VFR-IFR operations.',
    'The airplane carries authorization for DAY-NIGHT-VFR-IFR operations.',
])
def test_prohibition_in_another_clause_and_noun_authorizations_do_not_hide_positive_assertion(text):
    from app.services.aircraft_library.models import validate_answer
    with pytest.raises(ModelUnavailable, match='applicability conditions'):
        validate_answer(operation_answer(text), [CONDITIONAL_OPERATIONS])


@pytest.mark.parametrize('text', [
    'No night IFR operations, including training flights, are approved.',
    'The airplane is not certified and approved for night IFR operations.',
    'Neither day nor night IFR operations are approved.',
    "The airplane isn't certified for night IFR operations.",
    "The airplane isn’t certified for night IFR operations.",
    "The airplane can’t be approved for night IFR operations.",
    'The airplane cannot be approved for night IFR operations.',
])
def test_negative_authorizations_keep_their_own_negation_scope(text):
    from app.services.aircraft_library.models import validate_answer
    assert validate_answer(operation_answer(text), [CONDITIONAL_OPERATIONS])['claims'][0]['text'] == text


@pytest.mark.parametrize('form', ['can vary', 'varies', 'is varying'])
def test_equipment_example_forms_retain_both_supplied_qualifications(form):
    from app.services.aircraft_library.models import validate_answer
    text = ('The airplane is certified for DAY-NIGHT-VFR-IFR operations as of the date '
            'of the original airworthiness certificate; the example entry is shown '
            f'and {form} as the airplane is equipped.')
    assert validate_answer(operation_answer(text), [CONDITIONAL_OPERATIONS])['claims'][0]['text'] == text


@pytest.mark.parametrize('qualification', [
    'not varying', 'never varying', "isn't varying", 'isn’t varying', 'unvarying',
])
def test_negated_or_embedded_variation_cannot_satisfy_conditional_repair(qualification):
    calls = []
    text = ('The example DAY-NIGHT-VFR-IFR entry is ' + qualification + ' as equipped; '
            'certification is as of the original airworthiness certificate date.')
    def provider(request):
        calls.append(json.loads(request.content))
        return response([operation_claim(UNQUALIFIED_CERTIFICATION if len(calls) == 1 else text)])
    with pytest.raises(ModelUnavailable, match='applicability conditions'):
        verified_completion(model(provider), [CONDITIONAL_OPERATIONS], 'Summarize')
    assert len(calls) == 3


def test_varying_source_creates_equipment_obligation_without_changing_v5():
    from app.services.aircraft_library.models import validate_answer
    evidence = [{**CONDITIONAL_OPERATIONS,
                 'text': CONDITIONAL_OPERATIONS['text'].replace('varies', 'is varying')}]
    for policy, expected in [
        ('conditional-source-feedback-v5', ['original_certificate_date']),
        ('conditional-source-forms-v6', ['equipment_dependent_example', 'original_certificate_date']),
    ]:
        with pytest.raises(ModelUnavailable, match='applicability conditions') as failure:
            validate_answer(operation_answer(UNQUALIFIED_CERTIFICATION), evidence, correction_policy=policy)
        assert failure.value.feedback['applicability_requirements']['conditions'] == expected


@pytest.mark.parametrize('policy,accepted,calls_expected', [
    ('conditional-source-feedback-v5', False, 3),
    ('conditional-source-forms-v6', True, 2),
])
def test_bounded_variation_repair_preserves_original_claims_and_recorded_v5(policy, accepted, calls_expected):
    calls = []
    retained = claim('Power limit is 100 hp.')
    repaired = ('No aerobatic maneuvers are approved; and the airplane is certified for '
                'DAY-NIGHT-VFR-IFR operations as of date of original airworthiness certificate, '
                'with the example entry varying as the airplane is equipped.')
    def provider(request):
        calls.append(json.loads(request.content))
        if len(calls) == 1:
            return response([retained, operation_claim(UNQUALIFIED_CERTIFICATION)])
        return response([operation_claim(repaired)])
    def run():
        return verified_completion(model(provider), EVIDENCE + [CONDITIONAL_OPERATIONS],
                                   'Summarize', correction_policy=policy)
    if accepted:
        result = run()
        assert [c['text'] for c in result['claims']] == [retained['text'], repaired]
    else:
        with pytest.raises(ModelUnavailable, match='applicability conditions'):
            run()
    assert len(calls) == calls_expected


@pytest.mark.parametrize('kind,expected', [
    ('qualified', 'df344c9f4a1126dab290fce0431ab80e3231eccc4200d09d1b7ebb0a864411ad'),
    ('varying', 'e71443924757b80af315f48fb84e05280113b97bca6741f8642c45e99e6cf802'),
])
def test_recorded_v5_condition_repair_wires_remain_exact(kind, expected):
    import hashlib
    calls = []
    def provider(request):
        calls.append(json.loads(request.content))
        text = UNQUALIFIED_CERTIFICATION if len(calls) == 1 else QUALIFIED_CERTIFICATION
        if kind == 'varying':
            text = text.replace('varies', 'is varying')
        return response([operation_claim(text)])
    def run():
        return verified_completion(model(provider), [CONDITIONAL_OPERATIONS], 'Summarize',
                                   correction_policy='conditional-source-feedback-v5')
    if kind == 'varying':
        with pytest.raises(ModelUnavailable, match='applicability conditions'):
            run()
        assert len(calls) == 3
    else:
        assert run()['claims'][0]['text'] == QUALIFIED_CERTIFICATION
        assert len(calls) == 2
    assert hashlib.sha256(json.dumps(calls, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == expected
