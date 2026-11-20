import gzip
import io
import json
from pathlib import Path

import pytest

from app.services.nms_cache import NMSCache
from app.services.nms_client import NMSUnavailable


def document(*, text='RWY CLOSED', start='202611201200', end='202611212359', kind='N', identifier='NMS_ID_123', extra=''):
    return f'''<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:m="http://www.aixm.aero/schema/5.1/message" xmlns:e="http://www.aixm.aero/schema/5.1/event" xmlns:f="http://www.aixm.aero/schema/5.1/extensions/FAA/FNSE" xmlns:g="http://www.opengis.net/gml/3.2"><s:Body><FeatureCollection numberReturned="1" timeStamp="2026-11-20T12:00:00Z"><m:member><m:AIXMBasicMessage g:id="{identifier}"><m:hasMember><e:Event><e:timeSlice><e:EventTimeSlice><e:textNOTAM><e:NOTAM><e:number>11/001</e:number>{f'<e:type>{kind}</e:type>' if kind else ''}<e:issued>2026-11-20T12:00:00Z</e:issued><e:location>PAO</e:location>{f'<e:effectiveStart>{start}</e:effectiveStart>' if start else ''}{f'<e:effectiveEnd>{end}</e:effectiveEnd>' if end else ''}<e:text>{text}</e:text></e:NOTAM></e:textNOTAM><e:extension><f:EventExtension><f:classification>DOM</f:classification><f:lastUpdated>2026-11-20T12:00:00Z</f:lastUpdated><f:icaoLocation>KPAO</f:icaoLocation>{extra}</f:EventExtension></e:extension></e:EventTimeSlice></e:timeSlice></e:Event></m:hasMember></m:AIXMBasicMessage></m:member></FeatureCollection></s:Body></s:Envelope>'''.encode()


def decode(raw):
    from app.services.nms_initial import decode_aixm
    return list(decode_aixm(io.BytesIO(gzip.compress(raw))))


def test_literal_source_and_utc_projection():
    f = decode(document(text='RWY &amp; TWY CLOSED'))[0]
    assert f['source_format'] == 'AIXM'
    assert '<' in f['source_aixm'] and 'RWY &amp; TWY CLOSED' in f['source_aixm']
    n = f['properties']['coreNOTAMData']['notam']
    assert n['id'] == 'NMS_ID_123' and n['effectiveStart'] == '2026-11-20T12:00:00Z'
    assert n['effectiveEnd'] == '2026-11-21T23:59:00Z'
    assert n['text'] == 'RWY & TWY CLOSED' and f['geometry'] is None


@pytest.mark.parametrize('start,end,kind', [('', '', ''), ('202611201200', 'PERM', 'R')])
def test_unknown_and_permanent_are_preserved(start, end, kind):
    from app.services.nms_cache import normalize
    n = normalize(decode(document(start=start, end=end, kind=kind))[0])
    assert n['permanent'] == (end == 'PERM')
    assert (n['effective_start'] is None) == (not start)
    assert (n['type'] is None) == (not kind)


@pytest.mark.parametrize('raw', [b'<broken>', document()[:-20], b'<!DOCTYPE x [<!ENTITY a "bad">]>' + document(), document(identifier='bad'), document(start='nonsense')])
def test_invalid_seed_rejected(raw):
    with pytest.raises(NMSUnavailable):decode(raw)


def test_seed_reservation_atomicity_and_catchup(tmp_path):
    from app.services.nms_initial import seed
    import hashlib
    clock=[1795179600.0];c=NMSCache(tmp_path/'cache','staging',clock=lambda:clock[0]);raw=gzip.compress(document());p=tmp_path/'seed.gz';p.write_bytes(raw)
    seed(c,p,retrieved_at=clock[0]-3600,expected_sha256=hashlib.sha256(raw).hexdigest())
    s=c.synchronization_status();assert not s['complete_snapshot']
    t=c.reserve();assert t['kind']=='catchup' and clock[0]-86400<t['since']<clock[0]-3600
    c.finish(t,[]);assert c.query(['KPAO'])['total']==1
    with pytest.raises(NMSUnavailable):seed(c,p,retrieved_at=clock[0]-3600,expected_sha256=hashlib.sha256(raw).hexdigest())


def test_hash_mismatch_does_not_reserve(tmp_path):
    from app.services.nms_initial import seed
    c=NMSCache(tmp_path/'cache','staging');p=tmp_path/'seed.gz';p.write_bytes(gzip.compress(document()))
    with pytest.raises(NMSUnavailable):seed(c,p,retrieved_at=c.clock()-30,expected_sha256='0'*64)
    with c.connection() as db:assert c._state(db)['full_started'] is None


def test_same_version_format_transition_requires_matching_notice(tmp_path):
    from app.services.nms_initial import seed
    import hashlib
    clock=[1795179600.0];c=NMSCache(tmp_path/'cache','staging',clock=lambda:clock[0]);raw=gzip.compress(document());p=tmp_path/'seed.gz';p.write_bytes(raw)
    seed(c,p,retrieved_at=clock[0]-3600,expected_sha256=hashlib.sha256(raw).hexdigest());f=decode(document())[0];f.pop('source_aixm');f.pop('source_format');f['geometry']={'type':'Point','coordinates':[0,0]}
    t=c.reserve();c.finish(t,[f]);assert c.detail('NMS_ID_123')['feature']==f
    clock[0]+=181;t=c.reserve();bad=json.loads(json.dumps(f));bad['properties']['coreNOTAMData']['notam']['text']='OTHER'
    with pytest.raises(NMSUnavailable):c.finish(t,[bad])


def test_source_compact_two_digit_year_and_estimated_suffix():
    from app.services.nms_cache import normalize
    n = normalize(decode(document(end='2611232056EST'))[0])
    assert n['estimated'] is True
    from datetime import datetime
    assert n['effective_end'] == datetime.fromisoformat('2026-11-23T20:56:00+00:00').timestamp()


@pytest.mark.parametrize('change,accepted', [('  RWY CLOSED\n', True), ('RWY OPEN', False)])
def test_cross_format_text_keeps_source_and_rejects_changed_words(tmp_path, change, accepted):
    from app.services.nms_initial import seed
    import hashlib
    c=NMSCache(tmp_path/'cache','staging',clock=lambda:1795179600.0)
    raw=gzip.compress(document());p=tmp_path/'seed.gz';p.write_bytes(raw)
    seed(c,p,retrieved_at=c.clock()-3600,expected_sha256=hashlib.sha256(raw).hexdigest())
    feature=decode(document())[0];feature.pop('source_format');feature.pop('source_aixm');feature['properties']['coreNOTAMData']['notam']['text']=change
    ticket=c.reserve()
    if accepted:
        c.finish(ticket,[feature]);assert c.detail('NMS_ID_123')['text']==change
    else:
        with pytest.raises(NMSUnavailable):c.finish(ticket,[feature])


def test_truncated_seed_keeps_original_and_reservation(tmp_path):
    from app.services.nms_initial import seed
    import hashlib
    c=NMSCache(tmp_path/'cache','staging',clock=lambda:1795179600.0)
    raw=gzip.compress(document()[:-20]);p=tmp_path/'seed.gz';p.write_bytes(raw);digest=hashlib.sha256(raw).hexdigest()
    with pytest.raises(NMSUnavailable):seed(c,p,retrieved_at=c.clock()-3600,expected_sha256=digest)
    with c.connection() as db:
        s=c._state(db);assert s['owner'] is None and s['last_error'] and s['attempted']
        assert db.execute('select count(*) from current').fetchone()[0]==0
        assert db.execute('select count(*) from building').fetchone()[0]==0
    assert (c.root/'originals'/(digest+'.bin')).read_bytes()==raw
    assert c.reserve() is None


@pytest.mark.parametrize('change', [b'numberReturned="2"', b'numberReturned="unknown"'])
def test_declared_collection_count_is_enforced(change):
    with pytest.raises(NMSUnavailable):decode(document().replace(b'numberReturned="1"',change))


def test_failed_initial_catchup_keeps_delta_reservation(tmp_path):
    from app.services.nms_initial import seed
    import hashlib
    clock=[1795179600.0];c=NMSCache(tmp_path/'cache','staging',clock=lambda:clock[0])
    raw=gzip.compress(document());p=tmp_path/'seed.gz';p.write_bytes(raw)
    seed(c,p,retrieved_at=clock[0]-3600,expected_sha256=hashlib.sha256(raw).hexdigest())
    ticket=c.reserve();assert ticket['kind']=='catchup';c.finish(ticket,error=NMSUnavailable('provider failed'))
    clock[0]+=2
    assert c.reserve() is None
    clock[0]+=179
    assert c.reserve()['kind']=='catchup'
