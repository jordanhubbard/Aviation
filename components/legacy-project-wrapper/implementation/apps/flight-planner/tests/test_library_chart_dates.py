"""#592 prospective chart/date coverage controls; never actual inference seeds."""
import copy
import json

import httpx
import pytest

from app.services.aircraft_library.models import ModelUnavailable, validate_answer, verified_completion
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_library_correction_schema import model, response


def source(identifier, page, text, document='doc_charts'):
    return dict(passage_id=identifier, document_id=document, page=page, label=str(page),
                method='text', metadata={'icao': 'C182'}, text=text)


def sources():
    return [
        source(1, 25, 'Figure 1-3. Length Conversions (Sheet 1 of 2)\n1-16\nNov 15/00'),
        source(2, 26, 'Figure 1-3. Length Conversions (Sheet 2 of 2)\n1-17\nNov 15/00'),
        source(3, 27, 'Figure 1-4. Length Conversions (Sheet 1 of 2)\n1-18\nNov 15/00'),
        source(4, 28, 'Figure 1-4. Length Conversions (Sheet 2 of 2)\n1-19\nJune 13/97'),
        source(5, 29, 'Figure 1-5. Distance Conversions\n1-20\nNov 15/00'),
        source(6, 30, 'General material. Reported value 42.'),
    ]


def answer(text, *ids):
    return dict(insufficient_evidence=False, reason='', claims=[dict(text=text,
        citations=[dict(passage_id=i, excerpt_id=0) for i in ids])])


ACTUAL = ('Revision dates differ among sheets: Figure 1-4 Sheet 2 is dated June 13/97, '
          'while Figure 1-3 sheets, Figure 1-4 Sheet 1, and Figure 1-5 are dated Nov 15/00.')


def test_actual_plural_sheet_date_requires_each_provided_sheet_quote():
    with pytest.raises(ModelUnavailable, match='support') as caught:
        validate_answer(answer(ACTUAL, 2, 3, 4, 5), sources())
    f = caught.value.feedback
    assert f['missing_procedure_citation_conditions']
    assert any(x['passage_id'] == 1 for x in f['procedure_excerpt_options'])
    assert f['procedure_requirements']['chart_dates']


def test_complete_actual_associations_are_supported():
    result = validate_answer(answer(ACTUAL, 1, 2, 3, 4, 5), sources())
    assert result['claims'][0]['text'] == ACTUAL


@pytest.mark.parametrize('text,ids', [
    ('Figure 1-3 Sheet 2 is dated Nov 15/00.', (2,)),
    ('Figure 1-3 is dated Nov 15/00.', (2,)),
    ('Figure 1-3 sheets are present.', (2,)),
    ('Figure 1-5 is dated Nov 15/00.', (5,)),
    ('Figure 1-3 Sheet 1 is dated November 15/00.', (1,)),
    ('Fig. 1-3, sheet 2, is dated Nov 15/00.', (2,)),
    ('Figure 1-4 Sheet 2 is dated June 13/97, while Figure 1-4 Sheet 1 is dated Nov 15/00.', (3, 4)),
])
def test_supported_partial_alias_and_contrast_claims(text, ids):
    assert validate_answer(answer(text, *ids), sources())['claims'][0]['text'] == text


@pytest.mark.parametrize('text,ids', [
    ('Both sheets of Figure 1-3 are dated Nov 15/00.', (2,)),
    ('Figure 1-3 sheets 1 and 2 are dated Nov 15/00.', (2,)),
    ('Figure 1-3 Sheet 1 is dated November 15/00.', (2,)),
    ('Fig. 1-3 sheet 1 is dated Nov 15/00.', (2,)),
    ('Figure 1-4 Sheet 1 is dated Nov 15/00.', (2,)),
    ('Figure 1-5 is dated Nov 15/00.', (2,)),
])
def test_matching_date_on_another_sheet_or_figure_does_not_supply_association(text, ids):
    with pytest.raises(ModelUnavailable, match='support'):
        validate_answer(answer(text, *ids), sources())


def test_selected_same_page_fragments_can_collectively_support_identity_and_date():
    rows = [source(1, 25, 'Figure 1-3. Length Conversions (Sheet 1 of 2)'),
            source(2, 25, 'Nov 15/00'), source(3, 26, 'Figure 1-3 Sheet 2 Nov 15/00')]
    assert validate_answer(answer('Figure 1-3 Sheet 1 is dated Nov 15/00.', 1, 2), rows)
    with pytest.raises(ModelUnavailable, match='support'):
        validate_answer(answer('Figure 1-3 Sheet 1 is dated Nov 15/00.', 1, 3), rows)


@pytest.mark.parametrize('mode', ['unprovided', 'restricted', 'foreign'])
def test_no_association_discovery_from_unavailable_source(mode):
    rows = sources()
    if mode == 'unprovided':
        rows = rows[1:]
    elif mode == 'restricted':
        rows[0]['source_limit'] = VerifiedSourceLimit(original_image_only=True)
    else:
        rows[0]['document_id'] = 'doc_foreign'
    assert validate_answer(answer('Figure 1-3 sheets are dated Nov 15/00.', 2), rows)


@pytest.mark.parametrize('evasion', ['drop', 'sheet', 'date', 'reason_only', 'foreign', 'negate'])
def test_repair_preserves_original_associations(evasion):
    rows = sources();foreign = copy.deepcopy(rows[0]);foreign.update(passage_id=7, document_id='doc_foreign');rows.append(foreign)
    calls = []

    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question'];calls.append(question)
        if len(calls) == 1:
            return response(answer('Figure 1-3 sheets are dated Nov 15/00.', 2)['claims'])
        failure = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert failure['procedure_requirements']['chart_dates']
        choices = {'drop': ('General material.', (6,)),
                   'sheet': ('Figure 1-3 Sheet 2 is dated Nov 15/00.', (2,)),
                   'date': ('Figure 1-3 sheets are dated June 13/97.', (2, 4)),
                   'reason_only': ('General material.', (6,)),
                   'foreign': ('Figure 1-3 sheets are dated Nov 15/00.', (2, 7)),
                   'negate': ('Figure 1-3 sheets are not dated Nov 15/00.', (1, 2))}
        text, ids = choices[evasion];r = response(answer(text, *ids)['claims'])
        if evasion == 'reason_only':
            data = r.json();content = json.loads(data['choices'][0]['message']['content']);content['reason'] = 'Figure 1-3 sheets are dated Nov 15/00.';data['choices'][0]['message']['content'] = json.dumps(content);return httpx.Response(200, json=data)
        return r

    with pytest.raises(ModelUnavailable, match='support'):
        verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    assert len(calls) == 2


@pytest.mark.parametrize('retain', [True, False])
def test_numeric_first_failure_keeps_association_and_accepted_claim(retain):
    rows = sources();calls = [];stable = answer('General material.', 6)['claims'][0]

    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question'];calls.append(question)
        if len(calls) == 1:
            return response(answer('Figure 1-3 sheets are dated Nov 15/00. Reported value 42.', 2)['claims'] + [stable])
        f = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert f['unsupported_numeric_values'] == ['42']
        assert f['procedure_requirements']['chart_dates']
        text = ('Figure 1-3 sheets are dated Nov 15/00. ' if retain else '') + 'Reported value 42.'
        return response(answer(text, 1, 2, 6)['claims'])

    if retain:
        result = verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
        assert result['claims'][1]['text'] == stable['text']
        assert result['claims'][1]['citations'][0]['quote'] == rows[5]['text']
    else:
        with pytest.raises(ModelUnavailable, match='support'):
            verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    assert len(calls) == 2


def test_explicit_v10_behavior_is_preserved():
    assert validate_answer(answer(ACTUAL, 2, 3, 4, 5), sources(), correction_policy='definition-quote-feedback-v10')


def test_source_witness_budget_and_original_text_are_preserved():
    rows = sources() + [source(i, 25, 'Figure 1-3. Length Conversions (Sheet 1 of 2)\nNov 15/00') for i in range(10, 24)]
    with pytest.raises(ModelUnavailable, match='support') as caught:
        validate_answer(answer('Figure 1-3 sheets are dated Nov 15/00.', 2), rows)
    options = caught.value.feedback['procedure_excerpt_options'];assert 1 <= len(options) <= 6
    byid = {r['passage_id']:r for r in rows}
    assert all(len(o['text']) <= 1200 and o['text'] == byid[o['passage_id']]['text'] for o in options)


def test_date_alias_does_not_weaken_numeric_evidence():
    with pytest.raises(ModelUnavailable, match='numeric'):
        validate_answer(answer('Figure 1-3 Sheet 1 is dated November 15, 2000.', 1), sources())


def test_expanded_date_is_supported_when_it_is_actually_quoted():
    row = source(1, 25, 'Figure 1-3. Length Conversions (Sheet 1 of 2)\nNovember 15, 2000')
    assert validate_answer(answer('Figure 1-3 Sheet 1 is dated November 15, 2000.', 1), [row])


def test_new_policy_archives_v10_claims_and_receipt_then_starts_zero(tmp_path):
    from app.services.aircraft_library.models import CORRECTION_POLICY, distillation_context, distill
    from app.services.aircraft_library.store import Store
    from .test_aircraft_library import manual
    from .test_aircraft_library_resume import Provider, ProcessKilled

    store = Store(tmp_path / 'library')
    raw = manual('General inspection notes. ' + 'Inspect controls before servicing. ' * 45,
                 'Definitions supplied in the manual.')
    doc = store.ingest(raw, {'icao': 'C172'})
    provider = Provider()
    _, roots, question, fingerprint = distillation_context(store, provider, doc['id'], correction_policy='definition-quote-feedback-v10')
    section = dict(pages=sorted({r['page'] for r in roots[0]}), **validate_answer(provider.complete(roots[0], question), roots[0], correction_policy='definition-quote-feedback-v10'))
    prior = dict(kind='llm_distillation', status='partial', correction_policy='definition-quote-feedback-v10', evidence_identity=fingerprint,
                 sections=[section], completed_batches=1, total_batches=len(roots), batch_plan=[[r['passage_id'] for r in b] for b in roots],
                 recovery={'kind': 'recorded-v10-control-receipt', 'request_scopes_unchanged': True})
    store.artifact(doc['id'], 'distillation', prior)
    before = copy.deepcopy(store.passages([doc['id']]))
    provider.calls.clear(); provider.kill_at = 1
    with pytest.raises(ProcessKilled):
        distill(store, provider, doc['id'])
    fresh = store.get(doc['id'])['artifacts']['distillation']
    assert CORRECTION_POLICY == fresh['correction_policy'] == 'flap-color-feedback-v12'
    assert fresh['completed_batches'] == 0 and fresh['sections'] == [] and 'recovery' not in fresh
    assert fresh['evidence_identity'] != fingerprint
    assert any(store.historical_distillation(doc['id'],r['revision_id'])['artifact'] == prior for r in store.distillations(doc['id'])['items'])
    assert store.passages([doc['id']]) == before and store.original(doc['id']).read_bytes() == raw and provider.embeds == []


def test_foreign_repair_cannot_extend_the_original_bound_witness_context():
    rows = sources()
    with pytest.raises(ModelUnavailable) as first:
        validate_answer(answer('Figure 1-3 sheets are dated Nov 15/00.', 2), rows)
    requirements = first.value.feedback['procedure_requirements']
    foreign = [dict(copy.deepcopy(r), passage_id=r['passage_id'] + 10, document_id='doc_foreign') for r in rows]
    with pytest.raises(ModelUnavailable) as repair:
        validate_answer(answer('Figure 1-3 sheets are dated Nov 15/00.', 11, 12), rows + foreign,
                        procedure_requirements={0:requirements})
    f = repair.value.feedback
    assert {r['document_id'] for r in f['procedure_requirements']['chart_dates']} == {'doc_charts'}
    assert all(x['passage_id'] <= 6 for x in f['procedure_excerpt_options'])


def test_chart_dates_and_existing_families_share_six_witnesses():
    rows = sources()
    tail = 'BHP Brake Horsepower is engine power. VNE Never Exceed Speed is a limit.'
    rows[5]['text'] = 'General material. ' * 80 + tail
    rows.extend(source(i, 30, rows[5]['text']) for i in range(10, 20))
    text = 'BHP is brake horsepower. VNE is never exceed speed. Figure 1-3 sheets are dated Nov 15/00.'
    with pytest.raises(ModelUnavailable) as caught:
        validate_answer(answer(text, 2, 6), rows)
    f = caught.value.feedback
    assert f['procedure_requirements']['chart_dates']
    assert {'definition_bhp', 'airspeed_vne'} <= set(f['procedure_requirements']['concepts'])
    assert len(f['procedure_excerpt_options']) == 6
