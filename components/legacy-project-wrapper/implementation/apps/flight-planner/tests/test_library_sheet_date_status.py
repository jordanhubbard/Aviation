"""#612 prospective controls; fixtures and diagnostic repairs are never inference seeds."""
import copy
import json

import httpx
import pytest

from app.services.aircraft_library.models import ModelUnavailable, validate_answer, verified_completion
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_library_chart_dates import source, answer
from .test_library_correction_schema import model, response

BAD = ('Figure 1-2 sheets carry conflicting dates: Sheet 1 (page 1-14) is dated '
       'Nov 15/00 while Sheet 2 (page 1-15) is dated June 13/97.')
GOOD = BAD.replace('conflicting', 'different')


def sources():
    return [
        source(1, 23, 'Figure 1-2. Weight Conversions (Sheet 1 of 2)\n1-14\nNov 15/00'),
        source(2, 24, 'Figure 1-2. Weight Conversions (Sheet 2 of 2)\n1-15\nJune 13/97'),
        source(3, 25, 'General material. Reported value 42.'),
    ]


@pytest.mark.parametrize('status', ['conflicting dates', 'inconsistent dates', 'contradictory dates',
                                   'conflicting revision dates', 'dates conflict', 'dates are inconsistent',
                                   'dates are in conflict', 'a conflict between the dates',
                                   'dates appear to be in conflict', 'inconsistency among the revision dates',
                                   'conflicting revision-dates', 'conflicting revision‑dates'])
def test_distinct_source_dates_do_not_license_conflict_status(status):
    with pytest.raises(ModelUnavailable, match='support|conflict') as caught:
        validate_answer(answer(BAD.replace('conflicting dates', status), 1, 2), sources())
    f = caught.value.feedback
    assert f['procedure_requirements']['date_status_bindings']
    assert 'date_conflict' in f.get('unsupported_source_qualifiers', [])
    assert len(f['procedure_requirements']['date_status_bindings']) == 2


@pytest.mark.parametrize('text', [GOOD, GOOD.replace('different dates', 'different revision dates'),
    'Figure 1-2 Sheet 1 is dated Nov 15/00 while Sheet 2 is dated June 13/97.',
    GOOD.replace('different dates', 'non-conflicting dates'),
    'Conversion factors conflict; Figure 1-2 Sheet 1 is dated Nov 15/00 while Sheet 2 is dated June 13/97.'])
def test_neutral_dates_and_other_subject_conflicts_remain_independent(text):
    assert validate_answer(answer(text, 1, 2), sources())


@pytest.mark.parametrize('wording', ['These are conflicting revision dates.', 'The dates are in conflict.',
    'There is a conflict between the dates.', 'The dates appear to be in conflict.',
    'There is inconsistency among the revision dates.',
    'These are conflicting revision-dates.', 'These are conflicting revision‑dates.'])
def test_explicit_source_statement_can_supply_date_conflict_wording(wording):
    rows = sources();rows.append(source(4, 23, wording))
    assert validate_answer(answer(BAD, 1, 2, 4), rows)


@pytest.mark.parametrize('where,wording', [('same', 'The conversion factors conflict.'),
    ('same', 'These are not conflicting dates.'),
    ('same', 'These are non-conflicting dates.'), ('same', 'These are non‑conflicting dates.'), ('other_page', 'These are conflicting dates.'),
    ('foreign', 'These are conflicting dates.')])
def test_unrelated_negative_or_foreign_status_is_not_support(where, wording):
    rows = sources();rows.append(source(4, 25 if where == 'other_page' else 23, wording,
                                       document='doc_foreign' if where == 'foreign' else 'doc_charts'))
    ids = (1, 2) if where == 'foreign' else (1, 2, 4)
    with pytest.raises(ModelUnavailable, match='support|conflict'):
        validate_answer(answer(BAD, *ids), rows)


@pytest.mark.parametrize('mode', ['unprovided', 'restricted', 'foreign', 'ambiguous', 'unasserted'])
def test_no_obligations_invented_from_unavailable_or_ambiguous_binding(mode):
    rows = sources();rows[2]['text'] = 'Other material. Values 1-15 and June 13/97.'
    if mode == 'unprovided': rows = rows[:1] + rows[2:]
    elif mode == 'restricted': rows[1]['source_limit'] = VerifiedSourceLimit(original_image_only=True)
    elif mode == 'foreign': rows[1]['document_id'] = 'doc_foreign'
    elif mode == 'ambiguous': rows[1]['text'] += '\nFigure 2-4. Other chart.'
    if mode == 'unasserted':
        text = 'Figure 1-2 Sheet 1 is dated Nov 15/00.'
    else:
        text = BAD
    ids = (1,) if mode == 'unasserted' else ((1, 2) if mode in ['foreign', 'ambiguous'] else (1, 3))
    # Passing this bounded check is not general entailment or cross-manual approval.
    assert validate_answer(answer(text, *ids), rows)


def test_other_figures_and_dates_are_derived_without_actual_manual_constants():
    rows = [source(1, 80, 'Figure 7-4 Sheet 3\nJan 9/03'),
            source(2, 81, 'Figure 7-4 Sheet 5\nFeb 2/04')]
    text = 'Figure 7-4 has conflicting dates: Sheet 3 dated Jan 9/03 while Sheet 5 dated Feb 2/04.'
    with pytest.raises(ModelUnavailable, match='support|conflict'):
        validate_answer(answer(text, 1, 2), rows)
    assert validate_answer(answer(text.replace('conflicting', 'different'), 1, 2), rows)


@pytest.mark.parametrize('evasion', ['drop', 'date', 'sheet', 'figure', 'swap', 'negate', 'reason', 'foreign', 'page'])
def test_repair_keeps_both_original_sheet_date_bindings(evasion):
    rows = sources();foreign = copy.deepcopy(rows[1]);foreign.update(passage_id=4, document_id='doc_foreign')
    other = copy.deepcopy(rows[1]);other.update(passage_id=5, page=90);rows.extend([foreign, other]);calls = []
    choices = {
        'drop': ('General material.', (3,)),
        'date': (GOOD.replace('June 13/97', 'Nov 15/00'), (1, 2)),
        'sheet': ('Figure 1-2 Sheet 1 is dated Nov 15/00.', (1,)),
        'figure': (GOOD.replace('Figure 1-2', 'The figure'), (1, 2)),
        'swap': (GOOD.replace('Nov 15/00', 'TEMP').replace('June 13/97', 'Nov 15/00').replace('TEMP', 'June 13/97'), (1, 2)),
        'negate': (GOOD.replace('is dated', 'is not dated'), (1, 2)),
        'reason': ('General material.', (3,)),
        'foreign': (GOOD, (1, 4)), 'page': (GOOD, (1, 5)),
    }
    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question'];calls.append(question)
        if len(calls) == 1: return response(answer(BAD, 1, 2)['claims'])
        f = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert len(f['procedure_requirements']['date_status_bindings']) == 2
        text, ids = choices[evasion];r = response(answer(text, *ids)['claims'])
        if evasion == 'reason':
            body = r.json();value = json.loads(body['choices'][0]['message']['content']);value['reason'] = GOOD
            body['choices'][0]['message']['content'] = json.dumps(value);return httpx.Response(200, json=body)
        return r
    with pytest.raises(ModelUnavailable, match='support|conflict'):
        verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    assert len(calls) == 2


@pytest.mark.parametrize('numeric_first', [True, False])
def test_neutral_repair_preserves_valid_sibling_and_existing_budgets(numeric_first):
    rows = sources();calls = [];stable = answer('General material.', 3)['claims'][0]
    def provider(request):
        payload = json.loads(request.content);question = json.loads(payload['messages'][1]['content'])['question'];calls.append(payload)
        if len(calls) == 1:
            text = BAD + (' Reported value 42.' if numeric_first else '')
            return response(answer(text, 1, 2)['claims'] + [stable])
        f = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert len(f['procedure_requirements']['date_status_bindings']) == 2
        options = f['procedure_excerpt_options'];assert len(options) <= 6
        assert all(len(o['text']) <= 1200 and o['text'] == next(r['text'] for r in rows if r['passage_id'] == o['passage_id']) for o in options)
        return response(answer(GOOD + (' Reported value 42.' if numeric_first else ''), 1, 2, 3)['claims'])
    result = verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    assert len(calls) == 2 and result['claims'][1]['text'] == stable['text']
    assert result['claims'][1]['citations'][0]['quote'] == rows[2]['text']
    assert calls[0]['response_format']['json_schema']['schema']['properties']['claims']['maxItems'] == 12


def test_explicit_recorded_v18_behavior_is_preserved():
    assert validate_answer(answer(BAD, 1, 2), sources(), correction_policy='flap-band-feedback-v18')


def test_shared_literal_witness_bound_with_many_same_page_sources():
    rows = sources() + [source(i, 23, sources()[0]['text']) for i in range(10, 32)]
    with pytest.raises(ModelUnavailable, match='support|conflict') as caught:
        validate_answer(answer(BAD, 1, 2), rows)
    f = caught.value.feedback
    assert len(f['procedure_requirements']['date_status_bindings']) <= 6
    options = f['procedure_excerpt_options'];assert 1 <= len(options) <= 6
    assert all(len(o['text']) <= 1200 and o['text'] == next(r['text'] for r in rows if r['passage_id'] == o['passage_id']) for o in options)
