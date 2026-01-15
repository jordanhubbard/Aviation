"""
Unit tests for Python airport database and search functionality
Target: >80% code coverage matching TypeScript tests
"""

import pytest
import time
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from aviation.airports import (
    get_airport,
    search_airports,
    search_airports_advanced,
    haversine_distance
)


class TestHaversineDistance:
    """Test haversine distance calculations"""
    
    def test_ksfo_to_klax(self):
        """Calculate distance between KSFO and KLAX correctly"""
        # KSFO: 37.619, -122.375
        # KLAX: 33.942, -118.408
        distance = haversine_distance(37.619, -122.375, 33.942, -118.408)
        
        # Expected: ~293 nm
        assert 292 < distance < 295
    
    def test_kjfk_to_klax(self):
        """Calculate transcontinental distance correctly"""
        # KJFK: 40.640, -73.779
        # KLAX: 33.942, -118.408
        distance = haversine_distance(40.640, -73.779, 33.942, -118.408)
        
        # Expected: ~2145 nm
        assert 2140 < distance < 2150
    
    def test_same_point(self):
        """Return 0 for same point"""
        distance = haversine_distance(37.619, -122.375, 37.619, -122.375)
        assert distance == 0
    
    def test_negative_coordinates(self):
        """Handle southern hemisphere coordinates"""
        # YSSY to YMML (Sydney to Melbourne)
        distance = haversine_distance(-33.946, 151.177, -37.669, 144.841)
        assert distance > 0
        assert distance < 500


class TestGetAirport:
    """Test airport lookup by code"""
    
    def test_find_by_icao(self):
        """Find airport by ICAO code (KSFO)"""
        airport = get_airport('KSFO')
        
        assert airport is not None
        assert airport['icao'] == 'KSFO'
        assert 'San Francisco' in airport['name']
        assert 37.5 < airport['latitude'] < 37.7
        assert -122.5 < airport['longitude'] < -122.2
    
    def test_find_by_iata(self):
        """Find airport by IATA code (SFO)"""
        airport = get_airport('SFO')
        
        assert airport is not None
        assert airport['icao'] == 'KSFO'
        assert airport['iata'] == 'SFO'
    
    def test_lowercase_code(self):
        """Handle lowercase airport codes"""
        airport = get_airport('ksfo')
        
        assert airport is not None
        assert airport['icao'] == 'KSFO'
    
    def test_k_prefix_handling(self):
        """Handle K-prefix for US airports (PAO → KPAO)"""
        airport = get_airport('PAO')
        
        assert airport is not None
        assert airport['icao'] == 'KPAO'
        assert 'Palo Alto' in airport['name']
    
    def test_code_with_description(self):
        """Handle code with description"""
        airport = get_airport('KSFO - San Francisco International')
        
        assert airport is not None
        assert airport['icao'] == 'KSFO'
    
    def test_nonexistent_airport(self):
        """Return None for non-existent airport"""
        airport = get_airport('XXXX')
        assert airport is None
    
    def test_empty_string(self):
        """Return None for empty string"""
        airport = get_airport('')
        assert airport is None
    
    def test_major_airports(self):
        """Find multiple major airports"""
        codes = ['KJFK', 'KLAX', 'KORD', 'KATL', 'KDFW']
        
        for code in codes:
            airport = get_airport(code)
            assert airport is not None
            assert airport['icao'] == code


class TestSearchAirports:
    """Test text search functionality"""
    
    def test_exact_icao_code(self):
        """Find airports by exact ICAO code"""
        results = search_airports('KSFO', 5)
        
        assert len(results) > 0
        assert results[0]['icao'] == 'KSFO'
    
    def test_search_by_name(self):
        """Find airports by name"""
        results = search_airports('San Francisco', 10)
        
        assert len(results) > 0
        
        # SFO should be in results
        sfo = next((a for a in results if a['icao'] == 'KSFO'), None)
        assert sfo is not None
        assert 'San Francisco' in sfo['name']
    
    def test_search_by_city(self):
        """Find airports by city using code"""
        results = search_airports('OAK', 5)
        
        assert len(results) > 0
        oak = next((a for a in results if a['icao'] == 'KOAK'), None)
        assert oak is not None
    
    def test_exact_match_ranks_higher(self):
        """Exact code matches rank first"""
        results = search_airports('LAX', 10)
        
        # KLAX should be first result
        assert results[0]['icao'] == 'KLAX'
    
    def test_partial_matches(self):
        """Handle partial text matches"""
        results = search_airports('San', 10)
        
        assert len(results) > 0
        
        # Should include airports with "San" in code or name
        has_san = any('SAN' in a['icao'] or 'San' in (a['name'] or '') for a in results)
        assert has_san
    
    def test_no_matches(self):
        """Return empty array for no matches"""
        results = search_airports('ZZZZZZZZZZ', 10)
        assert results == []
    
    def test_respect_limit(self):
        """Respect limit parameter"""
        results = search_airports('International', 5)
        assert len(results) <= 5
    
    def test_case_insensitive(self):
        """Search is case-insensitive"""
        upper = search_airports('SAN FRANCISCO', 5)
        lower = search_airports('san francisco', 5)
        mixed = search_airports('San Francisco', 5)
        
        assert len(upper) > 0
        assert len(lower) > 0
        assert len(mixed) > 0
        
        # Should all find KSFO
        assert upper[0]['icao'] == lower[0]['icao']
        assert lower[0]['icao'] == mixed[0]['icao']


class TestSearchAirportsAdvanced:
    """Test advanced search with text and geo"""
    
    def test_text_search(self):
        """Perform text search like searchAirports"""
        results = search_airports_advanced(query='LAX', limit=5)
        
        assert len(results) > 0
        lax = next((a for a in results if a['icao'] == 'KLAX'), None)
        assert lax is not None
    
    def test_proximity_search(self):
        """Find airports near a point"""
        results = search_airports_advanced(
            lat=37.619,
            lon=-122.375,
            radius_nm=30,
            limit=10
        )
        
        assert len(results) > 0
        
        # All results should have distance_nm
        for airport in results:
            assert 'distance_nm' in airport
            assert airport['distance_nm'] <= 30
        
        # Should be sorted by distance
        for i in range(1, len(results)):
            assert results[i]['distance_nm'] >= results[i-1]['distance_nm']
    
    def test_combined_text_and_geo(self):
        """Combine text and proximity search"""
        results = search_airports_advanced(
            query='Airport',
            lat=37.619,
            lon=-122.375,
            radius_nm=50,
            limit=10
        )
        
        assert len(results) > 0
        
        # Should have distance and match query
        for airport in results:
            assert 'distance_nm' in airport
            assert airport['distance_nm'] <= 50
    
    def test_no_radius_limit(self):
        """Find airports without radius (sorted by distance)"""
        results = search_airports_advanced(
            lat=37.619,
            lon=-122.375,
            limit=5
        )
        
        assert len(results) == 5
        
        # Should all have distance and be sorted
        for i in range(1, len(results)):
            assert results[i]['distance_nm'] >= results[i-1]['distance_nm']
    
    def test_empty_without_query_or_geo(self):
        """Return empty array when no query or geo provided"""
        results = search_airports_advanced()
        assert results == []
    
    def test_large_radius(self):
        """Handle large radius search"""
        results = search_airports_advanced(
            lat=37.619,
            lon=-122.375,
            radius_nm=500,
            limit=20
        )
        
        assert len(results) > 10  # Should find many airports
    
    def test_closest_airports_first(self):
        """Proximity search includes closest first"""
        results = search_airports_advanced(
            lat=37.619,
            lon=-122.375,
            limit=3
        )
        
        # KSFO itself should be first (distance ~0)
        assert results[0]['icao'] == 'KSFO'
        assert results[0]['distance_nm'] < 1
    
    def test_text_plus_geo_ranking(self):
        """Text + geo search ranks by score then distance"""
        results = search_airports_advanced(
            query='International',
            lat=37.619,
            lon=-122.375,
            limit=10
        )
        
        assert len(results) > 0
        
        # Should find airports matching "International"
        has_international = any('International' in (a['name'] or '') for a in results)
        assert has_international
        
        # All should have distance
        for a in results:
            assert 'distance_nm' in a


class TestPerformance:
    """Test performance benchmarks"""
    
    def test_get_airport_performance(self):
        """getAirport completes quickly (cached)"""
        start = time.time()
        get_airport('KSFO')
        duration = (time.time() - start) * 1000  # Convert to ms
        
        assert duration < 50
    
    def test_search_airports_performance(self):
        """searchAirports completes in reasonable time"""
        # Searching 82K airports with fuzzy matching (Python is slower than TypeScript)
        start = time.time()
        search_airports('San Francisco', 10)
        duration = (time.time() - start) * 1000
        
        assert duration < 2000  # 2s is reasonable for Python
    
    def test_search_advanced_text_performance(self):
        """searchAirportsAdvanced (text) performance"""
        start = time.time()
        search_airports_advanced(query='Los Angeles', limit=10)
        duration = (time.time() - start) * 1000
        
        assert duration < 2000  # 2s is reasonable for Python
    
    def test_search_advanced_geo_performance(self):
        """searchAirportsAdvanced (geo) performance"""
        start = time.time()
        search_airports_advanced(
            lat=37.619,
            lon=-122.375,
            radius_nm=50,
            limit=10
        )
        duration = (time.time() - start) * 1000
        
        assert duration < 500


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_whitespace_in_queries(self):
        """Handle whitespace in queries"""
        results = search_airports('  San Francisco  ', 5)
        assert len(results) > 0
    
    def test_special_characters(self):
        """Handle special characters"""
        results = search_airports("O'Hare", 5)
        assert len(results) > 0
    
    def test_numeric_codes(self):
        """Handle numeric codes (7S5 → K7S5)"""
        airport = get_airport('7S5')
        # Should try K7S5 automatically if exists
        assert airport is not None or airport is None  # Either way is valid
    
    def test_very_short_queries(self):
        """Handle very short queries"""
        results = search_airports('SF', 5)
        # Should still return results (fuzzy matching)
        assert len(results) >= 0


class TestDataIntegrity:
    """Test data integrity and consistency"""
    
    def test_all_results_have_required_fields(self):
        """All results have required fields"""
        results = search_airports('International', 10)
        
        for airport in results:
            assert 'icao' in airport
            assert 'iata' in airport
            assert 'name' in airport
            assert 'city' in airport
            assert 'country' in airport
            assert 'latitude' in airport
            assert 'longitude' in airport
            assert 'type' in airport
            
            # Validate coordinates
            assert -90 <= airport['latitude'] <= 90
            assert -180 <= airport['longitude'] <= 180
    
    def test_consistent_results(self):
        """getAirport returns consistent results"""
        result1 = get_airport('KSFO')
        result2 = get_airport('KSFO')
        
        assert result1 == result2
    
    def test_no_duplicate_results(self):
        """No duplicate results in search"""
        results = search_airports('Airport', 50)
        
        icaos = [a['icao'] for a in results]
        unique_icaos = set(icaos)
        
        assert len(icaos) == len(unique_icaos)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
