"""#586 prospective negative quotation guards; these controls are never inference seeds."""
import copy
import json

import httpx
import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    citation_excerpts,
    validate_answer,
    verified_completion,
)
from .test_library_correction_schema import model, response


DEFINITIONS = [
    ('KCAS', 'Knots Calibrated Airspeed is indicated airspeed corrected for position and instrument error.'),
    ('KIAS', 'Knots Indicated Airspeed is the speed shown on the airspeed indicator.'),
    ('KTAS', 'Knots True Airspeed is calibrated airspeed corrected for altitude and temperature.'),
    ('VA', 'Maneuvering Speed is the maximum speed for full or abrupt control movements.'),
    ('VFE', 'Maximum Flap Extended Speed is the highest permissible speed with prescribed flap extension.'),
    ('VNO', 'Maximum Structural Cruising Speed should be exceeded only in smooth air with caution.'),
    ('VNE', 'Never Exceed Speed is the speed limit that may not be exceeded at any time.'),
    ('VS', 'Stalling Speed is the minimum speed at which the airplane is controllable.'),
    ('VSO', 'Stalling Speed is the minimum speed controllable in landing configuration at the most forward center of gravity.'),
    ('Vx', 'Best Angle-of-Climb Speed gives greatest altitude gain in a given horizontal distance.'),
    ('Vy', 'Best Rate-of-Climb Speed gives greatest altitude gain in a given time.'),
]


def source(tail, *, identifier=1, document='doc_glossary', page=17):
    text = 'Unrelated manual context. ' * 65 + '\n' + tail
    return dict(passage_id=identifier, document_id=document, page=page, label=str(page),
                method='text', metadata={'icao': 'C182'}, text=text)


def answer(text, *indices, identifier=1):
    return dict(insufficient_evidence=False, reason='', claims=[dict(
        text=text, citations=[dict(passage_id=identifier, excerpt_id=i) for i in indices or (0,)]
    )])


def tail_index(row, token):
    return next(i for i, value in enumerate(citation_excerpts(row['text'])) if token in value)


@pytest.mark.parametrize('symbol,definition', DEFINITIONS)
def test_asserted_glossary_concept_requires_its_selected_support(symbol, definition):
    row = source(symbol + ' ' + definition)
    assert symbol not in citation_excerpts(row['text'])[0]
    with pytest.raises(ModelUnavailable, match='support'):
        validate_answer(answer(symbol + ': ' + definition, 0), [row])


@pytest.mark.parametrize('symbol,definition', DEFINITIONS)
def test_selected_glossary_definition_is_supported(symbol, definition):
    row = source(symbol + ' ' + definition)
    text = symbol + ': ' + definition
    assert validate_answer(answer(text, tail_index(row, symbol)), [row])['claims'][0]['text'] == text


def test_actual_relationship_missing_three_definitions_in_neighboring_excerpt():
    row = source('\n'.join(symbol + ' ' + definition for symbol, definition in DEFINITIONS[6:9]))
    text = 'VNE is never exceed speed, VS is stalling speed, and VSO is stalling speed in landing configuration at the most forward center of gravity.'
    with pytest.raises(ModelUnavailable, match='support') as caught:
        validate_answer(answer(text), [row])
    feedback = caught.value.feedback
    assert set(feedback['procedure_requirements']['concepts']) == {'airspeed_vne', 'airspeed_vs', 'airspeed_vso'}
    assert {'airspeed_vne', 'airspeed_vs', 'airspeed_vso'} <= set(feedback['missing_procedure_citation_conditions'])
    witnesses = feedback['procedure_excerpt_options']
    assert 1 <= len(witnesses) <= 6
    assert all(w['passage_id'] == row['passage_id'] and w['text'] == citation_excerpts(row['text'])[w['excerpt_id']] and len(w['text']) <= 1200 for w in witnesses)
    assert validate_answer(answer(text, tail_index(row, 'VNE')), [row])['claims'][0]['text'] == text


def test_supported_partial_glossary_does_not_require_unasserted_later_entries():
    first = 'KCAS Knots Calibrated Airspeed is indicated airspeed corrected for position and instrument error. '
    row = source('VNE Never Exceed Speed is the speed limit.', identifier=2)
    row['text'] = first + row['text']
    text = 'KCAS is knots calibrated airspeed.'
    assert validate_answer(answer(text, identifier=2), [row])['claims'][0]['text'] == text


def test_unambiguous_expanded_name_can_support_a_symbol_without_its_label():
    row = source('VNE Never Exceed Speed is the speed limit that may not be exceeded at any time.')
    quote = 'Never Exceed Speed is the speed limit that may not be exceeded at any time.'
    candidate = answer('VNE is never exceed speed.')
    candidate['claims'][0]['citations'] = [dict(passage_id=1, quote=quote)]
    assert validate_answer(candidate, [row])['claims'][0]['citations'][0]['quote'] == quote


def test_generic_stall_wording_cannot_borrow_the_other_symbol_definition():
    row = source('VS Stalling Speed is the minimum controllable speed.\nVSO Stalling Speed is the minimum speed in landing configuration at the most forward center of gravity.')
    candidate = answer('VS is stalling speed.')
    candidate['claims'][0]['citations'] = [dict(passage_id=1, quote='VSO Stalling Speed is the minimum speed in landing configuration at the most forward center of gravity.')]
    with pytest.raises(ModelUnavailable, match='support'):
        validate_answer(candidate, [row])


@pytest.mark.parametrize('policy', [
    'signed-source-feedback-v4', 'conditional-source-feedback-v5',
    'conditional-source-forms-v6', 'source-scope-feedback-v7',
    'procedure-source-feedback-v8',
])
def test_recorded_predecessor_glossary_behavior_remains_exact(policy):
    row = source('VNE Never Exceed Speed is the speed limit.')
    text = 'VNE is never exceed speed.'
    # Preserve predecessor behavior; acceptance here is not semantic approval.
    assert validate_answer(answer(text), [row], correction_policy=policy)['claims'][0]['text'] == text


@pytest.mark.parametrize('evasion', ['drop', 'reason_only', 'foreign', 'rename_unrelated'])
def test_glossary_correction_retains_known_concepts_and_original_source(evasion):
    row = source('VNE Never Exceed Speed is the speed limit.')
    foreign = {**copy.deepcopy(row), 'passage_id': 2, 'document_id': 'doc_foreign'}
    calls = []

    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question']
        calls.append(question)
        if len(calls) == 1:
            return response(answer('VNE is never exceed speed.')['claims'])
        feedback = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert 'airspeed_vne' in feedback['procedure_requirements']['concepts']
        assert len(feedback['procedure_excerpt_options']) <= 6
        if evasion == 'foreign':
            return response(answer('VNE is never exceed speed.', tail_index(foreign, 'VNE'), identifier=2)['claims'])
        text = 'The manual supplies unrelated context.' if evasion != 'rename_unrelated' else 'VNO is maximum structural cruising speed.'
        result = response(answer(text)['claims'])
        if evasion == 'reason_only':
            payload = result.json()
            content = json.loads(payload['choices'][0]['message']['content'])
            content['reason'] = 'VNE is never exceed speed.'
            payload['choices'][0]['message']['content'] = json.dumps(content)
            return httpx.Response(200, json=payload)
        return result

    with pytest.raises(ModelUnavailable, match='support'):
        verified_completion(model(provider), [row, foreign], 'Summarize', max_attempts=2)
    assert len(calls) == 2


@pytest.mark.parametrize('retain', [True, False])
def test_glossary_obligation_survives_numeric_failure_and_preserves_accepted_claim(retain):
    row = source('VNE Never Exceed Speed is the speed limit. Power limit is 42 hp.')
    stable = dict(text='The manual supplies unrelated context.', citations=[dict(passage_id=1, excerpt_id=0)])
    calls = []

    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question']
        calls.append(question)
        if len(calls) == 1:
            return response(answer('VNE is never exceed speed. Power limit is 42 hp.')['claims'] + [stable])
        feedback = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert feedback['unsupported_numeric_values'] == ['42']
        assert 'airspeed_vne' in feedback['procedure_requirements']['concepts']
        text = ('VNE is never exceed speed. ' if retain else '') + 'Power limit is 42 hp.'
        return response(answer(text, tail_index(row, 'VNE'))['claims'])

    if retain:
        result = verified_completion(model(provider), [row], 'Summarize', max_attempts=2)
        assert result['claims'][1]['text'] == stable['text']
        assert result['claims'][1]['citations'][0]['quote'] == citation_excerpts(row['text'])[0]
    else:
        with pytest.raises(ModelUnavailable, match='support'):
            verified_completion(model(provider), [row], 'Summarize', max_attempts=2)
    assert len(calls) == 2


def test_current_policy_archives_v8_claims_and_receipt_verbatim_then_starts_at_zero(tmp_path):
    from app.services.aircraft_library.models import CORRECTION_POLICY, distillation_context, distill
    from app.services.aircraft_library.store import Store
    from .test_aircraft_library import manual
    from .test_aircraft_library_resume import Provider, ProcessKilled

    store = Store(tmp_path / 'library')
    raw = manual('General inspection notes. ' + 'Inspect controls before servicing. ' * 45,
                 'Airspeed definitions supplied in this manual.')
    doc = store.ingest(raw, {'icao': 'C172'})
    provider = Provider()
    _, roots, question, fingerprint = distillation_context(store, provider, doc['id'], correction_policy='procedure-source-feedback-v8')
    section = dict(pages=sorted({r['page'] for r in roots[0]}), **validate_answer(provider.complete(roots[0], question), roots[0], correction_policy='procedure-source-feedback-v8'))
    old = dict(kind='llm_distillation', status='partial', correction_policy='procedure-source-feedback-v8', evidence_identity=fingerprint,
               sections=[section], completed_batches=1, total_batches=len(roots), batch_plan=[[r['passage_id'] for r in batch] for batch in roots],
               recovery={'kind': 'old-policy-fixture-receipt', 'request_scopes_unchanged': True})
    store.artifact(doc['id'], 'distillation', old)
    before = copy.deepcopy(store.passages([doc['id']]))
    provider.calls.clear(); provider.kill_at = 1
    with pytest.raises(ProcessKilled):
        distill(store, provider, doc['id'])
    fresh = store.get(doc['id'])['artifacts']['distillation']
    assert fresh['completed_batches'] == 0 and fresh['sections'] == []
    assert fresh['correction_policy'] == CORRECTION_POLICY == 'optional-status-feedback-v14'
    assert fresh['evidence_identity'] != fingerprint and 'recovery' not in fresh
    assert provider.calls == [[r['passage_id'] for r in roots[0]]]
    assert any(store.historical_distillation(doc['id'], r['revision_id'])['artifact'] == old for r in store.distillations(doc['id'])['items'])
    assert store.passages([doc['id']]) == before and store.original(doc['id']).read_bytes() == raw and provider.embeds == []


def test_glossary_witness_budget_excludes_other_manuals_and_pages():
    rows = [source('VNE Never Exceed Speed is the speed limit.', identifier=i) for i in range(1, 14)]
    foreign = source('VNE Never Exceed Speed is the speed limit.', identifier=90, document='doc_foreign')
    other_page = source('VNE Never Exceed Speed is the speed limit.', identifier=91, page=18)
    with pytest.raises(ModelUnavailable, match='support') as caught:
        validate_answer(answer('VNE is never exceed speed.'), rows + [foreign, other_page])
    witnesses = caught.value.feedback['procedure_excerpt_options']
    assert len(witnesses) == 6
    by_id = {r['passage_id']: r for r in rows}
    for w in witnesses:
        assert w['passage_id'] in by_id and w['text'] == citation_excerpts(by_id[w['passage_id']]['text'])[w['excerpt_id']]
        assert len(w['text']) <= 1200


def test_glossary_discovery_does_not_invent_unprovided_or_restricted_context():
    from app.services.aircraft_library.models import _procedure_feedback
    from app.services.aircraft_library.source_limits import VerifiedSourceLimit
    local = source('Only local inspection context is supplied.')
    foreign = source('VNE Never Exceed Speed is the speed limit.', identifier=2, document='doc_foreign')
    later = source('VNE Never Exceed Speed is the speed limit.', identifier=3, page=18)
    restricted = source('VNE Never Exceed Speed is the speed limit.', identifier=4)
    restricted['source_limit'] = VerifiedSourceLimit(original_image_only=True)
    # This checks negative-guard scope, not admission or semantic support for the assertion.
    assert _procedure_feedback('VNE is never exceed speed.', [local], [local, foreign, later, restricted], [citation_excerpts(local['text'])[0]], include_glossary=True) == {}
