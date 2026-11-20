"""#589 prospective source-quotation controls; never native inference seeds."""
import copy
import json

import httpx
import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable, citation_excerpts, validate_answer, verified_completion,
)
from .test_library_correction_schema import model, response


def source(tail, *, identifier=1, document='doc_definitions', page=18, prefix=None):
    return dict(passage_id=identifier, document_id=document, page=page, label=str(page),
                method='text', metadata={'icao': 'C182'},
                text=(prefix or 'Unrelated manual context. ' * 65) + '\n' + tail)


def answer(text, *indices, identifier=1):
    return dict(insufficient_evidence=False, reason='', claims=[dict(
        text=text, citations=[dict(passage_id=identifier, excerpt_id=i) for i in indices or (0,)]
    )])


def excerpt(row, token):
    return next(i for i, text in enumerate(citation_excerpts(row['text'])) if token in text)


@pytest.mark.parametrize('assertion,tail', [
    ('BHP is brake horsepower.', 'BHP Brake Horsepower is power developed by the engine.'),
    ('Brake horsepower is engine power.', 'Brake Horsepower is power developed by the engine.'),
    ('The weight conversion chart labels pounds and kilograms.', 'WEIGHT CONVERSIONS\nPOUNDS KILOGRAMS'),
    ('The conversion scale labels lb and kg.', 'WEIGHT CONVERSIONS\nPOUNDS KILOGRAMS'),
])
def test_provided_definition_or_conversion_labels_need_selected_support(assertion, tail):
    row = source(tail)
    with pytest.raises(ModelUnavailable, match='support'):
        validate_answer(answer(assertion), [row])


@pytest.mark.parametrize('claim,printed', [
    ('BHP is brake horsepower.', 'Brake Horsepower is power developed by the engine.'),
    ('Brake horsepower is engine power.', 'BHP is power developed by the engine.'),
])
def test_selected_unambiguous_bhp_alias_supports_its_concept(claim, printed):
    row = source(printed)
    assert validate_answer(answer(claim, excerpt(row, printed)), [row])['claims'][0]['text'] == claim


@pytest.mark.parametrize('pounds', ['pounds', 'pound', 'lb', 'lbs'])
@pytest.mark.parametrize('kilograms', ['kilograms', 'kilogram', 'kg'])
def test_selected_printed_conversion_labels_support_known_unit_aliases(pounds, kilograms):
    row = source('WEIGHT CONVERSIONS\nPOUNDS KILOGRAMS')
    claim = f'The weight conversion chart labels {pounds} and {kilograms}.'
    assert validate_answer(answer(claim, excerpt(row, 'POUNDS')), [row])['claims'][0]['text'] == claim


def test_supported_partial_conversion_does_not_require_unasserted_unit():
    row = source('KILOGRAMS', prefix='WEIGHT CONVERSIONS\nPOUNDS\n' + 'Unrelated context. ' * 80)
    assert 'KILOGRAMS' not in citation_excerpts(row['text'])[0]
    text = 'The conversion chart labels pounds.'
    assert validate_answer(answer(text), [row])['claims'][0]['text'] == text


def test_general_horsepower_does_not_substitute_for_the_named_brake_horsepower_concept():
    row = source('BHP Brake Horsepower is engine power.', prefix='Horsepower is a power unit. ' * 60)
    with pytest.raises(ModelUnavailable, match='support'):
        validate_answer(answer('BHP is brake horsepower.'), [row])


def test_ordinary_weight_statement_does_not_invent_conversion_obligations():
    from app.services.aircraft_library.models import _procedure_feedback
    row = source('Kilograms.', prefix='Cargo weight is 42 lb. ' + 'Unrelated context. ' * 80)
    text = 'Cargo weight is 42 pounds.'
    assert validate_answer(answer(text), [row])['claims'][0]['text'] == text
    assert _procedure_feedback(text, [row], [row], [citation_excerpts(row['text'])[0]], include_definitions=True) == {}


@pytest.mark.parametrize('family', ['bhp', 'units'])
@pytest.mark.parametrize('evasion', ['drop', 'reason_only', 'foreign', 'one_unit'])
def test_definition_repair_freezes_original_concepts_and_source(family, evasion):
    tail = 'BHP Brake Horsepower is engine power.' if family == 'bhp' else 'WEIGHT CONVERSIONS\nPOUNDS KILOGRAMS'
    text = 'BHP is brake horsepower.' if family == 'bhp' else 'The conversion chart labels pounds and kilograms.'
    row = source(tail)
    foreign = {**copy.deepcopy(row), 'passage_id': 2, 'document_id': 'doc_foreign'}
    calls = []

    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question']
        calls.append(question)
        if len(calls) == 1:
            return response(answer(text)['claims'])
        failure = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        required = {'definition_bhp'} if family == 'bhp' else {'conversion_pounds', 'conversion_kilograms'}
        assert required <= set(failure['procedure_requirements']['concepts'])
        assert len(failure['procedure_excerpt_options']) <= 6
        if evasion == 'foreign':
            return response(answer(text, excerpt(foreign, tail), identifier=2)['claims'])
        replacement = 'The manual supplies unrelated context.'
        if evasion == 'one_unit':
            replacement = 'Horsepower is engine power.' if family == 'bhp' else 'The chart labels pounds.'
        result = response(answer(replacement, excerpt(row, tail))['claims'])
        if evasion == 'reason_only':
            payload = result.json()
            content = json.loads(payload['choices'][0]['message']['content'])
            content['reason'] = text
            payload['choices'][0]['message']['content'] = json.dumps(content)
            return httpx.Response(200, json=payload)
        return result

    with pytest.raises(ModelUnavailable, match='support'):
        verified_completion(model(provider), [row, foreign], 'Summarize', max_attempts=2)
    assert len(calls) == 2


@pytest.mark.parametrize('family', ['bhp', 'units'])
@pytest.mark.parametrize('retain', [True, False])
def test_numeric_first_failure_keeps_definition_obligations_and_accepted_claim(family, retain):
    definition = 'BHP Brake Horsepower is engine power.' if family == 'bhp' else 'WEIGHT CONVERSIONS\nPOUNDS KILOGRAMS'
    original = 'BHP is brake horsepower.' if family == 'bhp' else 'The conversion chart labels pounds and kilograms.'
    row = source(definition + ' The reported value is 42.')
    stable = answer('The manual supplies unrelated context.')['claims'][0]
    calls = []

    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question']
        calls.append(question)
        if len(calls) == 1:
            return response(answer(original + ' The reported value is 42.')['claims'] + [stable])
        failure = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert failure['unsupported_numeric_values'] == ['42']
        required = {'definition_bhp'} if family == 'bhp' else {'conversion_pounds', 'conversion_kilograms'}
        assert required <= set(failure['procedure_requirements']['concepts'])
        replacement = (original + ' ' if retain else '') + 'The reported value is 42.'
        return response(answer(replacement, excerpt(row, definition))['claims'])

    if retain:
        result = verified_completion(model(provider), [row], 'Summarize', max_attempts=2)
        assert result['claims'][1]['text'] == stable['text']
        assert result['claims'][1]['citations'][0]['quote'] == citation_excerpts(row['text'])[0]
    else:
        with pytest.raises(ModelUnavailable, match='support'):
            verified_completion(model(provider), [row], 'Summarize', max_attempts=2)
    assert len(calls) == 2


def test_all_families_share_the_existing_six_source_witness_budget():
    tail = 'BHP Brake Horsepower is engine power. WEIGHT CONVERSIONS POUNDS KILOGRAMS. VNE Never Exceed Speed is a limit.'
    rows = [source(tail, identifier=i) for i in range(1, 14)]
    extra = [source(tail, identifier=90, document='doc_foreign'), source(tail, identifier=91, page=19)]
    text = 'BHP is brake horsepower. The conversion chart labels pounds and kilograms. VNE is never exceed speed.'
    with pytest.raises(ModelUnavailable, match='support') as caught:
        validate_answer(answer(text), rows + extra)
    f = caught.value.feedback
    assert {'definition_bhp', 'conversion_pounds', 'conversion_kilograms', 'airspeed_vne'} <= set(f['procedure_requirements']['concepts'])
    options = f['procedure_excerpt_options']
    assert len(options) == 6
    byid = {r['passage_id']: r for r in rows}
    assert all(o['passage_id'] in byid and len(o['text']) <= 1200 and o['text'] == citation_excerpts(byid[o['passage_id']]['text'])[o['excerpt_id']] for o in options)


def test_unprovided_restricted_foreign_and_other_page_labels_do_not_create_obligations():
    from app.services.aircraft_library.models import _procedure_feedback
    from app.services.aircraft_library.source_limits import VerifiedSourceLimit
    tail = 'BHP Brake Horsepower is engine power. WEIGHT CONVERSIONS POUNDS KILOGRAMS.'
    local = source('Only unrelated context is provided here.')
    foreign = source(tail, identifier=2, document='doc_foreign')
    other_page = source(tail, identifier=3, page=19)
    restricted = source(tail, identifier=4)
    restricted['source_limit'] = VerifiedSourceLimit(original_image_only=True)
    text = 'BHP is brake horsepower. The conversion chart labels pounds and kilograms.'
    assert _procedure_feedback(text, [local], [local, foreign, other_page, restricted], [citation_excerpts(local['text'])[0]], include_definitions=True) == {}


def test_explicit_v9_definition_behavior_is_preserved_without_claiming_semantic_approval():
    row = source('BHP Brake Horsepower is engine power.')
    candidate = answer('BHP is brake horsepower.')
    assert validate_answer(candidate, [row], correction_policy='symbol-quote-feedback-v9')['claims'][0]['text'] == candidate['claims'][0]['text']


def test_explicit_v9_still_rejects_missing_airspeed_quotation():
    row = source('VNE Never Exceed Speed is a limit.')
    with pytest.raises(ModelUnavailable, match='support'):
        validate_answer(answer('VNE is never exceed speed.'), [row], correction_policy='symbol-quote-feedback-v9')


def test_new_policy_archives_v9_claims_and_receipt_then_starts_zero(tmp_path):
    from app.services.aircraft_library.models import CORRECTION_POLICY, distillation_context, distill
    from app.services.aircraft_library.store import Store
    from .test_aircraft_library import manual
    from .test_aircraft_library_resume import Provider, ProcessKilled

    store = Store(tmp_path / 'library')
    raw = manual('General inspection notes. ' + 'Inspect controls before servicing. ' * 45,
                 'Definitions supplied in the manual.')
    doc = store.ingest(raw, {'icao': 'C172'})
    provider = Provider()
    _, roots, question, fingerprint = distillation_context(store, provider, doc['id'], correction_policy='symbol-quote-feedback-v9')
    section = dict(pages=sorted({r['page'] for r in roots[0]}), **validate_answer(provider.complete(roots[0], question), roots[0], correction_policy='symbol-quote-feedback-v9'))
    prior = dict(kind='llm_distillation', status='partial', correction_policy='symbol-quote-feedback-v9', evidence_identity=fingerprint,
                 sections=[section], completed_batches=1, total_batches=len(roots), batch_plan=[[r['passage_id'] for r in b] for b in roots],
                 recovery={'kind': 'recorded-v9-control-receipt', 'request_scopes_unchanged': True})
    store.artifact(doc['id'], 'distillation', prior)
    before = copy.deepcopy(store.passages([doc['id']]))
    provider.calls.clear(); provider.kill_at = 1
    with pytest.raises(ProcessKilled):
        distill(store, provider, doc['id'])
    fresh = store.get(doc['id'])['artifacts']['distillation']
    assert CORRECTION_POLICY == fresh['correction_policy'] == 'optional-status-feedback-v14'
    assert fresh['completed_batches'] == 0 and fresh['sections'] == [] and 'recovery' not in fresh
    assert fresh['evidence_identity'] != fingerprint
    assert any(store.historical_distillation(doc['id'],r['revision_id'])['artifact'] == prior for r in store.distillations(doc['id'])['items'])
    assert store.passages([doc['id']]) == before and store.original(doc['id']).read_bytes() == raw and provider.embeds == []
