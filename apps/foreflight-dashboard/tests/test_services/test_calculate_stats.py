"""Tests for calculate_stats_for_entries and calculate_aircraft_stats."""

import pytest
from datetime import datetime
from src.main import calculate_stats_for_entries, calculate_aircraft_stats
from src.core.models import LogbookEntry, Aircraft, Airport, FlightConditions


def make_entry(
    total_time=1.0,
    gear_type="tricycle",
    complex_aircraft=False,
    high_performance=False,
    category_class="ASEL",
    registration="N12345",
):
    return LogbookEntry(
        date=datetime(2023, 1, 1),
        total_time=total_time,
        aircraft=Aircraft(
            registration=registration,
            type="C172",
            category_class=category_class,
            gear_type=gear_type,
            complex_aircraft=complex_aircraft,
            high_performance=high_performance,
        ),
        departure=Airport(identifier="KOAK"),
        destination=Airport(identifier="KSFO"),
        conditions=FlightConditions(day=total_time),
        dual_received=0.0,
        pic_time=total_time,
        solo_time=0.0,
        landings_day=1,
        landings_night=0,
        pilot_role="PIC",
    )


# --- calculate_stats_for_entries ---

class TestTailwheelDetection:
    def test_sums_tailwheel_only(self):
        entries = [
            make_entry(total_time=2.0, gear_type="tailwheel"),
            make_entry(total_time=1.0, gear_type="tricycle"),
            make_entry(total_time=1.5, gear_type="tailwheel"),
        ]
        stats = calculate_stats_for_entries(entries)
        assert stats["total_time_tailwheel"] == pytest.approx(3.5)

    def test_zero_when_no_tailwheel(self):
        entries = [
            make_entry(total_time=2.0, gear_type="tricycle"),
            make_entry(total_time=1.0, gear_type="tricycle"),
        ]
        stats = calculate_stats_for_entries(entries)
        assert stats["total_time_tailwheel"] == 0.0

    def test_all_tailwheel(self):
        entries = [
            make_entry(total_time=1.0, gear_type="tailwheel"),
            make_entry(total_time=2.0, gear_type="tailwheel"),
        ]
        stats = calculate_stats_for_entries(entries)
        assert stats["total_time_tailwheel"] == pytest.approx(3.0)
        assert stats["total_time_tailwheel"] == stats["total_time"]


class TestComplexDetection:
    def test_sums_complex_only(self):
        entries = [
            make_entry(total_time=3.0, complex_aircraft=True),
            make_entry(total_time=1.0, complex_aircraft=False),
        ]
        stats = calculate_stats_for_entries(entries)
        assert stats["total_time_complex"] == pytest.approx(3.0)

    def test_zero_when_no_complex(self):
        entries = [make_entry(total_time=2.0, complex_aircraft=False)]
        stats = calculate_stats_for_entries(entries)
        assert stats["total_time_complex"] == 0.0

    def test_all_complex(self):
        entries = [
            make_entry(total_time=1.5, complex_aircraft=True),
            make_entry(total_time=2.5, complex_aircraft=True),
        ]
        stats = calculate_stats_for_entries(entries)
        assert stats["total_time_complex"] == pytest.approx(4.0)


class TestHighPerformanceDetection:
    def test_sums_high_performance_only(self):
        entries = [
            make_entry(total_time=2.5, high_performance=True),
            make_entry(total_time=1.0, high_performance=False),
        ]
        stats = calculate_stats_for_entries(entries)
        assert stats["total_time_high_performance"] == pytest.approx(2.5)

    def test_zero_when_no_high_performance(self):
        entries = [make_entry(total_time=1.0, high_performance=False)]
        stats = calculate_stats_for_entries(entries)
        assert stats["total_time_high_performance"] == 0.0

    def test_combined_classifications(self):
        """Aircraft can be both complex and high-performance."""
        entries = [
            make_entry(total_time=2.0, complex_aircraft=True, high_performance=True),
            make_entry(total_time=1.0, complex_aircraft=True, high_performance=False),
            make_entry(total_time=0.5, complex_aircraft=False, high_performance=True),
        ]
        stats = calculate_stats_for_entries(entries)
        assert stats["total_time_complex"] == pytest.approx(3.0)
        assert stats["total_time_high_performance"] == pytest.approx(2.5)


# --- calculate_aircraft_stats ---

class TestCalculateAircraftStats:
    def test_groups_by_registration(self):
        entries = [
            make_entry(total_time=1.0, registration="N111AA"),
            make_entry(total_time=2.0, registration="N222BB"),
            make_entry(total_time=1.5, registration="N111AA"),
        ]
        result = calculate_aircraft_stats(entries)
        regs = [r["registration"] for r in result]
        assert "N111AA" in regs
        assert "N222BB" in regs
        assert len(result) == 2

    def test_sums_total_time_per_aircraft(self):
        entries = [
            make_entry(total_time=1.0, registration="N111AA"),
            make_entry(total_time=1.5, registration="N111AA"),
            make_entry(total_time=2.0, registration="N222BB"),
        ]
        result = calculate_aircraft_stats(entries)
        by_reg = {r["registration"]: r for r in result}
        assert by_reg["N111AA"]["total_time"] == pytest.approx(2.5)
        assert by_reg["N222BB"]["total_time"] == pytest.approx(2.0)

    def test_counts_flights_per_aircraft(self):
        entries = [
            make_entry(total_time=1.0, registration="N111AA"),
            make_entry(total_time=1.0, registration="N111AA"),
            make_entry(total_time=1.0, registration="N222BB"),
        ]
        result = calculate_aircraft_stats(entries)
        by_reg = {r["registration"]: r for r in result}
        assert by_reg["N111AA"]["num_flights"] == 2
        assert by_reg["N222BB"]["num_flights"] == 1

    def test_sorted_by_total_time_descending(self):
        entries = [
            make_entry(total_time=1.0, registration="N111AA"),
            make_entry(total_time=5.0, registration="N333CC"),
            make_entry(total_time=2.0, registration="N222BB"),
        ]
        result = calculate_aircraft_stats(entries)
        times = [r["total_time"] for r in result]
        assert times == sorted(times, reverse=True)
        assert result[0]["registration"] == "N333CC"

    def test_includes_required_fields(self):
        entries = [make_entry(total_time=1.0, registration="N12345", category_class="ASEL")]
        result = calculate_aircraft_stats(entries)
        assert len(result) == 1
        rec = result[0]
        assert rec["registration"] == "N12345"
        assert rec["type"] == "C172"
        assert rec["category_class"] == "ASEL"
        assert rec["total_time"] == pytest.approx(1.0)
        assert rec["num_flights"] == 1

    def test_empty_entries_returns_empty_list(self):
        result = calculate_aircraft_stats([])
        assert result == []
