"""Bounded rectangular interpolation shared by retained and sourced table APIs."""

from itertools import product
import math


def interpolate(points, axes, target):
    if not 1 <= len(axes) <= 4 or len(set(axes)) != len(axes):
        raise ValueError("Provide one to four distinct table axes")
    if not points or len(points) > 400 or set(target) != set(axes):
        raise ValueError("Provide a bounded table and every table axis")
    grid = {}
    values = {axis: set() for axis in axes}
    for row in points:
        coordinates = row["coordinates"]
        if set(coordinates) != set(axes):
            raise ValueError("Each point must provide exactly the declared axes")
        key = tuple(coordinates[axis] for axis in axes)
        if any(type(n) not in (int, float) or not math.isfinite(n) for n in (*key, row["value"])):
            raise ValueError("Table coordinates and values must be finite numbers")
        if key in grid:
            raise ValueError("Duplicate table point")
        grid[key] = row
        for axis, value in zip(axes, key):
            values[axis].add(value)
    ordered = {axis: sorted(values[axis]) for axis in axes}
    if len(grid) != math.prod(len(v) for v in ordered.values()):
        raise ValueError("Provide a complete rectangular grid")
    brackets = []
    for axis in axes:
        value, coordinates = target[axis], ordered[axis]
        if type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError("Requested table coordinates must be finite numbers")
        if not coordinates[0] <= value <= coordinates[-1]:
            raise ValueError(
                "Requested conditions are outside the supplied POH table; extrapolation is prohibited"
            )
        if value in values[axis]:
            brackets.append([(value, 1.0)])
        else:
            low, high = next((a, b) for a, b in zip(coordinates, coordinates[1:]) if a < value < b)
            if not math.isfinite(high - low):
                raise ValueError("Table axis interval must be finite")
            fraction = (value - low) / (high - low)
            brackets.append([(low, 1 - fraction), (high, fraction)])
    contributions = []
    for vertex in product(*brackets):
        key = tuple(pair[0] for pair in vertex)
        weight = math.prod(pair[1] for pair in vertex)
        row = grid[key]
        contributions.append(
            {
                "coordinates": dict(zip(axes, key)),
                "value": row["value"],
                "weight": weight,
                "citations": row.get("citations", []),
            }
        )
    result = sum(row["weight"] * row["value"] for row in contributions)
    if not math.isfinite(result):
        raise ValueError("Interpolation produced a non-finite result")
    return result, contributions
