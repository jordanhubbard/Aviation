from copy import deepcopy
import pytest
from app.services.metar_consistency import evaluate, observation, assessment
from app.services import metar_consistency as service, ga_data

NOW=1800000000

def report(code='KFST',category='VFR',age=600,**fields):
    return dict(icaoId=code,obsTime=NOW-age,fltCat=category,visib='10+' if category=='VFR' else 2,
                cover='CLR' if category=='VFR' else 'OVC',clouds=[] if category=='VFR' else [dict(cover='OVC',base=600)],
                elev=900,rawOb=f'METAR {code} original source RMK AO2',**fields)

def neighbors(categories=('IFR','IFR','IFR')):
    return [dict(station=dict(station_id=f'KAA{i}'),report=report(f'KAA{i}',c),distance_nm=30+i*10,bearing_degrees=20+i*100) for i,c in enumerate(categories)]

def run(target=None, rows=None, **kw):return evaluate(target or report(),neighbors() if rows is None else rows,now=NOW,**kw)

def test_vfr_outlier_has_traceable_originals_and_forecasts_are_not_votes():
    target=report();before=deepcopy(target);r=run(target)
    assert r['status']=='suspicious';assert r['flags'][0]['code']=='regional_disagreement'
    assert r['ifr_neighbors']==3 and r['target']['original']==before and target==before
    assert all(n['original']['rawOb'] and n['observed_at_epoch']==NOW-600 for n in r['neighbors'])
    assert 'broken sensor' in r['limitations'][0]

@pytest.mark.parametrize('cats',[('VFR','VFR','VFR'),('IFR','IFR','VFR'),('IFR','VFR','VFR')])
def test_consensus_requires_three_restrictive_observations(cats):
    r=run(rows=neighbors(cats));assert r['status']=='no_conflict_detected' and not r['flags']

def test_sparse_missing_and_stale_are_never_reassuring():
    assert run(rows=neighbors(('VFR',)))['status']=='insufficient_evidence'
    assert run(report(age=5500))['status']=='insufficient_evidence'
    target=report();target.pop('obsTime');target['reportTime']='2027-01-15T08:00:00Z'
    assert run(target)['status']=='insufficient_evidence'
    assert run(report(age=-301))['status']=='insufficient_evidence'

@pytest.mark.parametrize('reason,change',[
 ('observation_stale',lambda n:n['report'].update(obsTime=NOW-5500)),
 ('observation_time_in_future',lambda n:n['report'].update(obsTime=NOW+301)),
 ('observation_time_mismatch',lambda n:n['report'].update(obsTime=NOW-3500)),
 ('elevation_difference',lambda n:n['report'].update(elev=1500)),
 ('elevation_unknown',lambda n:n['report'].pop('elev')),
 ('co_located_station',lambda n:n.update(distance_nm=1)),
 ('outside_radius',lambda n:n.update(distance_nm=101)),
 ('report_missing_or_unavailable',lambda n:n.update(report=None)),
])
def test_exclusions_cannot_vote(reason,change):
    rows=neighbors();change(rows[0]);r=run(rows=rows)
    assert r['status']=='insufficient_evidence' and r['qualifying_neighbors']==2
    assert r['neighbors'][0]['exclusion']==reason

def test_duplicate_or_one_sided_or_distant_stations_cannot_create_consensus():
    rows=neighbors();rows[2]=deepcopy(rows[1]);assert run(rows=rows)['status']=='insufficient_evidence'
    rows=neighbors()
    for n in rows:n['bearing_degrees']=20
    assert run(rows=rows)['status']=='no_conflict_detected'
    for n in rows:n['distance_nm']=70;n['bearing_degrees']+=n['report']['obsTime']%10
    assert run(rows=rows)['status']=='no_conflict_detected'

def test_maintenance_and_contradictory_fields_are_separate_reasons():
    t=report();t['rawOb']+=' $ CHINO';r=run(t,rows=[])
    assert r['status']=='suspicious' and r['flags'][0]['code']=='maintenance_or_sensor_indicator'
    t=report();t['clouds']=[dict(cover='OVC',base=400)];r=run(t,rows=[])
    assert r['status']=='suspicious' and r['flags'][0]['code']=='internally_inconsistent'
    assert run(rows=[])['status']=='insufficient_evidence' # AO2 alone is not a fault.

@pytest.mark.parametrize('visibility,base,expected',[('5',4000,'MVFR'),('10+',3000,'MVFR'),('3',1000,'MVFR'),('2',1000,'IFR'),('1',500,'IFR'),('.5',500,'LIFR')])
def test_awc_category_boundaries(visibility,base,expected):
    t=report();t.update(visib=visibility,clouds=[dict(cover='OVC',base=base)],cover='OVC')
    assert observation(t)['category_from_fields']==expected

def test_unknown_visibility_and_ceiling_stay_unknown():
    t=report();t.update(visib=None,cover=None,clouds=[],fltCat=None)
    assert observation(t)['category'] is None
    assert run(t)['status']=='insufficient_evidence'

def test_forecast_context_is_labeled_and_never_casts_votes():
    taf=[dict(rawTAF='TAF original TEMPO',fcsts=[dict(timeFrom=NOW-3600,timeTo=NOW+3600,changeIndicator='TEMPO',visib=1)])]
    r=run(rows=[],forecast=taf);assert r['status']=='insufficient_evidence'
    assert r['forecast_context'][0]['observed_votes']==0 and r['ifr_neighbors']==0
    assert run(errors=['TAF context unavailable'])['status']=='suspicious'

def test_unavailable_is_explicit_and_original_target_is_not_fabricated(monkeypatch):
    monkeypatch.setattr(service.sources,'station_catalog',lambda:(_ for _ in ()).throw(ga_data.DataUnavailable('Provider unavailable')))
    r=assessment('KFST');assert r['status']=='unavailable' and r['station_id']=='KFST' and r['target'] is None

def test_http_schema_bounds_no_network_for_bad_input_and_payload_identity(client,monkeypatch):
    calls=[]
    def fake(code,radius,count):
        calls.append((code,radius,count));r=run();r['station_id']=code;return r
    monkeypatch.setattr(service,'assessment',fake)
    for path in ['/api/aviation-weather/metar-consistency?airport=../X', '/api/aviation-weather/metar-consistency?airport=KFST&radius_nm=151', '/api/aviation-weather/metar-consistency?airport=KFST&max_neighbors=100']:
        assert client.get(path).status_code==422
    assert not calls
    response=client.get('/api/aviation-weather/metar-consistency?airport=KFST&max_neighbors=3')
    assert response.status_code==200 and response.json()['status']=='suspicious'
    assert response.headers['cache-control']=='no-store'
    assert calls==[('KFST',100,3)]
    schema=client.get('/api/openapi.json').json()
    assert '/api/aviation-weather/metar-consistency' in schema['paths']

def test_orchestration_bounds_reports_and_keeps_missing_target_identity(monkeypatch):
    catalog=[dict(id='KFST',icaoId='KFST',lat=30,lon=-103,siteType=['METAR','TAF'])]+[
        dict(id=f'KAA{i}',icaoId=f'KAA{i}',lat=30+i*.01,lon=-102.9,siteType=['METAR']) for i in range(25)]
    monkeypatch.setattr(service.sources,'station_catalog',lambda:(catalog,{'provider':'Synthetic catalog'}))
    calls=[]
    def reports(product,ids):calls.append((product,ids));return dict(reports=[],source={'provider':'Synthetic reports'})
    monkeypatch.setattr(service.sources,'reports',reports)
    r=assessment('KFST',100,3)
    assert r['station_id']=='KFST' and r['status']=='unavailable' and r['truncated']
    assert len(next(ids for kind,ids in calls if kind=='metar'))==4
    assert next(ids for kind,ids in calls if kind=='taf')==['KFST']


@pytest.mark.parametrize('forecast',[{},[None],[dict(fcsts='bad')],[dict(fcsts=[None])]])
def test_malformed_forecast_context_is_partial_not_reassuring(forecast):
    result=run(rows=neighbors(('VFR','VFR','VFR')),forecast=forecast)
    assert result['status']=='insufficient_evidence' and result['errors']


def test_conflicting_duplicate_reports_do_not_select_an_arbitrary_vote(monkeypatch):
    monkeypatch.setattr(service.sources,'station_catalog',lambda:([dict(id='KFST',lat=30,lon=-103,siteType=['METAR'])],{}))
    a=report();b=deepcopy(a);b['fltCat']='IFR'
    monkeypatch.setattr(service.sources,'reports',lambda product,ids:dict(reports=[a,b] if product=='metar' else [],source={}))
    result=assessment('KFST')
    assert result['status']=='unavailable' and any('Conflicting duplicate' in e for e in result['errors'])
