"""#600 noun forms of the same unsupported optional-status assertion."""
import json

import httpx
import pytest

from app.services.aircraft_library.models import ModelUnavailable, validate_answer, verified_completion
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_library_chart_dates import source, answer
from .test_library_correction_schema import model, response


@pytest.mark.parametrize('claim', [
    'Two-bladed propeller option: diameter 82 inches.',
    'Three-bladed propeller option: diameter 79 inches.',
    'Propeller options have diameters of 82 inches and 79 inches.',
])
def test_configuration_headings_do_not_establish_option_status(claim):
    rows = [source(1, 13, 'PROPELLER (2-Bladed) Diameter 82 inches. '
                            'PROPELLER (3-Bladed) Diameter 79 inches.')]
    with pytest.raises(ModelUnavailable, match='optional|option') as caught:
        validate_answer(answer(claim, 1), rows)
    assert caught.value.feedback['unsupported_source_qualifiers'] == ['optional']


@pytest.mark.parametrize('quoted', ['Propeller option listed.', 'Propeller options listed.',
                                    'An optional propeller is listed.', 'Propeller listed optionally.'])
@pytest.mark.parametrize('noun', ['option', 'options'])
def test_selected_explicit_family_word_supplies_negative_coverage(quoted, noun):
    rows = [source(1, 13, quoted)]
    assert validate_answer(answer(f'Propeller {noun} listed.', 1), rows)


@pytest.mark.parametrize('mode', ['unselected', 'metadata', 'restricted', 'foreign'])
def test_unavailable_noun_status_cannot_supply_coverage(mode):
    rows = [source(1, 13, 'Propeller diameter 82 inches.'),
            source(2, 13, 'Propeller options listed.')]
    ids = [1]
    if mode == 'metadata': rows[0]['metadata']['title'] = rows.pop()['text']
    elif mode == 'restricted': rows[1]['source_limit'] = VerifiedSourceLimit(original_image_only=True)
    elif mode == 'foreign': rows[1]['document_id'] = 'foreign'; ids.append(2)
    with pytest.raises(ModelUnavailable, match='optional|option'):
        validate_answer(answer('Propeller option: diameter 82 inches.', *ids), rows)


@pytest.mark.parametrize('repair', ['remove', 'select', 'unchanged', 'reason', 'foreign'])
def test_noun_repair_is_bounded_and_preserves_sibling_and_manual(repair):
    rows = [source(1, 13, 'Propeller diameter 82 inches.'),
            source(2, 13, 'Propeller options listed.'),
            source(3, 13, 'Propeller options listed.', document='foreign'),
            source(4, 14, 'Fuel is blue.')]
    stable = answer('Fuel is blue.', 4)['claims'][0]; calls = []
    def provider(request):
        question = json.loads(json.loads(request.content)['messages'][1]['content'])['question']
        calls.append(question)
        if len(calls) == 1:
            return response(answer('Propeller option: diameter 82 inches.', 1)['claims'] + [stable])
        feedback = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert feedback['unsupported_source_qualifiers'] == ['optional']
        value = answer('Propeller diameter 82 inches.' if repair == 'remove'
                       else 'Propeller option: diameter 82 inches.',
                       *([1, 2] if repair == 'select' else [1, 3] if repair == 'foreign' else [1]))
        if repair == 'reason': value['reason'] = 'Propeller options listed.'
        return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(value)}}]})
    if repair in ['remove', 'select']:
        value = verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
        assert value['claims'][1]['text'] == stable['text']
    else:
        with pytest.raises(ModelUnavailable, match='optional|option'):
            verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    assert len(calls) == 2


def test_numeric_first_repair_retains_original_option_manual():
    rows = [source(1, 13, 'Propeller diameter 79 inches.'),
            source(2, 13, 'Propeller diameter 82 inches.'),
            source(3, 13, 'Propeller option.', document='foreign')]
    with pytest.raises(ModelUnavailable) as caught:
        validate_answer(answer('Propeller option: diameter 82 inches.', 1), rows)
    f = caught.value.feedback
    assert f['unsupported_numeric_values'] == ['82']
    assert f['unsupported_source_qualifiers'] == ['optional']
    with pytest.raises(ModelUnavailable, match='optional|option'):
        validate_answer(answer('Propeller option: diameter 82 inches.', 2, 3), rows,
                        procedure_requirements={0: f['procedure_requirements']})
    assert validate_answer(answer('Propeller diameter 82 inches.', 2), rows,
                           procedure_requirements={0: f['procedure_requirements']})


@pytest.mark.parametrize('policy', ['source-phrase-feedback-v13', 'optional-status-feedback-v14'])
def test_explicit_prior_policies_keep_recorded_noun_behavior(policy):
    rows = [source(1, 13, 'Propeller diameter 82 inches.')]
    assert validate_answer(answer('Propeller option: diameter 82 inches.', 1), rows,
                           correction_policy=policy)


def test_adoption_is_not_an_option_status_word():
    rows = [source(1, 13, 'The propeller design was adopted.')]
    assert validate_answer(answer('Adoption of the propeller design is documented.', 1), rows)
