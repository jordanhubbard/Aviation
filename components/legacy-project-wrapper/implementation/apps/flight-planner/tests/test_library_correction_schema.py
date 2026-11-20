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


DELIVERED_OPERATIONS = {
    'passage_id': 3, 'document_id': 'doc_correction', 'page': 3, 'label': '3',
    'method': 'text', 'metadata': {'scope': 'type'},
    'text': ('The airplane as delivered is equipped for DAY-NIGHT-VFR-IFR operations. '
             + 'General maintenance information is listed separately. ' * 30
             + 'Fuel capacity is 92 gallons.'),
}
EQUIPMENT_ASSERTION = 'The airplane is equipped for DAY-NIGHT-VFR-IFR operations.'
DELIVERED_ASSERTION = 'The airplane as delivered is equipped for DAY-NIGHT-VFR-IFR operations.'


def equipment_claim(text, *excerpts):
    return {'text': text, 'citations': [
        {'passage_id': 3, 'excerpt_id': i} for i in excerpts
    ]}


def test_equipment_statement_keeps_delivery_scope_and_selects_its_supporting_excerpt():
    from app.services.aircraft_library.models import validate_answer, source_excerpts
    last = len(source_excerpts(DELIVERED_OPERATIONS)) - 1
    for text, excerpts, missing in [
        (EQUIPMENT_ASSERTION, [last], 'as_delivered_scope'),
        (DELIVERED_ASSERTION, [last], 'as_delivered_equipment'),
    ]:
        with pytest.raises(ModelUnavailable, match='applicability conditions') as failure:
            validate_answer({'insufficient_evidence': False, 'claims': [equipment_claim(text, *excerpts)]},
                            [DELIVERED_OPERATIONS])
        feedback = failure.value.feedback
        if text == EQUIPMENT_ASSERTION:
            assert missing in feedback['missing_applicability_components']
        else:
            assert missing in feedback['missing_applicability_citation_conditions']
        option = feedback['qualification_excerpt_options'][0]
        assert option['passage_id'] == 3 and option['excerpt_id'] == 0
        assert option['text'] == source_excerpts(DELIVERED_OPERATIONS)[0]
    result = validate_answer({'insufficient_evidence': False,
                              'claims': [equipment_claim(DELIVERED_ASSERTION, 0)]},
                             [DELIVERED_OPERATIONS])
    assert result['claims'][0]['text'] == DELIVERED_ASSERTION


@pytest.mark.parametrize('text', [
    'The airplane is not equipped for night IFR operations.',
    'The airplane may be equipped for night IFR operations.',
    'The airplane could be equipped for night IFR operations.',
    'If equipped for night IFR operations, use the applicable equipment instructions.',
    'No night IFR equipment is installed.',
])
def test_negative_or_hypothetical_equipment_does_not_assert_a_current_configuration(text):
    from app.services.aircraft_library.models import validate_answer
    assert validate_answer({'insufficient_evidence': False, 'claims': [equipment_claim(text, 0)]},
                           [DELIVERED_OPERATIONS])['claims'][0]['text'] == text


@pytest.mark.parametrize('text', [
    EQUIPMENT_ASSERTION,
    'No spins are approved, and the airplane is equipped for DAY-NIGHT-VFR-IFR operations.',
    'The airplane has equipment for DAY-NIGHT-VFR-IFR operations.',
    'The airplane carries DAY-NIGHT-VFR-IFR equipment.',
])
def test_affirmative_equipment_and_independent_negation_cannot_hide_delivery_scope(text):
    from app.services.aircraft_library.models import validate_answer
    with pytest.raises(ModelUnavailable, match='applicability conditions'):
        validate_answer({'insufficient_evidence': False, 'claims': [equipment_claim(text, 0)]},
                        [DELIVERED_OPERATIONS])


def test_missing_example_component_is_identified_without_losing_other_qualifications():
    from app.services.aircraft_library.models import validate_answer
    text = ('The airplane is certified for DAY-NIGHT-VFR-IFR operations as of date of '
            'the original airworthiness certificate, with the entry varying as equipped.')
    with pytest.raises(ModelUnavailable) as failure:
        validate_answer(operation_answer(text), [CONDITIONAL_OPERATIONS])
    feedback = failure.value.feedback
    assert feedback['missing_applicability_components'] == ['example_scope']
    assert feedback['qualification_excerpt_options'][0]['text'] == CONDITIONAL_OPERATIONS['text']


def test_numeric_first_failure_retains_specific_scope_and_citation_feedback_and_keeps_accepted_claim():
    from app.services.aircraft_library.models import source_excerpts
    calls = []
    last = len(source_excerpts(DELIVERED_OPERATIONS)) - 1
    retained = claim('Power limit is 100 hp.')
    def provider(request):
        payload = json.loads(request.content); calls.append(payload)
        if len(calls) == 1:
            return response([retained, equipment_claim(EQUIPMENT_ASSERTION + ' Fuel capacity is 999 gallons.', last)])
        feedback = json.loads(json.loads(payload['messages'][1]['content'])['question'].split('\n')[-1])
        rejected = feedback['rejected_claims'][0]
        assert rejected['qualification_excerpt_options'][0]['excerpt_id'] == 0
        assert 'Power limit is 100 hp.' not in json.dumps(feedback)
        assert 'missing_applicability_components' in rejected or 'missing_applicability_citation_conditions' in rejected
        return response([equipment_claim(DELIVERED_ASSERTION + ' Fuel capacity is 92 gallons.',
                                         *([last] if len(calls) == 2 else [0, last]))])
    result = verified_completion(model(provider), EVIDENCE + [DELIVERED_OPERATIONS], 'Summarize')
    assert len(calls) == 3
    assert [c['text'] for c in result['claims']] == [retained['text'], DELIVERED_ASSERTION + ' Fuel capacity is 92 gallons.']


def test_qualification_options_are_bounded_and_never_borrow_unavailable_evidence():
    from app.services.aircraft_library.models import validate_answer
    from app.services.aircraft_library.source_limits import VerifiedSourceLimit
    fuel = {**DELIVERED_OPERATIONS, 'text': 'Fuel capacity is 92 gallons.'}
    hidden = {**DELIVERED_OPERATIONS, 'passage_id': 4,
              'source_limit': VerifiedSourceLimit(original_image_only=True)}
    for unrelated in [hidden,
                      {**DELIVERED_OPERATIONS, 'passage_id': 4, 'page': 4},
                      {**DELIVERED_OPERATIONS, 'passage_id': 4, 'document_id': 'other'}]:
        assert validate_answer({'insufficient_evidence': False,
                                'claims': [equipment_claim(EQUIPMENT_ASSERTION, 0)]},
                               [fuel, unrelated])['claims']
    many = [{**DELIVERED_OPERATIONS, 'passage_id': i} for i in range(3, 20)]
    with pytest.raises(ModelUnavailable) as failure:
        validate_answer({'insufficient_evidence': False, 'claims': [equipment_claim(EQUIPMENT_ASSERTION, 0)]}, many)
    options = failure.value.feedback['qualification_excerpt_options']
    assert len(options) == 6 and all(len(x['text']) <= 1200 for x in options)
    assert all(x['excerpt_id'] == 0 for x in options)


@pytest.mark.parametrize('replacement', [
    'The manual discusses as delivered equipment. The airplane is equipped for DAY-NIGHT-VFR-IFR operations.',
    'As delivered, the airplane is not equipped for DAY-NIGHT-VFR-IFR operations.',
    'As delivered, the airplane may be equipped for DAY-NIGHT-VFR-IFR operations.',
    'As delivered, the airplane is equipped for DAY-VFR; the airplane is equipped for NIGHT-IFR.',
    'As delivered, the airplane is equipped for DAY-NIGHT-VFR-IFR; the airplane is currently equipped for DAY-NIGHT-VFR-IFR.',
])
def test_unrelated_delivery_caveat_or_weakened_assertion_cannot_launder_repair(replacement):
    calls = []
    def provider(request):
        calls.append(json.loads(request.content))
        return response([equipment_claim(EQUIPMENT_ASSERTION if len(calls) == 1 else replacement, 0)])
    with pytest.raises(ModelUnavailable, match='applicability conditions'):
        verified_completion(model(provider), [DELIVERED_OPERATIONS], 'Summarize')
    assert len(calls) == 3


@pytest.mark.parametrize('kind,expected,calls_expected', [
    ('qualified', 'df344c9f4a1126dab290fce0431ab80e3231eccc4200d09d1b7ebb0a864411ad', 2),
    ('varying', 'df344c9f4a1126dab290fce0431ab80e3231eccc4200d09d1b7ebb0a864411ad', 2),
    ('missing_example', '97fb7c8e28d6e67bca52a7d613a24db0705ac0d0d01fee87be4ccd42415acc15', 3),
])
def test_recorded_v6_scope_wires_preserve_exact_requests_and_original_outcome(kind, expected, calls_expected):
    import hashlib
    calls = []
    def provider(request):
        calls.append(json.loads(request.content))
        text = UNQUALIFIED_CERTIFICATION if len(calls) == 1 else QUALIFIED_CERTIFICATION
        if len(calls) > 1 and kind == 'varying':
            text = text.replace('varies', 'is varying')
        if len(calls) > 1 and kind == 'missing_example':
            text = ('The airplane is certified for DAY-NIGHT-VFR-IFR operations as of date of '
                    'the original airworthiness certificate, with the entry varying as equipped.')
        return response([operation_claim(text)])
    def run():
        return verified_completion(model(provider), [CONDITIONAL_OPERATIONS], 'Summarize',
                                   correction_policy='conditional-source-forms-v6')
    if kind == 'missing_example':
        with pytest.raises(ModelUnavailable, match='applicability conditions'):
            run()
    else:
        assert run()['claims'][0]['text'] == QUALIFIED_CERTIFICATION.replace(
            'varies', 'is varying' if kind == 'varying' else 'varies')
    assert len(calls) == calls_expected
    assert hashlib.sha256(json.dumps(calls, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == expected


def test_recorded_v6_equipment_admission_is_preserved_without_becoming_new_policy_approval():
    from app.services.aircraft_library.models import validate_answer, source_excerpts
    last = len(source_excerpts(DELIVERED_OPERATIONS)) - 1
    candidate = {'insufficient_evidence': False, 'claims': [equipment_claim(EQUIPMENT_ASSERTION, last)]}
    assert validate_answer(candidate, [DELIVERED_OPERATIONS],
                           correction_policy='conditional-source-forms-v6')['claims'][0]['text'] == EQUIPMENT_ASSERTION
    with pytest.raises(ModelUnavailable, match='applicability conditions'):
        validate_answer(candidate, [DELIVERED_OPERATIONS])


def test_equipment_job_failure_preserves_scope_and_source_then_resumes_only_validated_prefix(tmp_path):
    from app.services.aircraft_library.models import source_excerpts
    from app.services.aircraft_library.store import Store
    from app.services.aircraft_library.worker import Worker
    from .test_aircraft_library import manual
    from .test_aircraft_library_resume import Provider
    store = Store(tmp_path / 'library')
    raw = manual('General inspection notes. ' + 'Inspect engine controls before servicing. ' * 43,
                 DELIVERED_OPERATIONS['text'])
    doc = store.ingest(raw, {'icao': 'C172'}); identifier = doc['id']
    before = copy.deepcopy(store.passages([identifier]))
    class EquipmentProvider(Provider):
        fail = True
        def complete(self, evidence, question):
            target = next((p for p in evidence if 'as delivered' in ' '.join(p['text'].split())), None)
            if target is None:
                return super().complete(evidence, question)
            self.calls.append([p['passage_id'] for p in evidence])
            excerpts = source_excerpts(target)
            return {'insufficient_evidence': False, 'claims': [{
                'text': EQUIPMENT_ASSERTION if self.fail else DELIVERED_ASSERTION,
                'citations': [{'passage_id': target['passage_id'],
                               'excerpt_id': len(excerpts) - 1 if self.fail else 0}],
            }]}
    provider = EquipmentProvider(); worker = Worker(store, provider)
    try:
        job = store.create_job('distill', {'document_id': identifier})
        assert worker.run_one()
        assert store.job(job['id'])['state'] == 'failed'
        assert 'applicability conditions' in store.job(job['id'])['error']
        partial = copy.deepcopy(store.get(identifier)['artifacts']['distillation'])
        completed = partial['completed_batches']
        assert completed > 0 and partial['total_batches'] - completed == 1
        assert len(provider.calls) == completed + 3
        provider.fail = False; provider.calls.clear()
        resumed = store.create_job('distill', {'document_id': identifier})
        assert worker.run_one() and store.job(resumed['id'])['state'] == 'completed'
        final = store.get(identifier)['artifacts']['distillation']
        assert final['completed_batches'] == final['total_batches'] == partial['total_batches']
        assert final['sections'][:completed] == partial['sections']
        assert final['evidence_identity'] == partial['evidence_identity'] and len(provider.calls) == 1
        assert store.passages([identifier]) == before
        assert (store.objects / (doc['sha256'] + '.pdf')).read_bytes() == raw
        assert store.job(job['id'])['state'] == 'failed'
    finally:
        worker.close()


# #583: these source/claim controls precede the changed validation implementation.
def procedure_source(text, *, identifier=1, document="doc_procedure", page=1):
    return {
        **EVIDENCE[0],
        "passage_id": identifier,
        "document_id": document,
        "page": page,
        "label": str(page),
        "text": text,
    }


def procedure_answer(text, *, citations=None):
    return {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [
            {
                "text": text,
                "citations": citations or [{"passage_id": 1, "excerpt_id": 0}],
            }
        ],
    }


WING_PHASE_SOURCE = (
    "WING FIRE\nLanding/Taxi Light Switches -- OFF.\nStrobe Light Switch -- OFF.\n"
    "Perform a sideslip to keep flames away from the fuel tank and cabin. "
    "Land as soon as possible using flaps only as required for final approach and touchdown."
)
REMEDIATION_SOURCE = (
    "Fire Damage -- INSPECT, repair damage or replace damaged components or wiring "
    "before conducting another flight."
)


@pytest.mark.parametrize(
    "text",
    [
        "Wing fire: use flaps only as required for final approach and touchdown.",
        "For wing fire, flaps may be used only as needed during final approach and touchdown.",
        "Wing fire: do not use flaps except as required for final approach and touchdown.",
    ],
)
def test_procedure_retains_action_bound_phase_with_selected_support(text):
    from app.services.aircraft_library.models import validate_answer

    accepted = validate_answer(procedure_answer(text), [procedure_source(WING_PHASE_SOURCE)])
    assert accepted["claims"][0]["text"] == text


@pytest.mark.parametrize(
    "text",
    [
        "Wing fire: land as soon as possible using flaps only as required.",
        "Wing fire: flaps may be used at any time as needed.",
        "Wing fire: flaps are not limited to final approach and touchdown.",
        "Wing fire: use flaps as needed. Normal landing: use flaps only for final approach and touchdown.",
        "Wing fire: use flaps as needed; use the strobe only for final approach and touchdown.",
    ],
)
def test_procedure_rejects_lost_negated_or_unrelated_phase(text):
    from app.services.aircraft_library.models import validate_answer

    with pytest.raises(ModelUnavailable, match="procedure"):
        validate_answer(procedure_answer(text), [procedure_source(WING_PHASE_SOURCE)])


def test_procedure_phase_requires_its_selected_neighboring_excerpt():
    from app.services.aircraft_library.models import citation_excerpts, validate_answer

    source = procedure_source(
        "CABIN FIRE\nClose the vents.\n"
        + "Background source words. " * 50
        + "\n"
        + WING_PHASE_SOURCE
    )
    excerpts = citation_excerpts(source["text"])
    assert "final approach and touchdown" not in excerpts[0]
    supporting = next(
        i for i, text in enumerate(excerpts) if "final approach and touchdown" in text
    )
    text = "Wing fire: use flaps only as required for final approach and touchdown."
    with pytest.raises(ModelUnavailable, match="procedure"):
        validate_answer(procedure_answer(text), [source])
    accepted = validate_answer(
        procedure_answer(
            text,
            citations=[
                {
                    "passage_id": 1,
                    "excerpt_id": supporting,
                }
            ],
        ),
        [source],
    )
    assert accepted["claims"][0]["text"] == text


def test_procedure_does_not_import_other_context_or_manual_phase():
    from app.services.aircraft_library.models import validate_answer

    local = procedure_source("WING FIRE\nUse the flaps as required.")
    foreign = procedure_source(WING_PHASE_SOURCE, identifier=2, document="doc_foreign")
    text = "Wing fire: use the flaps as required."
    assert validate_answer(procedure_answer(text), [local, foreign])["claims"][0]["text"] == text
    normal = procedure_source("NORMAL LANDING\nUse flaps as required.\n" + WING_PHASE_SOURCE)
    text = "Normal landing: use flaps as required."
    assert validate_answer(procedure_answer(text), [normal])["claims"][0]["text"] == text


@pytest.mark.parametrize(
    "text",
    [
        "Fire damage: inspect or repair before another flight.",
        "Inspect or repair fire damage before another flight.",
        "Before another flight, either inspect or replace damaged components.",
    ],
)
def test_procedure_inspection_cannot_substitute_for_required_remediation(text):
    from app.services.aircraft_library.models import validate_answer

    with pytest.raises(ModelUnavailable, match="procedure"):
        validate_answer(procedure_answer(text), [procedure_source(REMEDIATION_SOURCE)])


@pytest.mark.parametrize(
    "source,text",
    [
        (
            REMEDIATION_SOURCE,
            "Inspect fire damage, and repair damage or replace damaged components before another flight.",
        ),
        (REMEDIATION_SOURCE, "Inspect for fire damage."),
        ("Inspect or repair the cover as required.", "Inspect or repair the cover as required."),
    ],
)
def test_procedure_keeps_real_alternatives_and_supported_partial_summaries(source, text):
    from app.services.aircraft_library.models import validate_answer

    assert (
        validate_answer(procedure_answer(text), [procedure_source(source)])["claims"][0]["text"]
        == text
    )


def test_procedure_incombustible_mixture_requires_the_actual_quoted_support():
    from app.services.aircraft_library.models import citation_excerpts, validate_answer

    source = procedure_source(
        "ENGINE FIRE IN FLIGHT\nMixture -- IDLE CUT OFF.\n"
        + "Background source words. " * 50
        + "\nIncrease glide speed within airspeed limitations to provide an "
        "incombustible mixture. Forced Landing -- EXECUTE."
    )
    excerpts = citation_excerpts(source["text"])
    support = next(i for i, text in enumerate(excerpts) if "incombustible mixture" in text)
    text = "Engine fire in flight: increase glide speed within airspeed limitations for an incombustible mixture, then execute forced landing."
    with pytest.raises(ModelUnavailable, match="procedure"):
        validate_answer(procedure_answer(text), [source])
    citations = [{"passage_id": 1, "excerpt_id": 0}, {"passage_id": 1, "excerpt_id": support}]
    assert (
        validate_answer(procedure_answer(text, citations=citations), [source])["claims"][0]["text"]
        == text
    )


def test_procedure_fraction_cannot_borrow_separate_checklist_numerals():
    from app.services.aircraft_library.models import validate_answer

    steps = procedure_source("1. Turn the switch ON.\n4. Watch for ice on the wing.")
    fact = procedure_source(
        "With ice accumulation of 1/4 inch or more on wing leading edges, "
        "be prepared for significantly higher stall speed.",
        identifier=2,
    )
    text = "Ice accumulation of 1/4 inch or more on wing leading edges means significantly higher stall speed."
    with pytest.raises(ModelUnavailable, match="procedure"):
        validate_answer(procedure_answer(text), [steps, fact])
    citations = [{"passage_id": 2, "excerpt_id": 0}]
    assert (
        validate_answer(procedure_answer(text, citations=citations), [steps, fact])["claims"][0][
            "text"
        ]
        == text
    )


@pytest.mark.parametrize(
    "mode", ["faithful", "drop_topic", "drop_flaps", "negative", "reason_only", "foreign_manual"]
)
def test_procedure_local_correction_retains_topic_and_unaffected_claim(mode):
    evidence = [
        procedure_source(WING_PHASE_SOURCE),
        procedure_source("Fuel capacity is 20 gallons.", identifier=2),
        procedure_source(WING_PHASE_SOURCE, identifier=3, document="doc_foreign"),
    ]
    kept = {
        "text": "Fuel capacity is 20 gallons.",
        "citations": [{"passage_id": 2, "excerpt_id": 0}],
    }
    rejected = procedure_answer("Wing fire: use flaps as required.")["claims"][0]
    calls = []

    def provider(request):
        payload = json.loads(request.content)
        question = json.loads(payload["messages"][1]["content"])["question"]
        calls.append(question)
        if len(calls) == 1:
            return response([kept, rejected])
        packet = json.loads(question.rsplit("\n", 1)[-1])
        assert [row["claim_number"] for row in packet["rejected_claims"]] == [2]
        assert packet["rejected_claims"][0]["procedure_requirements"]
        text = {
            "faithful": "Wing fire: use flaps only as required for final approach and touchdown.",
            "drop_topic": "Use flaps only as required for final approach and touchdown.",
            "drop_flaps": "Wing fire: turn the strobe light switch off.",
            "negative": "Wing fire: flap use is not restricted to final approach and touchdown.",
            "reason_only": rejected["text"],
            "foreign_manual": "Wing fire: use flaps only as required for final approach and touchdown.",
        }[mode]
        citations = [{"passage_id": 3, "excerpt_id": 0}] if mode == "foreign_manual" else None
        result = response(procedure_answer(text, citations=citations)["claims"])
        if mode == "reason_only":
            value = result.json()
            content = json.loads(value["choices"][0]["message"]["content"])
            content["reason"] = "Flaps only as required for final approach and touchdown."
            value["choices"][0]["message"]["content"] = json.dumps(content)
            result = httpx.Response(200, json=value)
        return result

    if mode == "faithful":
        accepted = verified_completion(model(provider), evidence, "Summarize", max_attempts=2)
        assert accepted["claims"][0]["text"] == kept["text"]
        assert accepted["claims"][1]["text"].endswith("final approach and touchdown.")
    else:
        with pytest.raises(ModelUnavailable, match="procedure"):
            verified_completion(model(provider), evidence, "Summarize", max_attempts=2)
    assert len(calls) == 2


@pytest.mark.parametrize(
    "text",
    [
        "Wing fire: never use flaps only as required for final approach and touchdown.",
        "Wing fire: don't use flaps only as required for final approach and touchdown.",
        "Wing fire: never use wing flaps only as required for final approach and touchdown.",
        "Wing fire: don't only use flaps as required for final approach and touchdown.",
    ],
)
def test_procedure_negating_the_qualified_action_is_not_a_repair(text):
    from app.services.aircraft_library.models import validate_answer

    with pytest.raises(ModelUnavailable, match="procedure"):
        validate_answer(procedure_answer(text), [procedure_source(WING_PHASE_SOURCE)])


def test_procedure_only_before_action_is_a_faithful_phase_form():
    from app.services.aircraft_library.models import validate_answer

    text = "Wing fire: only use flaps as required for final approach and touchdown."
    assert (
        validate_answer(procedure_answer(text), [procedure_source(WING_PHASE_SOURCE)])["claims"][0][
            "text"
        ]
        == text
    )


def test_procedure_fraction_preserves_literal_unicode_and_does_not_parse_date_triples():
    from app.services.aircraft_library.models import validate_answer, _fraction_literals

    assert _fraction_literals("Revision 1/4/1997 remains printed.") == set()
    assert _fraction_literals("Use 1 / 4 inch or ¼ inch.") == {"1/4", "¼"}
    text = "Inspect with ¼ inch of ice present."
    assert (
        validate_answer(procedure_answer(text), [procedure_source(text)])["claims"][0]["text"]
        == text
    )
    with pytest.raises(ModelUnavailable, match="procedure"):
        validate_answer(procedure_answer(text), [procedure_source("Inspect with ice present.")])


def test_procedure_witnesses_are_bounded_and_only_from_supplied_citable_context():
    from app.services.aircraft_library.models import validate_answer, source_excerpts

    evidence = [procedure_source(WING_PHASE_SOURCE, identifier=i) for i in range(1, 14)]
    foreign = procedure_source(WING_PHASE_SOURCE, identifier=99, document="doc_foreign")
    other_page = procedure_source(WING_PHASE_SOURCE, identifier=100, page=2)
    with pytest.raises(ModelUnavailable, match="procedure") as caught:
        validate_answer(
            procedure_answer("Wing fire: use flaps as required."), [*evidence, foreign, other_page]
        )
    options = caught.value.feedback["procedure_excerpt_options"]
    assert len(options) == 6
    by_id = {row["passage_id"]: row for row in evidence}
    for option in options:
        assert option["passage_id"] not in {99, 100}
        assert option["text"] == source_excerpts(by_id[option["passage_id"]])[option["excerpt_id"]]
        assert len(option["text"]) <= 1200


@pytest.mark.parametrize(
    "policy",
    [
        "signed-source-feedback-v4",
        "conditional-source-feedback-v5",
        "conditional-source-forms-v6",
        "source-scope-feedback-v7",
    ],
)
def test_procedure_new_guard_preserves_explicit_recorded_predecessor_behavior(policy):
    from app.services.aircraft_library.models import validate_answer

    text = "Wing fire: use flaps as required."
    assert (
        validate_answer(
            procedure_answer(text), [procedure_source(WING_PHASE_SOURCE)], correction_policy=policy
        )["claims"][0]["text"]
        == text
    )


def test_procedure_unrelated_source_heading_does_not_supply_a_phase_condition():
    from app.services.aircraft_library.models import validate_answer

    source = procedure_source(
        "WING FIRE\nUse flaps as required.\n\nNORMAL OPERATIONS\n"
        "Use flaps only as required for final approach and touchdown."
    )
    text = "Wing fire: use flaps as required."
    assert validate_answer(procedure_answer(text), [source])["claims"][0]["text"] == text


def test_procedure_unrelated_labeled_assertion_does_not_qualify_flap_use():
    from app.services.aircraft_library.models import validate_answer

    text = (
        "Wing fire: use flaps as needed. Other operations: "
        "use flaps only as required for final approach and touchdown."
    )
    with pytest.raises(ModelUnavailable, match="procedure"):
        validate_answer(procedure_answer(text), [procedure_source(WING_PHASE_SOURCE)])


def test_procedure_failed_job_preserves_prefix_then_resumes_same_current_generation(tmp_path):
    from app.services.aircraft_library.models import CORRECTION_POLICY
    from app.services.aircraft_library.store import Store
    from app.services.aircraft_library.worker import Worker
    from .test_aircraft_library import manual
    from .test_aircraft_library_resume import Provider

    store = Store(tmp_path / "library")
    raw = manual(
        "General inspection notes. " + "Inspect engine controls before servicing. " * 45,
        WING_PHASE_SOURCE,
    )
    doc = store.ingest(raw, {"icao": "C172"})
    identifier = doc["id"]
    sources = copy.deepcopy(store.passages([identifier]))

    class ProcedureProvider(Provider):
        fail = True

        def complete(self, evidence, question):
            source = next((row for row in evidence if "WING FIRE" in row["text"]), None)
            if source is None:
                return super().complete(evidence, question)
            self.calls.append([row["passage_id"] for row in evidence])
            text = (
                "Wing fire: use flaps as required."
                if self.fail
                else "Wing fire: use flaps only as required for final approach and touchdown."
            )
            return procedure_answer(
                text,
                citations=[
                    {
                        "passage_id": source["passage_id"],
                        "excerpt_id": 0,
                    }
                ],
            )

    provider = ProcedureProvider()
    worker = Worker(store, provider)
    try:
        job = store.create_job("distill", {"document_id": identifier})
        assert worker.run_one()
        failed = store.job(job["id"])
        assert failed["state"] == "failed" and "procedure" in failed["error"]
        assert WING_PHASE_SOURCE not in failed["error"]
        partial = copy.deepcopy(store.get(identifier)["artifacts"]["distillation"])
        assert partial["completed_batches"] == 1 and partial["total_batches"] == 2
        assert partial["correction_policy"] == CORRECTION_POLICY == "flap-color-feedback-v12"
        assert len(provider.calls) == 4
        provider.calls.clear()
        provider.fail = False
        resumed = store.create_job("distill", {"document_id": identifier})
        assert worker.run_one() and store.job(resumed["id"])["state"] == "completed"
        final = store.get(identifier)["artifacts"]["distillation"]
        assert final["completed_batches"] == 2 and len(provider.calls) == 1
        assert final["sections"][:1] == partial["sections"]
        assert final["evidence_identity"] == partial["evidence_identity"]
        assert (
            store.passages([identifier]) == sources
            and store.original(identifier).read_bytes() == raw
        )
        assert provider.embeds == [] and store.job(job["id"])["state"] == "failed"
    finally:
        worker.close()


def test_procedure_policy_archives_v7_verbatim_and_starts_current_at_zero(tmp_path):
    from app.services.aircraft_library.models import (
        SOURCE_SCOPE_V7_CORRECTION_POLICY,
        CORRECTION_POLICY,
        distillation_context,
        distill,
        validate_answer,
    )
    from app.services.aircraft_library.store import Store
    from .test_aircraft_library import manual
    from .test_aircraft_library_resume import Provider, ProcessKilled

    store = Store(tmp_path / "library")
    raw = manual(
        "General inspection notes. " + "Inspect engine controls before servicing. " * 45,
        WING_PHASE_SOURCE,
    )
    doc = store.ingest(raw, {"icao": "C172"})
    identifier = doc["id"]
    provider = Provider()
    _, roots, question, fingerprint = distillation_context(
        store,
        provider,
        identifier,
        correction_policy=SOURCE_SCOPE_V7_CORRECTION_POLICY,
    )
    assert len(roots) == 2
    section = {
        "pages": sorted({row["page"] for row in roots[0]}),
        **validate_answer(
            provider.complete(roots[0], question),
            roots[0],
            correction_policy=SOURCE_SCOPE_V7_CORRECTION_POLICY,
        ),
    }
    old = {
        "kind": "llm_distillation",
        "status": "partial",
        "correction_policy": SOURCE_SCOPE_V7_CORRECTION_POLICY,
        "evidence_identity": fingerprint,
        "sections": [section],
        "completed_batches": 1,
        "total_batches": 2,
        "batch_plan": [[row["passage_id"] for row in batch] for batch in roots],
        "recovery": {"state": "old-policy-fixture-receipt"},
    }
    store.artifact(identifier, "distillation", old)
    sources = copy.deepcopy(store.passages([identifier]))
    provider.calls.clear()
    provider.kill_at = 1
    with pytest.raises(ProcessKilled):
        distill(store, provider, identifier)
    fresh = store.get(identifier)["artifacts"]["distillation"]
    assert fresh["completed_batches"] == 0 and fresh["sections"] == []
    assert fresh["correction_policy"] == CORRECTION_POLICY == "flap-color-feedback-v12"
    assert fresh["evidence_identity"] != fingerprint and "recovery" not in fresh
    assert provider.calls == [[row["passage_id"] for row in roots[0]]]
    history = store.distillations(identifier)["items"]
    assert any(
        store.historical_distillation(identifier, row["revision_id"])["artifact"] == old
        for row in history
    )
    assert (
        store.passages([identifier]) == sources and store.original(identifier).read_bytes() == raw
    )
    assert provider.embeds == []


@pytest.mark.parametrize("first_failure", ["numeric", "applicability"])
@pytest.mark.parametrize("drop_procedure", [False, True])
def test_procedure_obligation_survives_an_earlier_validation_failure(first_failure, drop_procedure):
    conditional = {
        **CONDITIONAL_OPERATIONS,
        "document_id": "doc_procedure",
        "passage_id": 2,
        "page": 2,
        "label": "2",
    }
    evidence = [procedure_source(WING_PHASE_SOURCE), conditional]
    calls = []

    def provider(request):
        question = json.loads(json.loads(request.content)["messages"][1]["content"])["question"]
        calls.append(question)
        if len(calls) == 1:
            text = "Wing fire: use flaps as required. " + (
                "Airspeed is 999 KIAS." if first_failure == "numeric" else UNQUALIFIED_CERTIFICATION
            )
        else:
            feedback = json.loads(question.rsplit("\n", 1)[-1])["rejected_claims"][0]
            assert feedback["procedure_requirements"]["conditions"] == [
                "flaps_final_approach_touchdown"
            ]
            assert (
                len(feedback.get("qualification_excerpt_options", []))
                + len(feedback["procedure_excerpt_options"])
                <= 6
            )
            text = (
                QUALIFIED_CERTIFICATION
                if first_failure == "applicability"
                else "The source describes a wing fire."
            )
            if not drop_procedure:
                text += " Wing fire: use flaps only as required for final approach and touchdown."
        return response(
            procedure_answer(
                text,
                citations=[
                    {"passage_id": 1, "excerpt_id": 0},
                    {"passage_id": 2, "excerpt_id": 0},
                ],
            )["claims"]
        )

    if drop_procedure:
        with pytest.raises(ModelUnavailable, match="procedure"):
            verified_completion(model(provider), evidence, "Summarize", max_attempts=2)
    else:
        assert verified_completion(model(provider), evidence, "Summarize", max_attempts=2)["claims"]
    assert len(calls) == 2
