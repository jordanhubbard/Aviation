"""#600 prospective negative coverage controls, not semantic approval."""
import json

import httpx
import pytest

from app.services.aircraft_library.models import ModelUnavailable, validate_answer, verified_completion
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_library_chart_dates import source, answer
from .test_library_correction_schema import model, response


@pytest.mark.parametrize('text', ['The optional propeller has two blades.',
                                 'The propeller is optionally installed.'])
def test_status_absent_from_selected_quote_rejected(text):
    rows = [source(1, 13, 'The propeller has two blades.')]
    with pytest.raises(ModelUnavailable, match='optional') as caught:
        validate_answer(answer(text, 1), rows)
    assert caught.value.feedback['unsupported_source_qualifiers'] == ['optional']


@pytest.mark.parametrize('word', ['optional', 'optionally'])
def test_explicit_selected_status_is_supported(word):
    rows = [source(1, 13, f'The propeller is {word} installed.')]
    assert validate_answer(answer('The optional propeller is installed.', 1), rows)


@pytest.mark.parametrize('mode', ['unselected', 'metadata', 'restricted', 'foreign'])
def test_unavailable_status_cannot_support_claim(mode):
    rows = [source(1, 13, 'The propeller is installed.'),
            source(2, 13, 'The propeller is optional.')]
    ids = [1]
    if mode == 'metadata':
        rows[0]['metadata']['title'] = rows.pop()['text']
    elif mode == 'restricted':
        rows[1]['source_limit'] = VerifiedSourceLimit(original_image_only=True)
    elif mode == 'foreign':
        rows[1]['document_id'] = 'foreign'; ids.append(2)
    with pytest.raises(ModelUnavailable, match='optional'):
        validate_answer(answer('The optional propeller is installed.', *ids), rows)


def test_selected_additional_supplied_excerpt_repairs_status():
    rows = [source(1, 13, 'The propeller is installed.'),
            source(2, 13, 'The propeller is optional.')]
    with pytest.raises(ModelUnavailable):
        validate_answer(answer('The optional propeller is installed.', 1), rows)
    assert validate_answer(answer('The optional propeller is installed.', 1, 2), rows)


@pytest.mark.parametrize('repair', ['remove', 'select', 'unchanged', 'reason', 'foreign'])
def test_bounded_repair_preserves_sibling_and_manual(repair):
    rows = [source(1, 13, 'The propeller has two blades.'),
            source(2, 13, 'The propeller is optional.'),
            source(3, 13, 'The propeller is optional.', document='foreign'),
            source(4, 14, 'The fuel is blue.')]
    stable = answer('The fuel is blue.', 4)['claims'][0]; calls = []
    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question']
        calls.append(question)
        if len(calls) == 1:
            return response(answer('The optional propeller has two blades.', 1)['claims'] + [stable])
        feedback = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert feedback['unsupported_source_qualifiers'] == ['optional']
        assert 'remove' in question.lower()
        value = answer('The propeller has two blades.' if repair == 'remove'
                       else 'The optional propeller has two blades.',
                       *([1, 2] if repair == 'select' else [1, 3] if repair == 'foreign' else [1]))
        if repair == 'reason': value['reason'] = 'The propeller is optional.'
        return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(value)}}]})
    if repair in ['remove', 'select']:
        result = verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
        assert result['claims'][1]['text'] == stable['text']
    else:
        with pytest.raises(ModelUnavailable, match='optional'):
            verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    assert len(calls) == 2


def test_numeric_first_failure_carries_optional_manual_context():
    rows = [source(1, 13, 'Propeller diameter 82 inches.'),
            source(2, 13, 'Propeller diameter 79 inches.'),
            source(3, 13, 'The propeller is optional.', document='foreign')]
    with pytest.raises(ModelUnavailable) as caught:
        validate_answer(answer('The optional propeller diameter is 82 inches.', 2), rows)
    f = caught.value.feedback
    assert f['unsupported_numeric_values'] == ['82']
    assert f['unsupported_source_qualifiers'] == ['optional']
    with pytest.raises(ModelUnavailable, match='optional'):
        validate_answer(answer('The optional propeller diameter is 82 inches.', 1, 3), rows,
                        procedure_requirements={0: f['procedure_requirements']})
    assert validate_answer(answer('Propeller diameter 82 inches.', 1), rows,
                           procedure_requirements={0: f['procedure_requirements']})


def test_explicit_v13_preserves_recorded_behavior():
    rows = [source(1, 13, 'The propeller has two blades.')]
    assert validate_answer(answer('The optional propeller has two blades.', 1), rows,
                           correction_policy='source-phrase-feedback-v13')


def test_no_substring_or_unasserted_status_requirement():
    rows = [source(1, 13, 'Configuration options include a propeller.')]
    assert validate_answer(answer('Configuration options include a propeller.', 1), rows)
