"""Explicit, offline retained AIXM/SOAP seed. Never performs provider requests."""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import zlib
import xml.etree.ElementTree as ET

from .nms_cache import NMSCache, instant
from .nms_client import NMSUnavailable

EVENT = '{http://www.aixm.aero/schema/5.1/event}'
MESSAGE = '{http://www.aixm.aero/schema/5.1/message}AIXMBasicMessage'
FNSE = '{http://www.aixm.aero/schema/5.1/extensions/FAA/FNSE}'
GML = '{http://www.opengis.net/gml/3.2}id'
SOAP = '{http://schemas.xmlsoap.org/soap/envelope/}'


class BoundedXML:
    def __init__(self, stream):
        self.stream, self.size, self.tail = stream, 0, b''
        self.record_started = None

    def read(self, size=-1):
        raw = self.stream.read(min(65536, size) if size >= 0 else 65536)
        self.size += len(raw)
        scan = (self.tail + raw).upper()
        if (self.record_started is not None and self.size - self.record_started > 8 * 1024 * 1024) or self.size > 512 * 1024 * 1024 or b'\x00' in raw or b'<!DOCTYPE' in scan or b'<!ENTITY' in scan:
            raise ValueError('Invalid or oversized initial-load XML')
        self.tail = scan[-64:]
        return raw


def _message(message):
    identifier = message.get(GML, '')
    if not re.fullmatch(r'NMS_ID_[A-Za-z0-9_-]{1,120}', identifier):
        raise ValueError('Invalid source message identity')
    notices = message.findall('.//' + EVENT + 'NOTAM')
    slices = [s for s in message.findall('.//' + EVENT + 'EventTimeSlice') if s.find('.//' + EVENT + 'NOTAM') is not None]
    if len(notices) != 1 or len(slices) != 1:
        raise ValueError('Ambiguous source notice')
    extensions = slices[0].findall('./' + EVENT + 'extension/' + FNSE + 'EventExtension')
    if len(extensions) != 1:
        raise ValueError('Missing or ambiguous source metadata')
    n = {}
    for parent, namespace in [(notices[0], EVENT), (extensions[0], FNSE)]:
        for child in parent:
            if not child.tag.startswith(namespace) or len(child):
                continue
            key = child.tag[len(namespace):]
            value = child.text
            if key in n and n[key] != value:
                raise ValueError('Conflicting source metadata')
            n[key] = value
    if n.get('id') not in (None, identifier):
        raise ValueError('Conflicting source identity')
    n['id'] = identifier
    for key in ['effectiveStart', 'effectiveEnd']:
        value = n.get(key)
        if value in (None, '', 'PERM'):
            continue
        estimated = value.endswith('EST')
        date = value[:-3] if estimated else value
        if re.fullmatch(r'\d{10}', date):
            issued = n.get('issued', '')
            if not re.match(r'\d{4}-', issued):
                raise ValueError('Compact year needs source issuance context')
            date = issued[:2] + date
            if abs(int(date[:4]) - int(issued[:4])) > 1:
                raise ValueError('Ambiguous compact source year')
        if re.fullmatch(r'\d{12}', date):
            n[key] = datetime.strptime(date, '%Y%m%d%H%M').replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
            if estimated:
                n['estimated'] = True
        else:
            instant(value)
    xml = ET.tostring(message, encoding='unicode')
    if len(xml.encode()) > 8 * 1024 * 1024:
        raise ValueError('Oversized source message')
    return {'type': 'Feature', 'geometry': None, 'properties': {'coreNOTAMData': {'notam': n}}, 'source_format': 'AIXM', 'source_aixm': xml}


def decode_aixm(stream):
    """Stream a complete SOAP document; a truncated tail invalidates the whole seed."""
    try:
        with gzip.GzipFile(fileobj=stream) as expanded:
            depth, root, body, collection, count, declared = 0, None, False, False, 0, None
            reader = BoundedXML(expanded)
            stack = []
            for event, node in ET.iterparse(reader, events=('start', 'end')):
                if event == 'start':
                    stack.append(node.tag)
                    if node.tag == MESSAGE:
                        if reader.record_started is not None:
                            raise ValueError('Nested source message')
                        reader.record_started = reader.size
                    depth += 1
                    if depth == 1:
                        root = node.tag
                    if depth == 2 and node.tag == SOAP + 'Body':
                        body = True
                    if depth == 3 and node.tag.rsplit('}', 1)[-1] == 'FeatureCollection':
                        collection = True
                        declared = node.get('numberReturned')
                        if declared is None or not declared.isdecimal() or int(declared) > 250000:
                            raise ValueError('Invalid source collection count')
                        instant(node.get('timeStamp'))
                else:
                    if node.tag == MESSAGE:
                        if root != SOAP + 'Envelope' or not body or not collection or len(stack) < 4 or stack[1] != SOAP + 'Body' or stack[2].rsplit('}', 1)[-1] != 'FeatureCollection':
                            raise ValueError('Invalid initial-load envelope')
                        count += 1
                        if count > 250000:
                            raise ValueError('Oversized initial load')
                        yield _message(node)
                        node.clear()
                        reader.record_started = None
                    stack.pop()
                    depth -= 1
            if root != SOAP + 'Envelope' or not body or not collection or not count or count != int(declared):
                raise ValueError('Missing or incomplete initial-load collection')
    except (ValueError, TypeError, ET.ParseError, OSError, EOFError, OverflowError, zlib.error) as error:
        raise NMSUnavailable('Retained NMS AIXM initial load is invalid or oversized') from error


def _generation_time(raw):
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(raw)) as expanded:
            for event, node in ET.iterparse(BoundedXML(expanded), events=('start',)):
                if node.tag.rsplit('}', 1)[-1] == 'FeatureCollection':
                    return instant(node.get('timeStamp'))
        raise ValueError('Missing source generation time')
    except (ValueError, ET.ParseError, OSError, EOFError, zlib.error) as error:
        raise NMSUnavailable('Retained initial-load header is invalid') from error


def seed(cache, path, *, retrieved_at, expected_sha256):
    path = Path(path)
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 128 * 1024 * 1024:
        raise NMSUnavailable('Invalid retained initial-load file')
    raw = path.read_bytes()
    if not re.fullmatch(r'[a-f0-9]{64}', expected_sha256) or hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise NMSUnavailable('Retained initial-load identity mismatch')
    cache.bootstrap_initial(decode_aixm(io.BytesIO(raw)), raw, retrieved_at, coverage_since=_generation_time(raw) - 60)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--environment', choices=['staging', 'fit', 'production'], required=True)
    parser.add_argument('--cache-dir', required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--retrieved-at', required=True)
    args = parser.parse_args(argv)
    try:
        cache = NMSCache(args.cache_dir, args.environment)
        seed(cache, args.source, retrieved_at=instant(args.retrieved_at), expected_sha256=args.sha256)
    except Exception:
        print(json.dumps({'event': 'nms_initial_seed_failed'}), flush=True)
        return 2
    print(json.dumps({'event': 'nms_initial_seeded_pending_catchup', 'environment': args.environment}), flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
