"""#608 prospective negative layout coverage; not table entailment approval."""
import json

import httpx
import pytest

from app.services.aircraft_library.models import ModelUnavailable, validate_answer, verified_completion
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_library_chart_dates import source, answer
from .test_library_correction_schema import model, response


HEADER = 'Meters × 3.281 = Feet; Feet × .305 = Meters. FEET METERS'
CLAIM = 'A length conversion table shows Meters × 3.281 = Feet and Feet × .305 = Meters.'
NEUTRAL = 'Length conversion formulas are Meters × 3.281 = Feet and Feet × .305 = Meters.'


def sources():
    rows = [source(1, 26, HEADER), source(2, 26, 'Unavailable graphic contents.'),
            source(3, 27, 'General notes. Reported value 42.')]
    rows[1]['source_limit'] = VerifiedSourceLimit(id=1, reason="native_layout_unreliable", original_image_only=True)
    return rows


@pytest.mark.parametrize('word', ['table', 'tables', 'tabular', 'TABLE'])
def test_header_only_restricted_page_cannot_supply_layout(word):
    with pytest.raises(ModelUnavailable, match='tabular') as caught:
        validate_answer(answer(CLAIM.replace('table', word), 1), sources())
    assert caught.value.feedback['unsupported_source_qualifiers'] == ['tabular_layout']
    assert caught.value.feedback['procedure_requirements']['tabular_layout_pages'] == [['doc_charts', 26]]


@pytest.mark.parametrize('mode', ['unselected', 'metadata', 'restricted', 'foreign', 'other_page'])
def test_unavailable_or_wrong_scope_layout_wording_cannot_supply_support(mode):
    rows = sources() + [source(4, 26, 'Conversion table.')]
    ids = [1]
    if mode == 'metadata': rows[0]['metadata']['title'] = rows.pop()['text']
    elif mode == 'restricted': rows[-1]['source_limit'] = VerifiedSourceLimit(id=1, reason="native_layout_unreliable", original_image_only=True)
    elif mode == 'foreign': rows[-1]['document_id'] = 'foreign'; ids.append(4)
    elif mode == 'other_page': rows[-1]['page'] = 99; ids.append(4)
    with pytest.raises(ModelUnavailable, match='tabular'):
        validate_answer(answer(CLAIM, *ids), rows)


@pytest.mark.parametrize('word', ['table', 'tables', 'tabular'])
def test_explicit_selected_same_page_wording_covers_family(word):
    rows = sources() + [source(4, 26, f'Conversion {word}.')]
    assert validate_answer(answer(CLAIM, 1, 4), rows)
    assert validate_answer(answer(NEUTRAL, 1), rows)


@pytest.mark.parametrize('mode', ['remove', 'select', 'unchanged', 'reason', 'foreign', 'other_page'])
def test_repair_preserves_original_page_scope_and_supported_sibling(mode):
    rows = sources() + [source(4, 26, 'Conversion table.'),
                        source(5, 26, 'Conversion table.', document='foreign'),
                        source(6, 99, 'Conversion table.')]
    stable = answer('General notes.', 3)['claims'][0]; calls = []
    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question']
        calls.append(question)
        if len(calls) == 1: return response(answer(CLAIM, 1)['claims'] + [stable])
        f = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert f['unsupported_source_qualifiers'] == ['tabular_layout']
        assert 'tabular' in question.lower() and 'remove' in question.lower()
        value = answer(NEUTRAL if mode == 'remove' else CLAIM,
                       *([1, 4] if mode == 'select' else [1, 5] if mode == 'foreign'
                         else [1, 6] if mode == 'other_page' else [1]))
        if mode == 'reason': value['reason'] = 'This is a table.'
        return response(value['claims']) if mode != 'reason' else httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(value)}}]})
    if mode in ['remove', 'select']:
        result = verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
        assert result['claims'][1]['text'] == stable['text']
        assert result['claims'][1]['citations'][0]['quote'] == rows[2]['text']
    else:
        with pytest.raises(ModelUnavailable, match='tabular'):
            verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    assert len(calls) == 2


def test_numeric_failure_carries_original_layout_scope():
    rows = sources() + [source(4, 99, HEADER + ' Conversion table.')]
    with pytest.raises(ModelUnavailable) as caught:
        validate_answer(answer(CLAIM + ' Reported value 42.', 1), rows)
    f = caught.value.feedback
    assert f['unsupported_numeric_values'] == ['42']
    assert f['unsupported_source_qualifiers'] == ['tabular_layout']
    with pytest.raises(ModelUnavailable, match='tabular'):
        validate_answer(answer(CLAIM + ' Reported value 42.', 3, 4), rows,
                        procedure_requirements={0: f['procedure_requirements']})
    assert validate_answer(answer(NEUTRAL + ' Reported value 42.', 1, 3), rows,
                           procedure_requirements={0: f['procedure_requirements']})


def test_multiple_restricted_pages_each_require_selected_support():
    rows = sources() + [source(4, 27, 'Conversion table.')]
    rows[2]['source_limit'] = VerifiedSourceLimit(id=1, reason="native_layout_unreliable", original_image_only=True)
    with pytest.raises(ModelUnavailable, match='tabular'):
        validate_answer(answer(CLAIM, 1, 4), rows)


def test_unverified_provenance_is_rejected():
    rows = sources(); rows[1]['source_limit'] = {'original_image_only': True}
    with pytest.raises(ModelUnavailable, match='Unverified'):
        validate_answer(answer(CLAIM, 1), rows)


@pytest.mark.parametrize('mode', ['no_restriction', 'foreign_restriction', 'other_page_restriction', 'substring', 'unasserted'])
def test_no_guessed_restriction_or_unasserted_layout_requirement(mode):
    rows = sources(); text = CLAIM
    if mode == 'no_restriction': rows.pop(1)
    elif mode == 'foreign_restriction': rows[1]['document_id'] = 'foreign'
    elif mode == 'other_page_restriction': rows[1]['page'] = 99
    elif mode == 'substring': text = 'Stable conversion formulas.'
    else: text = NEUTRAL
    assert validate_answer(answer(text, 1), rows)


def test_explicit_v16_preserves_recorded_acceptance():
    assert validate_answer(answer(CLAIM, 1), sources(), correction_policy='definition-subject-feedback-v16')


@pytest.mark.parametrize('repair', ['remove', 'foreign'])
def test_applicability_failure_keeps_layout_scope(repair):
    from .test_library_correction_schema import CONDITIONAL_OPERATIONS, UNQUALIFIED_CERTIFICATION, QUALIFIED_CERTIFICATION
    conditional = {**CONDITIONAL_OPERATIONS, 'document_id': 'doc_charts', 'passage_id': 4, 'page': 27, 'label': '27'}
    rows = sources() + [conditional, source(5, 99, HEADER + ' Conversion table.')]
    calls = []
    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question']; calls.append(question)
        if len(calls) == 1:
            return response(answer(CLAIM + ' ' + UNQUALIFIED_CERTIFICATION, 1, 4)['claims'])
        f = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert f['applicability_requirements']
        assert f['procedure_requirements']['tabular_layout_pages'] == [['doc_charts', 26]]
        assert len(f.get('qualification_excerpt_options', [])) + len(f['procedure_excerpt_options']) <= 6
        return response(answer((NEUTRAL if repair == 'remove' else CLAIM) + ' ' + QUALIFIED_CERTIFICATION,
                               *([1, 4] if repair == 'remove' else [4, 5]))['claims'])
    if repair == 'remove':
        assert verified_completion(model(provider), rows, 'Summarize', max_attempts=2)['claims']
    else:
        with pytest.raises(ModelUnavailable, match='tabular'):
            verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    assert len(calls) == 2


def test_optional_and_layout_failures_keep_both_private_diagnostics():
    with pytest.raises(ModelUnavailable) as caught:
        validate_answer(answer('An optional ' + CLAIM[2:], 1), sources())
    assert caught.value.feedback['unsupported_source_qualifiers'] == ['optional', 'tabular_layout']
