"""#598 prospective coverage checks, not semantic approval or actual inference seeds."""
import copy
import json

import httpx
import pytest

from app.services.aircraft_library.models import ModelUnavailable, validate_answer, verified_completion
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_library_chart_dates import source, answer
from .test_library_correction_schema import model, response

CONDITIONS = 'Performance figures are based on indicated weights, standard atmospheric conditions, level hard-surface dry runways and no wind.'
TAIL = 'They are calculated values derived from flight tests and vary with individual airplanes.'
CLAIM = CONDITIONS + ' ' + TAIL


def sources():
    return [source(1,4,CONDITIONS), source(2,4,TAIL),
            source(3,5,'General notes. Reported value 42.')]


def test_actual_unselected_conditions_sentence_requires_its_supplied_quote():
    with pytest.raises(ModelUnavailable,match='support') as caught:
        validate_answer(answer(CLAIM,2),sources())
    f=caught.value.feedback
    assert f['procedure_requirements']['source_phrases']
    assert f['missing_procedure_citation_conditions']
    assert any(x['passage_id']==1 for x in f['procedure_excerpt_options'])


@pytest.mark.parametrize('text',[
    'The service inspection requires thorough examination before additional operation.',
    'The structural bracket supports the auxiliary assembly during installation.',
    'The archive contains detailed revision descriptions for later maintenance.',
])
def test_unrelated_prose_has_the_same_selected_coverage_requirement(text):
    rows=[source(1,1,text),source(2,1,'General notes.')]
    with pytest.raises(ModelUnavailable,match='support'):validate_answer(answer(text,2),rows)
    assert validate_answer(answer(text,1),rows)


@pytest.mark.parametrize('text',[CLAIM,CONDITIONS,'Performance figures based on the indicated weights, standard atmospheric conditions, level hard surface dry runways and no wind.'])
def test_complete_supported_partial_and_matching_view(text):
    assert validate_answer(answer(text,1,2),sources())['claims'][0]['text']==text


def test_selected_same_page_fragments_support_a_phrase_collectively():
    rows=[source(1,4,'Standard atmospheric conditions and level dry runways.'),
          source(2,4,'Standard atmospheric'),source(3,4,'conditions and level dry runways.')]
    assert validate_answer(answer('Standard atmospheric conditions and level dry runways.',2,3),rows)


@pytest.mark.parametrize('mode',['absent','restricted','foreign','metadata','short'])
def test_no_anchor_is_invented_from_unavailable_or_too_short_source(mode):
    rows=sources();text=CONDITIONS
    if mode=='absent':rows=rows[1:]
    elif mode=='restricted':rows[0]['source_limit']=VerifiedSourceLimit(original_image_only=True)
    elif mode=='foreign':rows[0]['document_id']='doc_foreign'
    elif mode=='metadata':rows[0]['text']='General notes.';rows[0]['metadata']['title']=CONDITIONS
    else:rows[0]['text']='Standard atmosphere.';text='Standard atmosphere.'
    assert validate_answer(answer(text,2),rows)


@pytest.mark.parametrize('mode',['foreign','other_page'])
def test_selected_phrase_on_another_context_is_not_original_support(mode):
    rows=sources();foreign=copy.deepcopy(rows[0]);foreign['passage_id']=4
    if mode=='foreign':foreign['document_id']='doc_foreign'
    else:foreign['page']=9
    with pytest.raises(ModelUnavailable) as first:validate_answer(answer(CLAIM,2),rows)
    rows.append(foreign)
    with pytest.raises(ModelUnavailable,match='support'):
        validate_answer(answer(CLAIM,2,4),rows,procedure_requirements={0:first.value.feedback['procedure_requirements']})


@pytest.mark.parametrize('evasion',['drop','negate','reason_only','foreign'])
def test_repair_preserves_original_source_phrase_and_manual(evasion):
    rows=sources()+[source(4,4,CLAIM,document='doc_foreign')];calls=[]
    def provider(request):
        question=json.loads(json.loads(request.content)['messages'][1]['content'])['question'];calls.append(question)
        if len(calls)==1:return response(answer(CLAIM,2)['claims'])
        f=json.loads(question.rsplit('\n',1)[-1])['rejected_claims'][0]
        assert f['procedure_requirements']['source_phrases']
        if evasion=='foreign':value=answer(CLAIM,4)
        elif evasion=='negate':value=answer('Not '+CONDITIONS,1)
        else:value=answer('General notes.',3)
        if evasion=='reason_only':value['reason']=CLAIM
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps(value)}}]})
    with pytest.raises(ModelUnavailable,match='support'):verified_completion(model(provider),rows,'Summarize',max_attempts=2)
    assert len(calls)==2


@pytest.mark.parametrize('retain',[True,False])
def test_numeric_first_failure_preserves_phrases_and_valid_sibling(retain):
    rows=sources();calls=[];stable=answer('General notes.',3)['claims'][0]
    def provider(request):
        question=json.loads(json.loads(request.content)['messages'][1]['content'])['question'];calls.append(question)
        if len(calls)==1:return response(answer(CONDITIONS+' Reported value 42.',2)['claims']+[stable])
        f=json.loads(question.rsplit('\n',1)[-1])['rejected_claims'][0]
        assert f['unsupported_numeric_values']==['42'] and f['procedure_requirements']['source_phrases']
        return response(answer((CONDITIONS+' ' if retain else '')+'Reported value 42.',1,2,3)['claims'])
    if retain:
        result=verified_completion(model(provider),rows,'Summarize',max_attempts=2)
        assert result['claims'][1]['text']==stable['text']
        assert result['claims'][1]['citations'][0]['quote']==rows[2]['text']
    else:
        with pytest.raises(ModelUnavailable,match='support'):verified_completion(model(provider),rows,'Summarize',max_attempts=2)
    assert len(calls)==2


def test_many_matches_are_bounded_and_witnesses_remain_verbatim():
    rows=[source(i,4,f'The {word} bracket supports {word} instruments during {word} assembly.') for i,word in enumerate(['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa'],1)]
    rows.append(source(99,4,'General notes.'))
    text=' '.join(r['text'] for r in rows[:-1])
    with pytest.raises(ModelUnavailable) as caught:validate_answer(answer(text,99),rows)
    f=caught.value.feedback;req=f['procedure_requirements']['source_phrases'];assert len(req)==6
    assert all(3<=len(r['tokens'])<=12 and not any(any(c.isdigit() for c in t) for t in r['tokens']) for r in req)
    opts=f['procedure_excerpt_options'];assert 1<=len(opts)<=6
    byid={r['passage_id']:r for r in rows};assert all(len(o['text'])<=1200 and o['text']==byid[o['passage_id']]['text'] for o in opts)


def test_foreign_repair_cannot_expand_original_witnesses():
    rows=sources()
    with pytest.raises(ModelUnavailable) as first:validate_answer(answer(CLAIM,2),rows)
    rows.append(source(4,4,CLAIM,document='doc_foreign'))
    with pytest.raises(ModelUnavailable) as repair:
        validate_answer(answer(CLAIM,4),rows,procedure_requirements={0:first.value.feedback['procedure_requirements']})
    req=repair.value.feedback['procedure_requirements']['source_phrases'];assert {x['document_id'] for x in req}=={'doc_charts'}
    assert all(o['passage_id']!=4 for o in repair.value.feedback['procedure_excerpt_options'])


def test_recorded_v12_is_not_revalidated_under_new_rules():
    assert validate_answer(answer(CLAIM,2),sources(),correction_policy='flap-color-feedback-v12')


@pytest.mark.parametrize("prior_policy", ["flap-color-feedback-v12", "source-phrase-feedback-v13"])
def test_new_policy_archives_prior_claims_and_receipt_then_starts_zero(tmp_path, prior_policy):
    from app.services.aircraft_library.models import CORRECTION_POLICY, distillation_context, distill
    from app.services.aircraft_library.store import Store
    from .test_aircraft_library import manual
    from .test_aircraft_library_resume import Provider, ProcessKilled

    store = Store(tmp_path / 'library')
    raw = manual('General inspection notes. ' + 'Inspect controls before servicing. ' * 45,
                 'Definitions supplied in the manual.')
    doc = store.ingest(raw, {'icao': 'C172'})
    provider = Provider()
    _, roots, question, fingerprint = distillation_context(store, provider, doc['id'], correction_policy=prior_policy)
    section = dict(pages=sorted({r['page'] for r in roots[0]}), **validate_answer(provider.complete(roots[0], question), roots[0], correction_policy=prior_policy))
    prior = dict(kind='llm_distillation', status='partial', correction_policy=prior_policy, evidence_identity=fingerprint,
                 sections=[section], completed_batches=1, total_batches=len(roots), batch_plan=[[r['passage_id'] for r in b] for b in roots],
                 recovery={'kind': 'recorded-v12-control-receipt', 'request_scopes_unchanged': True})
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



@pytest.mark.parametrize('text',[
    'Inspect or repair damaged wiring before another flight.',
    'Do not perform further operation before inspection.',
    'Operation is allowed only if the required condition is satisfied.',
])
def test_alternatives_negation_and_conditions_are_kept_in_the_matching_view(text):
    rows=[source(1,1,text),source(2,1,'General notes.')]
    with pytest.raises(ModelUnavailable) as caught:validate_answer(answer(text,2),rows)
    req=caught.value.feedback['procedure_requirements']['source_phrases']
    tokens={t for r in req for t in r['tokens']}
    expected={'or'} if ' or ' in text else ({'not'} if 'not ' in text else {'only','if'})
    assert expected<=tokens
    assert validate_answer(answer(text,1),rows)


def test_numeric_tokens_form_barriers_in_phrase_requirements():
    text='The approved engine pressure 120 PSI requires regular inspection before additional operation.'
    rows=[source(1,1,text),source(2,1,'The reported value is 120 PSI.')]
    with pytest.raises(ModelUnavailable) as caught:validate_answer(answer(text,2),rows)
    req=caught.value.feedback['procedure_requirements']['source_phrases']
    assert all(not any(c.isdigit() for c in t) for r in req for t in r['tokens'])
    assert validate_answer(answer(text,1),rows)


@pytest.mark.parametrize('text',['mètres pieds','mètres pieds'])
def test_unicode_words_are_not_split_into_invented_three_word_anchors(text):
    rows=[source(1,1,text),source(2,1,'General notes.')]
    assert validate_answer(answer(text,2),rows)


def test_unicode_literal_phrase_requires_and_accepts_original_support():
    text='Les limites spécifiques sont décrites dans ce manuel.'
    rows=[source(1,1,text),source(2,1,'General notes.')]
    with pytest.raises(ModelUnavailable,match='support'):validate_answer(answer(text,2),rows)
    assert validate_answer(answer(text,1),rows)


def test_source_phrases_and_existing_families_share_six_options():
    rows=sources()+[source(10,4,'On flap control indicator: dark blue, light blue, white.')]
    rows.extend(source(i,4,'White color code. Standard atmospheric conditions and level dry runways.') for i in range(11,25))
    text=CLAIM+' Flap control indicator: dark blue, light blue, white.'
    with pytest.raises(ModelUnavailable) as caught:validate_answer(answer(text,2),rows)
    f=caught.value.feedback;assert f['procedure_requirements']['source_phrases'] and f['procedure_requirements']['flap_colors']
    assert len(f['procedure_excerpt_options'])==6
