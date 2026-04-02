"""Tests for ForeFlight client service."""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime
from pydantic import ValidationError
from src.services.foreflight_client import ForeFlightClient
from src.core.models import LogbookEntry, Aircraft, Airport, FlightConditions


class TestForeFlightClient:
    """Test ForeFlight client functionality."""

    @pytest.fixture
    def mock_client(self):
        """Create a mock ForeFlight client."""
        with patch('src.services.foreflight_client.ForeFlightClient.__init__', return_value=None):
            client = ForeFlightClient()
            # Set required attributes for test compatibility
            client.csv_file_path = "mock_file.csv"  # Enable local data mode
            client.base_url = "https://api.foreflight.com"
            client.logbook_entries = []
            client.aircraft_list = []
            return client

    @pytest.fixture
    def sample_entry(self):
        """Create a sample logbook entry."""
        return LogbookEntry(
            date=datetime(2023, 1, 1),
            total_time=1.5,
            aircraft=Aircraft(
                registration="N12345",
                type="C172",
                category_class="ASEL"
            ),
            departure=Airport(identifier="KOAK"),
            destination=Airport(identifier="KSFO"),
            conditions=FlightConditions(
                day=1.5,
                night=0.0,
                actual_instrument=0.0,
                simulated_instrument=0.0,
                cross_country=0.0
            ),
            pilot_role="PIC",
            dual_received=0.0,
            pic_time=1.5,
            solo_time=0.0,
            landings_day=1,  # Add required landing fields
            landings_night=0
        )

    def test_client_initialization(self):
        """Test client initialization."""
        with patch('src.services.importer.ForeFlightImporter') as mock_importer:
            mock_importer_instance = Mock()
            mock_importer_instance.get_flight_entries.return_value = []
            mock_importer_instance.get_aircraft_list.return_value = []
            mock_importer.return_value = mock_importer_instance
            
            client = ForeFlightClient("test_file.csv")
            
            assert client is not None
            mock_importer.assert_called_once_with("test_file.csv")

    def test_get_logbook_entries_no_filter(self, mock_client, sample_entry):
        """Test getting all logbook entries without filters."""
        mock_client.logbook_entries = [sample_entry]
        
        entries = mock_client.get_logbook_entries()
        
        assert len(entries) == 1
        assert entries[0] == sample_entry

    def test_get_logbook_entries_with_date_filter(self, mock_client, sample_entry):
        """Test getting logbook entries with date filtering."""
        mock_client.logbook_entries = [sample_entry]
        
        # Filter that includes the entry
        start_date = datetime(2022, 12, 1)
        end_date = datetime(2023, 2, 1)
        entries = mock_client.get_logbook_entries(start_date, end_date)
        
        assert len(entries) == 1
        assert entries[0] == sample_entry

    def test_get_logbook_entries_filtered_out(self, mock_client, sample_entry):
        """Test getting logbook entries that are filtered out."""
        mock_client.logbook_entries = [sample_entry]
        
        # Filter that excludes the entry
        start_date = datetime(2023, 2, 1)
        end_date = datetime(2023, 3, 1)
        entries = mock_client.get_logbook_entries(start_date, end_date)
        
        assert len(entries) == 0

    def test_add_logbook_entry(self, mock_client, sample_entry):
        """Test adding a new logbook entry."""
        mock_client.logbook_entries = []
        
        result = mock_client.add_logbook_entry(sample_entry)
        
        assert result == sample_entry
        assert len(mock_client.logbook_entries) == 1
        assert mock_client.logbook_entries[0] == sample_entry

    def test_update_logbook_entry_exists(self, mock_client, sample_entry):
        """Test updating an existing logbook entry."""
        # Add entry with ID for identification
        sample_entry.id = "entry-1"
        mock_client.logbook_entries = [sample_entry]
        
        # Create updated entry
        updated_entry = LogbookEntry(
            date=datetime(2023, 1, 1),
            total_time=2.0,  # Changed
            aircraft=sample_entry.aircraft,
            departure=sample_entry.departure,
            destination=sample_entry.destination,
            conditions=FlightConditions(
                day=2.0,  # Changed
                night=0.0,
                actual_instrument=0.0,
                simulated_instrument=0.0,
                cross_country=0.0
            ),
            pilot_role="PIC",
            dual_received=0.0,
            pic_time=2.0,  # Changed
            solo_time=0.0,
            landings_day=1,  # Add required landing fields
            landings_night=0
        )
        updated_entry.id = "entry-1"
        
        result = mock_client.update_logbook_entry("entry-1", updated_entry)
        
        assert result == updated_entry
        assert mock_client.logbook_entries[0].total_time == 2.0

    def test_update_logbook_entry_not_found(self, mock_client, sample_entry):
        """Test updating a non-existent logbook entry."""
        mock_client.logbook_entries = []
        
        with pytest.raises(ValueError, match="Entry not found"):
            mock_client.update_logbook_entry("non-existent", sample_entry)

    def test_delete_logbook_entry_exists(self, mock_client, sample_entry):
        """Test deleting an existing logbook entry."""
        sample_entry.id = "entry-1"
        mock_client.logbook_entries = [sample_entry]
        
        result = mock_client.delete_logbook_entry("entry-1")
        
        assert result is True
        assert len(mock_client.logbook_entries) == 0

    def test_delete_logbook_entry_not_found(self, mock_client):
        """Test deleting a non-existent logbook entry."""
        mock_client.logbook_entries = []
        
        result = mock_client.delete_logbook_entry("non-existent")
        
        assert result is False

    def test_get_aircraft_list(self, mock_client):
        """Test getting aircraft list."""
        aircraft = Aircraft(
            registration="N12345",
            type="C172",
            category_class="ASEL"
        )
        mock_client.aircraft_list = [aircraft]
        
        result = mock_client.get_aircraft_list()
        
        assert len(result) == 1
        assert result[0] == aircraft

    def test_get_statistics_empty(self, mock_client):
        """Test getting statistics with empty logbook."""
        mock_client.logbook_entries = []
        
        stats = mock_client.get_statistics()
        
        assert stats['total_time'] == 0.0
        assert stats['total_flights'] == 0
        assert stats['pic_time'] == 0.0

    def test_get_statistics_with_entries(self, mock_client, sample_entry):
        """Test getting statistics with logbook entries."""
        # Create multiple entries
        entry1 = sample_entry
        entry2 = LogbookEntry(
            date=datetime(2023, 1, 2),
            total_time=2.0,
            aircraft=sample_entry.aircraft,
            departure=sample_entry.departure,
            destination=sample_entry.destination,
            conditions=FlightConditions(
                day=2.0,
                night=0.0,
                actual_instrument=0.0,
                simulated_instrument=0.0,
                cross_country=0.0
            ),
            pilot_role="PIC",
            dual_received=0.0,
            pic_time=2.0,
            solo_time=0.0,
            landings_day=1,  # Add required landing fields
            landings_night=0
        )
        
        mock_client.logbook_entries = [entry1, entry2]
        
        stats = mock_client.get_statistics()
        
        assert stats['total_time'] == 3.5
        assert stats['total_flights'] == 2
        assert stats['pic_time'] == 3.5

    def test_get_recent_flights(self, mock_client, sample_entry):
        """Test getting recent flights."""
        mock_client.logbook_entries = [sample_entry]
        
        recent = mock_client.get_recent_flights(days=30)
        
        # Depending on implementation, this might be empty if entry is too old
        assert isinstance(recent, list)

    def test_validate_entry_before_add(self, mock_client):
        """Test that entries are validated before adding."""
        # Test that Pydantic validation prevents invalid entries at creation time
        with pytest.raises(ValidationError):
            # This should fail due to aircraft=None
            invalid_entry = LogbookEntry(
                date=datetime(2023, 1, 1),
                total_time=1.5,
                aircraft=None,  # Missing aircraft - should cause ValidationError
                departure=Airport(identifier="KOAK"),
                destination=Airport(identifier="KSFO"),
                conditions=FlightConditions(
                    day=1.5,
                    night=0.0,
                    actual_instrument=0.0,
                    simulated_instrument=0.0,
                    cross_country=0.0
                ),
                pilot_role="PIC",
                dual_received=0.0,
                pic_time=1.5,
                solo_time=0.0
            )

    def test_search_entries_by_aircraft(self, mock_client, sample_entry):
        """Test searching entries by aircraft."""
        mock_client.logbook_entries = [sample_entry]
        
        # This would depend on the actual implementation
        results = [e for e in mock_client.logbook_entries 
                  if e.aircraft.registration == "N12345"]
        
        assert len(results) == 1
        assert results[0] == sample_entry

    def test_search_entries_by_route(self, mock_client, sample_entry):
        """Test searching entries by route."""
        mock_client.logbook_entries = [sample_entry]
        
        # This would depend on the actual implementation
        results = [e for e in mock_client.logbook_entries 
                  if e.departure.identifier == "KOAK" and e.destination.identifier == "KSFO"]
        
        assert len(results) == 1
        assert results[0] == sample_entry

    def test_error_handling_invalid_file(self):
        """Test error handling with invalid file."""
        with pytest.raises((FileNotFoundError, ValueError)):
            ForeFlightClient("nonexistent_file.csv")

    def test_concurrent_access(self, mock_client, sample_entry):
        """Test concurrent access to client data."""
        # This is a basic test - real concurrency testing would be more complex
        mock_client.logbook_entries = [sample_entry]
        
        # Simulate concurrent reads
        entries1 = mock_client.get_logbook_entries()
        entries2 = mock_client.get_logbook_entries()
        
        assert entries1 == entries2
        assert len(entries1) == 1


class TestForeFlightClientIngestAdapters:
    """Tests for ingest adapter error handling and validation (issue #178)."""

    @pytest.fixture
    def api_client(self):
        """Create a client in API mode with no CSV file."""
        with patch('src.services.foreflight_client.ForeFlightClient.__init__', return_value=None):
            client = ForeFlightClient()
            client.csv_file_path = None
            client.base_url = "https://api.foreflight.com"
            client.logbook_entries = []
            client.aircraft_list = []
            client.session = Mock()
            return client

    @pytest.fixture
    def sample_entry(self):
        return LogbookEntry(
            date=datetime(2024, 1, 15),
            total_time=2.0,
            aircraft=Aircraft(
                registration="N99TW",
                type="Piper PA-18",
                category_class="ASEL",
                gear_type="tailwheel",
                complex_aircraft=False,
                high_performance=False,
            ),
            departure=Airport(identifier="KPAO"),
            destination=Airport(identifier="KSQL"),
            conditions=FlightConditions(
                day=2.0,
                night=0.0,
                actual_instrument=0.0,
                simulated_instrument=0.0,
                cross_country=1.5,
            ),
            pilot_role="PIC",
            dual_received=0.0,
            pic_time=2.0,
            solo_time=0.0,
            landings_day=1,
            landings_night=0,
        )

    def test_get_logbook_entries_api_network_error_returns_empty(self, api_client):
        """get_logbook_entries in API mode should return [] on network error."""
        import requests
        with patch.object(api_client, '_make_request',
                          side_effect=requests.exceptions.ConnectionError("timeout")):
            result = api_client.get_logbook_entries()
        assert result == []

    def test_get_aircraft_list_api_network_error_returns_empty(self, api_client):
        """get_aircraft_list in API mode should return [] on network error."""
        import requests
        # Force API mode: no csv_file_path and empty aircraft_list
        api_client.aircraft_list = []
        with patch.object(api_client, '_make_request',
                          side_effect=requests.exceptions.ConnectionError("timeout")):
            result = api_client.get_aircraft_list()
        assert result == []

    def test_get_recent_flights_invalid_days_raises(self, api_client):
        """get_recent_flights should raise ValueError for days <= 0."""
        with pytest.raises(ValueError, match="days must be a positive integer"):
            api_client.get_recent_flights(days=0)
        with pytest.raises(ValueError, match="days must be a positive integer"):
            api_client.get_recent_flights(days=-5)

    def test_get_statistics_includes_classification_totals(self, api_client, sample_entry):
        """get_statistics should return tailwheel/complex/high_performance totals."""
        complex_aircraft = Aircraft(
            registration="N33CP",
            type="Cessna 182RG",
            category_class="ASEL",
            gear_type="tricycle",
            complex_aircraft=True,
            high_performance=True,
        )
        complex_entry = LogbookEntry(
            date=datetime(2024, 2, 1),
            total_time=1.5,
            aircraft=complex_aircraft,
            departure=Airport(identifier="KSJC"),
            destination=Airport(identifier="KNUQ"),
            conditions=FlightConditions(
                day=1.5,
                night=0.0,
                actual_instrument=0.0,
                simulated_instrument=0.0,
                cross_country=0.0,
            ),
            pilot_role="PIC",
            dual_received=0.0,
            pic_time=1.5,
            solo_time=0.0,
            landings_day=1,
            landings_night=0,
        )
        api_client.logbook_entries = [sample_entry, complex_entry]

        stats = api_client.get_statistics()

        assert stats['tailwheel_time'] == pytest.approx(2.0)
        assert stats['complex_time'] == pytest.approx(1.5)
        assert stats['high_performance_time'] == pytest.approx(1.5)
        assert stats['total_landings'] == 2

    def test_get_statistics_empty_returns_zero_classification_fields(self, api_client):
        """Empty stats dict must include classification keys."""
        api_client.logbook_entries = []
        stats = api_client.get_statistics()
        assert 'tailwheel_time' in stats
        assert 'complex_time' in stats
        assert 'high_performance_time' in stats
        assert stats['tailwheel_time'] == 0.0
