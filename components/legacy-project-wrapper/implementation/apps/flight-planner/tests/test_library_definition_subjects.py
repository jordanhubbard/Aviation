"""#604 prospective literal subject coverage, not definition entailment approval."""
import copy
import json

import httpx
import pytest

from app.services.aircraft_library.models import ModelUnavailable, validate_answer, verified_completion
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_library_chart_dates import source, answer
from .test_library_correction_schema import model, response

OPENING = 'Center of Gravity is the point at which an airplane would balance if suspended. Its distance from the reference '
TAIL = "datum is found by dividing total moment by total weight. Center of Gravity Arm is obtained by adding individual moments. Center of Gravity Limits are the extreme permitted locations."
CLAIM = 'Center of Gravity is the balance point found by dividing total moment by total weight.'


def sources():
    return [source(1,20,OPENING), source(2,20,TAIL), source(3,21,'General notes. Reported value 42.')]


def test_actual_definition_opening_is_not_supplied_by_longer_neighbor_terms():
    with pytest.raises(ModelUnavailable,match='support') as caught:validate_answer(answer(CLAIM,2),sources())
    f=caught.value.feedback;req=f['procedure_requirements']['source_definitions']
    assert len(req)==1 and req[0]['subject']=='center of gravity'
    assert 'definition_subject:center of gravity' in f['missing_procedure_citation_conditions']
    assert any(x['passage_id']==1 for x in f['procedure_excerpt_options'])
    assert validate_answer(answer(CLAIM,1,2),sources())


@pytest.mark.parametrize('subject,copula', [('Pressure Regulator','is'),('Auxiliary Controls','are'),('Service Interval','means'),('Structural Support Bracket','is')])
def test_unrelated_subjects_are_derived_from_supplied_source(subject,copula):
    text=f'{subject} {copula} the assembly operating normally.'
    rows=[source(1,1,text),source(2,1,'General notes.')]
    with pytest.raises(ModelUnavailable) as e:validate_answer(answer(f'{subject} {copula} available.',2),rows)
    assert e.value.feedback['procedure_requirements']['source_definitions'][0]['subject']==subject.casefold()
    assert validate_answer(answer(f'{subject} {copula} available.',1),rows)


@pytest.mark.parametrize('mode',['absent','restricted','foreign','metadata','split','single_word'])
def test_no_obligation_from_unavailable_unsupplied_or_split_subject(mode):
    rows=sources();text=CLAIM
    if mode=='absent':rows=rows[1:]
    elif mode=='restricted':rows[0]['source_limit']=VerifiedSourceLimit(original_image_only=True)
    elif mode=='foreign':rows[0]['document_id']='foreign'
    elif mode=='metadata':rows[0]['metadata']['title']=rows[0]['text'];rows[0]['text']='General notes.'
    elif mode=='split':rows[0]['text']='Center of Gravity';rows.append(source(4,20,'is the point of balance.'))
    else:rows[0]['text']='Gravity is acceleration.';text='Gravity is constant.'
    assert validate_answer(answer(text,2),rows)


@pytest.mark.parametrize('mode',['drop','reason_only','foreign','other_page'])
def test_original_subject_and_scope_survive_repair(mode):
    rows=sources()+[source(4,20,OPENING,document='foreign'),source(5,99,OPENING)]
    calls=[];stable=answer('General notes.',3)['claims'][0]
    def provider(request):
        question=json.loads(json.loads(request.content)['messages'][1]['content'])['question'];calls.append(question)
        if len(calls)==1:return response(answer(CLAIM,2)['claims']+[stable])
        f=json.loads(question.rsplit('\n',1)[-1])['rejected_claims'][0]
        assert f['procedure_requirements']['source_definitions'][0]['subject']=='center of gravity'
        value=answer('General notes.' if mode in ['drop','reason_only'] else CLAIM, *([3] if mode in ['drop','reason_only'] else [2,4 if mode=='foreign' else 5]))
        if mode=='reason_only':value['reason']=CLAIM
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps(value)}}]})
    with pytest.raises(ModelUnavailable,match='support'):verified_completion(model(provider),rows,'Summarize',max_attempts=2)
    assert len(calls)==2


@pytest.mark.parametrize('retain',[True,False])
def test_numeric_first_failure_keeps_subject_and_valid_sibling(retain):
    rows=sources();calls=[];stable=answer('General notes.',3)['claims'][0]
    def provider(request):
        question=json.loads(json.loads(request.content)['messages'][1]['content'])['question'];calls.append(question)
        if len(calls)==1:return response(answer(CLAIM+' Reported value 42.',2)['claims']+[stable])
        f=json.loads(question.rsplit('\n',1)[-1])['rejected_claims'][0]
        assert f['unsupported_numeric_values']==['42'] and f['procedure_requirements']['source_definitions']
        return response(answer((CLAIM+' ' if retain else '')+'Reported value 42.',1,2,3)['claims'])
    if retain:
        result=verified_completion(model(provider),rows,'Summarize',max_attempts=2)
        assert result['claims'][1]['text']==stable['text'] and result['claims'][1]['citations'][0]['quote']==rows[2]['text']
    else:
        with pytest.raises(ModelUnavailable,match='support'):verified_completion(model(provider),rows,'Summarize',max_attempts=2)
    assert len(calls)==2


def test_many_missing_subjects_keep_existing_witness_bounds():
    rows=[source(i,1,f'{word} Assembly is provided.') for i,word in enumerate(['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta'],1)]
    rows.append(source(99,1,'General notes.'))
    text='; '.join(f'{word} Assembly is available' for word in ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta'])
    with pytest.raises(ModelUnavailable) as e:validate_answer(answer(text,99),rows)
    f=e.value.feedback;assert len(f['procedure_requirements']['source_definitions'])==6
    assert 1<=len(f['procedure_excerpt_options'])<=6
    assert all(len(x['text'])<=1200 and x['text']==next(r['text'] for r in rows if r['passage_id']==x['passage_id']) for x in f['procedure_excerpt_options'])


def test_explicit_v15_keeps_its_recorded_behavior():
    assert validate_answer(answer(CLAIM,2),sources(),correction_policy='option-noun-feedback-v15')


def test_supported_subject_is_not_a_general_entailment_check():
    # This guard checks only subject coverage; the original still needs review.
    assert validate_answer(answer('Center of Gravity is the balance point.',1),sources())


def test_each_copula_occurrence_is_inspected_without_greedy_skipping():
    rows=[source(1,1,'Alpha Assembly is operating while Beta Assembly is available.'),source(2,1,'General notes.')]
    with pytest.raises(ModelUnavailable) as e:validate_answer(answer('Alpha Assembly is ready but Beta Assembly is provided.',2),rows)
    assert {r['subject'] for r in e.value.feedback['procedure_requirements']['source_definitions']}=={'alpha assembly','beta assembly'}


@pytest.mark.parametrize('retain',[True,False])
def test_applicability_first_failure_preserves_definition_subject(retain):
    from .test_library_correction_schema import CONDITIONAL_OPERATIONS, UNQUALIFIED_CERTIFICATION, QUALIFIED_CERTIFICATION
    conditional={**CONDITIONAL_OPERATIONS,'document_id':'doc_charts','passage_id':4,'page':21,'label':'21'}
    rows=sources()+[conditional];calls=[]
    def provider(request):
        question=json.loads(json.loads(request.content)['messages'][1]['content'])['question'];calls.append(question)
        if len(calls)==1:return response(answer(CLAIM+' '+UNQUALIFIED_CERTIFICATION,2,4)['claims'])
        f=json.loads(question.rsplit('\n',1)[-1])['rejected_claims'][0]
        assert f['applicability_requirements'] and f['procedure_requirements']['source_definitions']
        assert len(f.get('qualification_excerpt_options',[]))+len(f['procedure_excerpt_options'])<=6
        return response(answer((CLAIM+' ' if retain else '')+QUALIFIED_CERTIFICATION,1,2,4)['claims'])
    if retain:assert verified_completion(model(provider),rows,'Summarize',max_attempts=2)['claims']
    else:
        with pytest.raises(ModelUnavailable,match='support'):verified_completion(model(provider),rows,'Summarize',max_attempts=2)
    assert len(calls)==2


def test_selected_subject_and_copula_cannot_be_assembled_across_excerpts():
    rows=sources()+[source(4,20,'Center of Gravity'),source(5,20,'is a balance point.')]
    with pytest.raises(ModelUnavailable) as e:validate_answer(answer(CLAIM,2,4,5),rows)
    assert 'definition_subject:center of gravity' in e.value.feedback['missing_procedure_citation_conditions']
