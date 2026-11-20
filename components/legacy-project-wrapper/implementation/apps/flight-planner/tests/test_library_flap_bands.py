"""#610 prospective source-pair coverage; never general table entailment approval."""
import copy
import json

import httpx
import pytest

from app.services.aircraft_library.models import ModelUnavailable, validate_answer, verified_completion
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_library_chart_dates import source, answer
from .test_library_correction_schema import model, response

CLAIM = 'Flap control indicator speed limits are 140 KIAS for 0 degrees to 10 degrees, 120 KIAS for 10 degrees to 20 degrees, and 100 KIAS for 20 degrees to FULL, with corresponding color codes and mechanical detents.'


def sources():
    return [source(1, 46, 'Fuel 100LL/100 minimum grade. On flap control indicator: 0° to 10° 140 KIAS (dark blue). 10° to 20° 120 KIAS (Light '),
            source(2, 46, 'blue; detent at 20°). 20° to FULL 100 KIAS (White color code).'),
            source(3, 47, 'General notes. Reported value 42.')]


def test_actual_generic_color_claim_needs_its_missing_band_speed_row():
    with pytest.raises(ModelUnavailable, match='support') as caught:
        validate_answer(answer(CLAIM, 1), sources())
    f = caught.value.feedback
    assert f['procedure_requirements']['flap_bands']
    assert 'flap_band:20_to_full:100_kias' in f['missing_procedure_citation_conditions']
    assert any(o['passage_id'] == 2 and '20° to FULL 100 KIAS' in o['text'] for o in f['procedure_excerpt_options'])
    assert validate_answer(answer(CLAIM, 1, 2), sources())


@pytest.mark.parametrize('low,high,speed', [('5','15','123'), ('15','25','97'), ('2.5','12.5','103.5')])
@pytest.mark.parametrize('reverse', [False, True])
def test_pairs_are_derived_from_unrelated_supplied_values(low, high, speed, reverse):
    rows = [source(1, 1, f'Flap control indicator. Unrelated reported values {low}, {high}, {speed}.'),
            source(2, 1, f'{low}° to {high}° {speed} KIAS.')]
    text = f'Flap control indicator: {speed} KIAS for {low} degrees to {high} degrees.' if reverse else f'Flap control indicator: {low} degrees to {high} degrees {speed} KIAS.'
    with pytest.raises(ModelUnavailable, match='support'): validate_answer(answer(text, 1), rows)
    assert validate_answer(answer(text, 1, 2), rows)


@pytest.mark.parametrize('mode', ['absent', 'restricted', 'foreign', 'metadata', 'split'])
def test_no_obligation_from_unavailable_or_cross_excerpt_pair(mode):
    rows = sources()
    if mode == 'absent': rows.pop(1)
    elif mode == 'restricted': rows[1]['source_limit'] = VerifiedSourceLimit(original_image_only=True)
    elif mode == 'foreign': rows[1]['document_id'] = 'foreign'
    elif mode == 'metadata': rows[0]['metadata']['title'] = rows.pop(1)['text']
    else: rows[1]['text'] = '20° to FULL'; rows.append(source(4, 46, '100 KIAS (White).'))
    assert validate_answer(answer(CLAIM, 1), rows)


@pytest.mark.parametrize('mode', ['foreign', 'other_page'])
def test_another_page_or_manual_cannot_supply_the_missing_pair(mode):
    rows = sources(); extra = copy.deepcopy(rows[1]); extra['passage_id'] = 4
    if mode == 'foreign': extra['document_id'] = 'foreign'
    else: extra['page'] = 99
    rows.append(extra)
    with pytest.raises(ModelUnavailable, match='support'): validate_answer(answer(CLAIM, 1, 4), rows)


@pytest.mark.parametrize('mode', ['drop', 'topic', 'topic_negate', 'negate', 'change_pair', 'foreign', 'other_page', 'reason_only'])
def test_repair_preserves_original_topic_pairs_page_and_manual(mode):
    rows = sources() + [source(4, 46, 'Flap control indicator: 0° to 10° 140 KIAS. 10° to 20° 120 KIAS. 20° to FULL 100 KIAS.', document='foreign'),
                        source(5, 99, 'Flap control indicator: 0° to 10° 140 KIAS. 10° to 20° 120 KIAS. 20° to FULL 100 KIAS.')]
    calls = []
    def provider(request):
        q = json.loads(json.loads(request.content)['messages'][1]['content'])['question']; calls.append(q)
        if len(calls) == 1: return response(answer(CLAIM, 1)['claims'])
        f = json.loads(q.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert f['procedure_requirements']['flap_bands']
        text = CLAIM; ids = [1, 2]
        if mode in ['drop', 'reason_only']: text = 'General notes.'; ids = [3]
        elif mode == 'topic': text = CLAIM.replace('Flap control indicator speed limits are ', '')
        elif mode == 'topic_negate': text = 'Not ' + CLAIM
        elif mode == 'negate': text = CLAIM.replace('100 KIAS for', 'not 100 KIAS for')
        elif mode == 'change_pair': text = CLAIM.replace('100 KIAS for', '120 KIAS for')
        elif mode == 'foreign': ids = [1, 4]
        else: ids = [1, 5]
        value = answer(text, *ids)
        if mode == 'reason_only':
            value['reason'] = CLAIM
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(value)}}]})
        return response(value['claims'])
    with pytest.raises(ModelUnavailable, match='support'):
        verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    assert len(calls) == 2


def test_selecting_missing_excerpt_repairs_only_rejected_position():
    rows = sources(); stable = answer('General notes.', 3)['claims'][0]; calls = []
    def provider(request):
        calls.append(1)
        return response(answer(CLAIM, *([1] if len(calls)==1 else [1, 2]))['claims'] + ([stable] if len(calls)==1 else []))
    result = verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    assert result['claims'][0]['text'] == CLAIM and result['claims'][1]['text'] == stable['text']
    assert result['claims'][1]['citations'][0]['quote'] == rows[2]['text']
    assert len(calls) == 2


@pytest.mark.parametrize('retain', [True, False])
def test_numeric_first_failure_retains_pair_obligations(retain):
    rows = sources(); calls = []
    def provider(request):
        q = json.loads(json.loads(request.content)['messages'][1]['content'])['question']; calls.append(q)
        if len(calls)==1: return response(answer(CLAIM + ' Reported value 42.', 1)['claims'])
        f = json.loads(q.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert f['unsupported_numeric_values'] == ['42'] and f['procedure_requirements']['flap_bands']
        return response(answer((CLAIM + ' ' if retain else '') + 'Reported value 42.', 1, 2, 3)['claims'])
    if retain: assert verified_completion(model(provider), rows, 'Summarize', max_attempts=2)['claims']
    else:
        with pytest.raises(ModelUnavailable, match='support'): verified_completion(model(provider), rows, 'Summarize', max_attempts=2)


def test_witnesses_keep_existing_shared_bounds():
    words = [(i*5, i*5+5, 150-i*3) for i in range(8)]
    rows = [source(1, 1, 'Flap control indicator. General notes.')]
    rows += [source(i+2, 1, f'{lo}° to {hi}° {speed} KIAS.') for i,(lo,hi,speed) in enumerate(words)]
    # Separate numeric witnesses cannot substitute for band/speed source rows.
    rows.append(source(99, 1, 'Reported values: ' + ', '.join(str(n) for row in words for n in row) + '.'))
    text = 'Flap control indicator: ' + '; '.join(f'{speed} KIAS for {lo} degrees to {hi} degrees' for lo,hi,speed in words)
    with pytest.raises(ModelUnavailable) as caught: validate_answer(answer(text, 1, 99), rows)
    f = caught.value.feedback; assert sum(len(r['pairs']) for r in f['procedure_requirements']['flap_bands']) == 6
    assert 1 <= len(f['procedure_excerpt_options']) <= 6
    assert all(len(o['text']) <= 1200 and o['text'] == next(r['text'] for r in rows if r['passage_id']==o['passage_id']) for o in f['procedure_excerpt_options'])


def test_bare_angle_ranges_do_not_invent_band_speed_obligations():
    rows = sources()
    assert validate_answer(answer('Flap control indicator range 20 degrees to FULL.', 1), rows)


def test_explicit_v17_preserves_recorded_acceptance():
    assert validate_answer(answer(CLAIM, 1), sources(), correction_policy='restricted-layout-feedback-v17')


@pytest.mark.parametrize('retain', [True, False])
def test_applicability_first_failure_preserves_pairs_and_shared_budget(retain):
    from .test_library_correction_schema import CONDITIONAL_OPERATIONS, UNQUALIFIED_CERTIFICATION, QUALIFIED_CERTIFICATION
    conditional = {**CONDITIONAL_OPERATIONS, 'document_id': 'doc_charts', 'passage_id': 4, 'page': 47, 'label': '47'}
    rows = sources() + [conditional]; calls = []
    def provider(request):
        q = json.loads(json.loads(request.content)['messages'][1]['content'])['question']; calls.append(q)
        if len(calls)==1: return response(answer(CLAIM + ' ' + UNQUALIFIED_CERTIFICATION, 1, 4)['claims'])
        f = json.loads(q.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert f['applicability_requirements'] and f['procedure_requirements']['flap_bands']
        assert len(f.get('qualification_excerpt_options', [])) + len(f['procedure_excerpt_options']) <= 6
        return response(answer((CLAIM + ' ' if retain else '') + QUALIFIED_CERTIFICATION, 1, 2, 4)['claims'])
    if retain: assert verified_completion(model(provider), rows, 'Summarize', max_attempts=2)['claims']
    else:
        with pytest.raises(ModelUnavailable, match='support'): verified_completion(model(provider), rows, 'Summarize', max_attempts=2)


@pytest.mark.parametrize('wording', ['20° to FULL 100 KIAS', '20 deg to FULL 100 KIAS',
                                   '100 KIAS at 20 degrees to FULL', '20°–FULL 100 KIAS',
                                   '100.0 KIAS for 20.0 degrees to FULL'])
def test_finite_degree_order_and_decimal_comparison_aliases(wording):
    rows = sources()
    with pytest.raises(ModelUnavailable, match='support'):
        validate_answer(answer('Flap control indicator: ' + wording + '.', 1), rows)
    assert validate_answer(answer('Flap control indicator: ' + wording + '.', 1, 2), rows)


def test_an_unprovided_pair_does_not_acquire_an_invented_anchor():
    rows = sources(); text = 'Flap control indicator: 100 KIAS for 20 degrees to FULL; 120 KIAS for 20 degrees to FULL.'
    with pytest.raises(ModelUnavailable) as caught: validate_answer(answer(text, 1), rows)
    pairs = [pair for r in caught.value.feedback['procedure_requirements']['flap_bands'] for pair in r['pairs']]
    assert ['20', 'full', '100'] in pairs and ['20', 'full', '120'] not in pairs


def test_explicit_v17_retains_its_tabular_layout_guard():
    from .test_library_tabular_layout import sources as layout_sources, CLAIM as LAYOUT_CLAIM
    with pytest.raises(ModelUnavailable, match='tabular'):
        validate_answer(answer(LAYOUT_CLAIM, 1), layout_sources(), correction_policy='restricted-layout-feedback-v17')
