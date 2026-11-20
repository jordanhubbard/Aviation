"""#614 prospective controls; never seeds for actual model qualification."""
import copy
import json

import pytest

from app.services.aircraft_library.models import ModelUnavailable, validate_answer, verified_completion
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_library_chart_dates import source, answer
from .test_library_correction_schema import model, response


TITLE = 'Textr 182S Skylane 182StM'
BAD = 'The Cessna Model 182S manual is titled ' + TITLE + '.'
GOOD = 'The source states Cessna Model 182S.'


def sources():
    rows = [source(1, 29, 'SECTION 1 GENERAL CESSNA MODEL 182S.'),
            source(2, 1, TITLE), source(3, 30, 'Reported value 42.')]
    for row in rows:
        row['metadata'] = {'title': TITLE, 'icao': 'C182'}
    return rows


@pytest.mark.parametrize('title', [TITLE, TITLE.lower(), TITLE.upper(),
    'Textr  182S\nSkylane\t182StM', 'Textr—182S, Skylane: 182StM'])
def test_copied_title_requires_selected_original_support(title):
    with pytest.raises(ModelUnavailable, match='title|support') as caught:
        validate_answer(answer(BAD.replace(TITLE, title), 1), sources())
    f = caught.value.feedback
    assert f['procedure_requirements']['catalog_titles']
    assert 'catalog_title' in f['unsupported_source_qualifiers']
    assert f['procedure_excerpt_options'][0]['passage_id'] == 2


@pytest.mark.parametrize('mode', ['selected', 'split_same_page', 'unasserted', 'no_title',
                                  'unrelated_metadata', 'different_title'])
def test_supported_and_unasserted_titles_do_not_invent_obligations(mode):
    rows = sources();text = BAD;ids = (1, 2)
    if mode == 'split_same_page':
        rows[1]['text'] = 'Textr 182S';rows.append(source(4, 1, 'Skylane 182StM'));ids = (1, 2, 4)
    elif mode == 'unasserted': text = GOOD;ids = (1,)
    elif mode == 'no_title': rows[0]['metadata'] = {};ids = (1,)
    elif mode == 'unrelated_metadata': rows[0]['metadata'] = {'notes': TITLE};ids = (1,)
    elif mode == 'different_title': rows[0]['metadata']['title'] = 'Other catalog label';ids = (1,)
    assert validate_answer(answer(text, *ids), rows)


@pytest.mark.parametrize('mode', ['unselected', 'foreign', 'restricted', 'split_pages', 'identifier_change'])
def test_support_cannot_come_from_wrong_source_or_changed_identifier(mode):
    rows = sources();ids = (1, 2)
    if mode == 'unselected': ids = (1,)
    elif mode == 'foreign': rows[1]['document_id'] = 'doc_foreign'
    elif mode == 'restricted': rows[1]['source_limit'] = VerifiedSourceLimit(original_image_only=True);ids = (1,)
    elif mode == 'split_pages':
        rows[1]['text'] = 'Textr 182S';rows.append(source(4, 2, 'Skylane 182StM'));ids = (1, 2, 4)
    else: rows[1]['text'] = 'Textr 182S Skylane 182SIM'
    with pytest.raises(ModelUnavailable, match='title|support'):
        validate_answer(answer(BAD, *ids), rows)


@pytest.mark.parametrize('numeric_first', [False, True])
@pytest.mark.parametrize('repair', ['remove', 'select', 'foreign', 'persist'])
def test_normal_repairs_keep_sibling_bounds_and_original_title_document(numeric_first, repair):
    rows = sources();foreign = copy.deepcopy(rows[1]);foreign.update(passage_id=4, document_id='doc_foreign')
    rows.append(foreign);calls = [];stable = answer('Reported value 42.', 3)['claims'][0]
    def provider(request):
        payload = json.loads(request.content);calls.append(payload)
        question = json.loads(payload['messages'][1]['content'])['question']
        if len(calls) == 1:
            return response(answer(BAD + (' Reported value 42.' if numeric_first else ''), 1)['claims'] + [stable])
        f = json.loads(question.rsplit('\n', 1)[-1])['rejected_claims'][0]
        assert f['procedure_requirements']['catalog_titles']
        assert len(f['procedure_excerpt_options']) <= 6
        assert all(len(x['text']) <= 1200 for x in f['procedure_excerpt_options'])
        if repair == 'remove': return response(answer(GOOD, 1)['claims'])
        return response(answer(BAD, 1, 2 if repair == 'select' else 4 if repair == 'foreign' else 1)['claims'])
    if repair in ['foreign', 'persist']:
        with pytest.raises(ModelUnavailable, match='title|support'):
            verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
    else:
        result = verified_completion(model(provider), rows, 'Summarize', max_attempts=2)
        assert result['claims'][1]['text'] == stable['text']
        assert result['claims'][1]['citations'][0]['quote'] == rows[2]['text']
    assert len(calls) == 2
    assert calls[0]['response_format']['json_schema']['schema']['properties']['claims']['maxItems'] == 12


def test_other_manuals_and_labels_are_derived_without_actual_catalog_constants():
    rows = [source(1, 7, 'ACME TYPE QX. Value 42.'), source(2, 1, 'Acme QX Reference')]
    rows[0]['metadata']['title'] = 'Acme QX Reference'
    with pytest.raises(ModelUnavailable, match='title|support'):
        validate_answer(answer('Manual titled Acme QX Reference.', 1), rows)
    assert validate_answer(answer('Manual titled Acme QX Reference.', 1, 2), rows)


def test_explicit_v19_behavior_is_preserved():
    assert validate_answer(answer(BAD, 1), sources(), correction_policy='sheet-date-status-feedback-v19')


def test_literal_witnesses_share_existing_bound():
    rows = sources() + [source(i, 1, TITLE) for i in range(10, 30)]
    with pytest.raises(ModelUnavailable, match='title|support') as caught:
        validate_answer(answer(BAD, 1), rows)
    options = caught.value.feedback['procedure_excerpt_options']
    assert len(options) == 6
    assert all(x['text'] == next(r['text'] for r in rows if r['passage_id'] == x['passage_id']) for x in options)


@pytest.mark.parametrize('split', [False, True])
def test_valid_literal_substring_quotes_can_support_printed_title(split):
    rows = sources()
    rows[1]['text'] = 'Printed heading\n' + ('Textr 182S' if split else TITLE) + '\nFooter'
    citations = [dict(passage_id=1, excerpt_id=0),
                 dict(passage_id=2, quote='Textr 182S' if split else TITLE)]
    if split:
        rows.append(source(4, 1, 'Another heading\nSkylane 182StM\nFooter'))
        citations.append(dict(passage_id=4, quote='Skylane 182StM'))
    value = answer(BAD, 1);value['claims'][0]['citations'] = citations
    assert validate_answer(value, rows)['claims'][0]['text'] == BAD
