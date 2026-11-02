"""Provider-contract regressions for large route elevation requests (no network)."""
import httpx
import pytest

from app.services import terrain_service as terrain


@pytest.mark.parametrize('count', [0, 1, 50, 51, 100, 101, 2503])
def test_batches_preserve_all_coordinate_pairs_and_elevation_order(monkeypatch, count):
    points = [(38.123456789012345 + i / 100000, -121.123456789012345 - i / 100000)
              for i in range(count)]
    requested = []

    def get(url, *, params, timeout):
        request = httpx.Request('GET', url, params=params)
        latitudes = [float(v) for v in params['latitude'].split(',')]
        longitudes = [float(v) for v in params['longitude'].split(',')]
        assert len(latitudes) == len(longitudes) <= 100  # Published provider limit.
        assert len(str(request.url).encode('ascii')) < 4096
        assert timeout == 10
        requested.extend(zip(latitudes, longitudes))
        return httpx.Response(200, request=request, json={'elevation': latitudes})

    monkeypatch.setattr(terrain.httpx, 'get', get)
    assert terrain._fetch_open_meteo_elevations_m(points) == [lat for lat, _ in points]
    assert requested == points


def test_short_and_missing_batch_values_do_not_shift_later_samples(monkeypatch):
    points = [(float(i), -1.0) for i in range(53)]
    payloads = iter([[None, 'unknown'] + [42] * 47, [500, None, 700]])

    def get(url, *, params, timeout):
        return httpx.Response(200, request=httpx.Request('GET', url, params=params),
                              json={'elevation': next(payloads)})

    monkeypatch.setattr(terrain.httpx, 'get', get)
    assert terrain._fetch_open_meteo_elevations_m(points) == (
        [None, None] + [42.0] * 47 + [None, 500.0, None, 700.0]
    )


@pytest.mark.parametrize('failure', ['http', 'network', 'schema'])
def test_later_batch_failure_aborts_instead_of_returning_partial_terrain(monkeypatch, failure):
    calls = []

    def get(url, *, params, timeout):
        request = httpx.Request('GET', url, params=params)
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(200, request=request, json={'elevation': [10] * 50})
        if failure == 'network':
            raise httpx.ReadTimeout('fixture timeout', request=request)
        return httpx.Response(503 if failure == 'http' else 200, request=request,
                              json={'error': 'unavailable'})

    monkeypatch.setattr(terrain.httpx, 'get', get)
    with pytest.raises(terrain.TerrainServiceError, match={
        'http': 'HTTP 503', 'network': 'request error', 'schema': 'schema',
    }[failure]):
        terrain._fetch_open_meteo_elevations_m([(1.0, -1.0)] * 151)
    assert len(calls) == 2


def test_profile_and_maximum_include_high_terrain_in_later_batches(monkeypatch):
    monkeypatch.setenv('TERRAIN_PROVIDER', 'open-meteo')
    points = [(1 + i / 1000, -1.0) for i in range(121)]

    def get(url, *, params, timeout):
        values = [1000 if float(v) == points[75][0] else 10
                  for v in params['latitude'].split(',')]
        return httpx.Response(200, request=httpx.Request('GET', url, params=params),
                              json={'elevation': values})

    monkeypatch.setattr(terrain.httpx, 'get', get)
    profile = terrain.elevation_profile(points)
    assert [p[:2] for p in profile] == points
    assert profile[75][2] == pytest.approx(3280.84)
    assert terrain.max_elevation_ft_along_points(iter(points)) == pytest.approx(3280.84)
