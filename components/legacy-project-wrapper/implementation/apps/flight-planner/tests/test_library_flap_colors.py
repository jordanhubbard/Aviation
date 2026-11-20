"""#596 prospective selected-color controls; diagnostic fixtures, never inference seeds."""
import copy
import json

import pytest

from app.services.aircraft_library.models import ModelUnavailable, validate_answer, verified_completion
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_library_chart_dates import source, answer
from .test_library_correction_schema import model, response

TEXT = 'Flap control indicator: dark blue, light blue, and white.'


def sources():
    return [source(1, 46, 'On flap control indicator: dark blue color code. (Light '),
            source(2, 46, 'blue color code.) White color code.'),
            source(3, 47, 'General notes. Reported value 42.')]


def test_actual_split_word_does_not_supply_the_unselected_white_label():
    with pytest.raises(ModelUnavailable, match='support') as caught:
        validate_answer(answer(TEXT, 1), sources())
    f = caught.value.feedback
    assert f['procedure_requirements']['flap_colors']
    assert 'flap_color:white' in f['missing_procedure_citation_conditions']
    assert any(o['passage_id'] == 2 for o in f['procedure_excerpt_options'])


@pytest.mark.parametrize('text,ids', [(TEXT,(1,2)), ('Flap control indicator: dark blue.',(1,)),
                                      ('General notes.',(3,))])
def test_selected_collective_partial_and_unrelated_claims(text, ids):
    assert validate_answer(answer(text,*ids),sources())['claims'][0]['text']==text


def test_split_same_page_color_words_can_be_collectively_supported():
    rows=sources(); rows[1]['text']='blue color code. White color code.'
    assert validate_answer(answer(TEXT,1,2),rows)


@pytest.mark.parametrize('mode',['foreign','another_page'])
def test_matching_foreign_or_other_page_color_is_not_support(mode):
    rows=sources();r=copy.deepcopy(rows[1]);r['passage_id']=4
    if mode=='foreign':r['document_id']='doc_foreign'
    else:r['page']=48
    rows.append(r)
    with pytest.raises(ModelUnavailable,match='support'):
        validate_answer(answer(TEXT,1,4),rows)


@pytest.mark.parametrize('mode',['absent','restricted','foreign'])
def test_unavailable_color_source_does_not_invent_obligations(mode):
    rows=sources()
    if mode=='absent':rows=rows[:1]
    elif mode=='restricted':rows[1]['source_limit']=VerifiedSourceLimit(original_image_only=True)
    else:rows[1]['document_id']='doc_foreign'
    # Only dark-blue is discoverable; the guard does not invent unavailable labels.
    assert validate_answer(answer(TEXT,1),rows)


@pytest.mark.parametrize('evasion',['drop','topic','topic_negate','negate','foreign','reason_only'])
def test_repair_keeps_original_color_topic_page_and_manual(evasion):
    rows=sources();rows.append(source(4,46,'On flap control indicator: dark blue, light blue, white.',document='doc_foreign'));calls=[]
    def provider(request):
        question=json.loads(json.loads(request.content)['messages'][1]['content'])['question'];calls.append(question)
        if len(calls)==1:return response(answer(TEXT,1)['claims'])
        f=json.loads(question.rsplit('\n',1)[-1])['rejected_claims'][0]
        assert f['procedure_requirements']['flap_colors']
        choices={'drop':('General notes.',(3,)), 'topic':('Dark blue, light blue, white.',(1,2)),
                 'topic_negate':('Not flap control indicator: dark blue, light blue, white.',(1,2)),
                 'negate':('Flap control indicator: dark blue, light blue, not white.',(1,2)),
                 'foreign':(TEXT,(4,)), 'reason_only':('General notes.',(3,))}
        text,ids=choices[evasion];return response(answer(text,*ids)['claims'])
    with pytest.raises(ModelUnavailable,match='support'):
        verified_completion(model(provider),rows,'Summarize',max_attempts=2)
    assert len(calls)==2


@pytest.mark.parametrize('retain',[True,False])
def test_numeric_first_failure_preserves_color_obligations_and_sibling(retain):
    rows=sources();calls=[];stable=answer('General notes.',3)['claims'][0]
    def provider(request):
        question=json.loads(json.loads(request.content)['messages'][1]['content'])['question'];calls.append(question)
        if len(calls)==1:return response(answer(TEXT+' Reported value 42.',1)['claims']+[stable])
        f=json.loads(question.rsplit('\n',1)[-1])['rejected_claims'][0]
        assert f['unsupported_numeric_values']==['42'] and f['procedure_requirements']['flap_colors']
        return response(answer((TEXT+' ' if retain else '')+'Reported value 42.',1,2,3)['claims'])
    if retain:
        result=verified_completion(model(provider),rows,'Summarize',max_attempts=2)
        assert result['claims'][1]['text']==stable['text']
    else:
        with pytest.raises(ModelUnavailable,match='support'):verified_completion(model(provider),rows,'Summarize',max_attempts=2)
    assert len(calls)==2


def test_recorded_v11_does_not_gain_new_validation():
    assert validate_answer(answer(TEXT,1),sources(),correction_policy='chart-date-feedback-v11')


def test_shared_witness_budget_keeps_verbatim_supplied_text():
    rows=sources()+[source(i,46,'White color code.') for i in range(10,25)]
    with pytest.raises(ModelUnavailable) as caught:validate_answer(answer(TEXT,1),rows)
    opts=caught.value.feedback['procedure_excerpt_options'];assert 1<=len(opts)<=6
    byid={r['passage_id']:r for r in rows}
    assert all(len(o['text'])<=1200 and o['text']==byid[o['passage_id']]['text'] for o in opts)


def test_foreign_repair_does_not_extend_bound_witness_context():
    rows=sources()
    with pytest.raises(ModelUnavailable) as first:validate_answer(answer(TEXT,1),rows)
    rows.append(source(4,46,'On flap control indicator: dark blue, light blue, white.',document='doc_foreign'))
    with pytest.raises(ModelUnavailable) as repair:
        validate_answer(answer(TEXT,4),rows,procedure_requirements={0:first.value.feedback['procedure_requirements']})
    assert {r['document_id'] for r in repair.value.feedback['procedure_requirements']['flap_colors']}=={'doc_charts'}
    assert all(o['passage_id']!=4 for o in repair.value.feedback['procedure_excerpt_options'])


def test_new_policy_archives_v11_claims_and_receipt_then_starts_zero(tmp_path):
    from app.services.aircraft_library.models import CORRECTION_POLICY, distillation_context, distill
    from app.services.aircraft_library.store import Store
    from .test_aircraft_library import manual
    from .test_aircraft_library_resume import Provider, ProcessKilled

    store = Store(tmp_path / 'library')
    raw = manual('General inspection notes. ' + 'Inspect controls before servicing. ' * 45,
                 'Definitions supplied in the manual.')
    doc = store.ingest(raw, {'icao': 'C172'})
    provider = Provider()
    _, roots, question, fingerprint = distillation_context(store, provider, doc['id'], correction_policy='chart-date-feedback-v11')
    section = dict(pages=sorted({r['page'] for r in roots[0]}), **validate_answer(provider.complete(roots[0], question), roots[0], correction_policy='chart-date-feedback-v11'))
    prior = dict(kind='llm_distillation', status='partial', correction_policy='chart-date-feedback-v11', evidence_identity=fingerprint,
                 sections=[section], completed_batches=1, total_batches=len(roots), batch_plan=[[r['passage_id'] for r in b] for b in roots],
                 recovery={'kind': 'recorded-v11-control-receipt', 'request_scopes_unchanged': True})
    store.artifact(doc['id'], 'distillation', prior)
    before = copy.deepcopy(store.passages([doc['id']]))
    provider.calls.clear(); provider.kill_at = 1
    with pytest.raises(ProcessKilled):
        distill(store, provider, doc['id'])
    fresh = store.get(doc['id'])['artifacts']['distillation']
    assert CORRECTION_POLICY == fresh['correction_policy'] == 'option-noun-feedback-v15'
    assert fresh['completed_batches'] == 0 and fresh['sections'] == [] and 'recovery' not in fresh
    assert fresh['evidence_identity'] != fingerprint
    assert any(store.historical_distillation(doc['id'],r['revision_id'])['artifact'] == prior for r in store.distillations(doc['id'])['items'])
    assert store.passages([doc['id']]) == before and store.original(doc['id']).read_bytes() == raw and provider.embeds == []

