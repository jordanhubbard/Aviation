"""Keep measured-flight clustering policy while sharing heading geometry."""

import math

import pytest

from flightlab.wind import _distinct_headings


def legs(headings):
    return [(math.sin(math.radians(h)), math.cos(math.radians(h)), 60) for h in headings]


@pytest.mark.parametrize(
    "headings,separation,count",
    [
        ([], 40, 0),
        ([0, 0, 360], 40, 1),
        ([359, 1], 40, 1),
        ([340, 20], 40, 2),
        ([340, 20], 40 + 1e-7, 1),
        ([0, 40 - 1e-7], 40, 1),
        ([0, 40 + 1e-7], 40, 2),
        ([0, 90], 90, 2),
        ([0, 180], 180, 2),
        ([0, 180], 180 + 1e-7, 1),
        ([90, 50, 10], 50, 2),  # Sorting selects 10 then 90, not just 50.
        ([0, 30, 60, 90], 40, 2),  # Greedy representatives, not single linkage.
        ([350, 10, 50, 170, 290], 40, 4),
    ],
)
def test_distinct_wind_heading_policy(headings, separation, count):
    assert _distinct_headings(legs(headings), sep=separation) == count


def test_default_separation_and_input_order():
    headings = [350, 10, 50, 170, 290]
    assert _distinct_headings(legs(headings)) == 4
    assert _distinct_headings(legs(reversed(headings))) == 4
