"""Private source-reviewed performance contracts; no model output is authority."""

from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from ..services.aircraft_library.store import icao

Number = Annotated[float, Field(strict=True, allow_inf_nan=False)]
Text = Annotated[str, Field(min_length=1, max_length=200)]
Condition = Number | Text
METRIC_UNITS = {
    "takeoff_ground_roll_ft": "ft",
    "takeoff_over_50ft_ft": "ft",
    "landing_ground_roll_ft": "ft",
    "landing_over_50ft_ft": "ft",
    "climb_rate_fpm": "ft/min",
    "climb_time_min": "min",
    "climb_fuel_gal": "US gal",
    "climb_distance_nm": "NM",
    "cruise_tas_kt": "kt TAS",
    "cruise_fuel_flow_gph": "US gal/h",
    "endurance_hours": "h",
    "range_nm": "NM",
}
AXIS_UNITS = {
    "pressure_altitude_ft": "ft",
    "temperature_c": "C",
    "weight_lb": "lb",
    "power_pct": "%",
    "rpm": "rpm",
    "isa_deviation_c": "C from ISA",
    "fuel_on_board_gal": "US gal",
    "reserve_minutes": "min",
}
Metric = Literal[
    "takeoff_ground_roll_ft",
    "takeoff_over_50ft_ft",
    "landing_ground_roll_ft",
    "landing_over_50ft_ft",
    "climb_rate_fpm",
    "climb_time_min",
    "climb_fuel_gal",
    "climb_distance_nm",
    "cruise_tas_kt",
    "cruise_fuel_flow_gph",
    "endurance_hours",
    "range_nm",
]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class Citation(Strict):
    page: int = Field(ge=1, le=2000)
    quote: str = Field(min_length=8, max_length=1200)


class Point(Strict):
    coordinates: dict[str, Number] = Field(min_length=1, max_length=4)
    value: Number = Field(ge=0)
    citations: list[Citation] = Field(min_length=1, max_length=8)


class LinearCorrection(Strict):
    kind: Literal["linear_percent"]
    percent_of: Literal["current_result"]
    name: Text
    variable: Literal["headwind_kt", "runway_slope_pct"]
    reference: Number
    minimum: Number
    maximum: Number
    percent: Number = Field(gt=0, le=500)
    per_units: Number = Field(gt=0)
    direction: Literal["increase", "decrease"]
    citations: list[Citation] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def interval(self):
        if not self.minimum < self.maximum or self.reference not in (self.minimum, self.maximum):
            raise ValueError(
                "Correction coverage must extend to one side of its reference condition"
            )
        return self


class SurfaceCorrection(Strict):
    kind: Literal["surface_percent"]
    percent_of: Literal["current_result"]
    name: Text
    variable: Literal["runway_surface"]
    reference: Text
    match_value: Text
    percent: Number = Field(gt=0, le=500)
    direction: Literal["increase", "decrease"]
    citations: list[Citation] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def different_surface(self):
        if self.reference == self.match_value:
            raise ValueError("Corrected surface must differ from its reference")
        return self


Correction = Annotated[LinearCorrection | SurfaceCorrection, Field(discriminator="kind")]


class Table(Strict):
    id: str = Field(pattern=r"^[a-z][a-z0-9_-]{0,63}$")
    metric: Metric
    source_table: Text
    axes: list[str] = Field(min_length=1, max_length=4)
    interpolation_axes: list[str] = Field(default_factory=list, max_length=4)
    interpolation_citations: list[Citation] = Field(default_factory=list, max_length=8)
    fixed_conditions: dict[str, Condition] = Field(min_length=1, max_length=20)
    points: list[Point] = Field(min_length=2, max_length=400)
    corrections: list[Correction] = Field(default_factory=list, max_length=12)
    correction_order: list[Text] = Field(default_factory=list, max_length=12)
    combination_citations: list[Citation] = Field(default_factory=list, max_length=8)
    notes: list[Annotated[str, Field(max_length=2000)]] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def coverage(self):
        if len(set(self.axes)) != len(self.axes) or set(self.axes) - AXIS_UNITS.keys():
            raise ValueError("Table axes must be distinct known unit-explicit coordinates")
        if set(self.axes) & self.fixed_conditions.keys():
            raise ValueError("An axis cannot also be a fixed condition")
        conditions = set(self.axes) | self.fixed_conditions.keys()
        if len(set(self.interpolation_axes)) != len(self.interpolation_axes) or set(
            self.interpolation_axes
        ) - set(self.axes):
            raise ValueError("Interpolation permission must name distinct declared axes")
        if self.interpolation_axes and not self.interpolation_citations:
            raise ValueError("Interpolation requires explicit reviewed original-page evidence")
        if len({"temperature_c", "isa_deviation_c"} & conditions) != 1:
            raise ValueError("Declare exactly one absolute or ISA-deviation temperature condition")
        required = {"weight_lb", "pressure_altitude_ft"}
        if self.metric.startswith(("takeoff_", "landing_")):
            required |= {"headwind_kt", "runway_slope_pct", "runway_surface"}
        if self.metric in {"endurance_hours", "range_nm"}:
            required |= {"fuel_on_board_gal", "reserve_minutes"}
        if required - (set(self.axes) | self.fixed_conditions.keys()):
            raise ValueError(
                "Table lacks required weight, atmosphere, runway or fuel/reserve conditions"
            )
        for point in self.points:
            if set(point.coordinates) != set(self.axes):
                raise ValueError("Every point must identify exactly the declared axes")
            if point.value == 0 and self.metric not in {
                "climb_time_min",
                "climb_fuel_gal",
                "climb_distance_nm",
            }:
                raise ValueError("This performance metric must be positive")
        names = [rule.name for rule in self.corrections]
        if len(set(names)) != len(names) or any(not name.strip() for name in names):
            raise ValueError("Correction names must be nonempty and unique")
        if self.correction_order or self.combination_citations:
            if (
                not self.combination_citations
                or len(set(self.correction_order)) != len(self.correction_order)
                or set(self.correction_order) != set(names)
            ):
                raise ValueError(
                    "Combined corrections require original-page evidence and an explicit complete order"
                )
        for index, first in enumerate(self.corrections):
            for second in self.corrections[index + 1 :]:
                if first.variable != second.variable:
                    continue
                if isinstance(first, LinearCorrection) and isinstance(second, LinearCorrection):
                    if max(first.minimum, second.minimum) < min(first.maximum, second.maximum):
                        raise ValueError("Correction coverage for one condition must not overlap")
                elif (
                    isinstance(first, SurfaceCorrection)
                    and isinstance(second, SurfaceCorrection)
                    and first.match_value == second.match_value
                ):
                    raise ValueError("Duplicate corrected-surface coverage")
        for correction in self.corrections:
            if self.fixed_conditions.get(correction.variable) != correction.reference:
                raise ValueError("Correction reference must match an explicit fixed condition")
        return self


class DatasetDraft(Strict):
    title: Text
    source_document_id: str = Field(pattern=r"^doc_[a-f0-9]{32}$")
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    icao: str = Field(min_length=2, max_length=4)
    variant: Text
    source_revision: Text
    configuration: str = Field(min_length=1, max_length=2000)
    tables: list[Table] = Field(min_length=1, max_length=20)

    @field_validator("icao")
    @classmethod
    def type_code(cls, value):
        return icao(value)

    @model_validator(mode="after")
    def identities(self):
        if len({t.id for t in self.tables}) != len(self.tables):
            raise ValueError("Table identifiers must be unique within a dataset")
        if (
            not self.variant.strip()
            or not self.source_revision.strip()
            or not self.configuration.strip()
        ):
            raise ValueError("Exact variant, source revision and configuration are required")
        return self


class Review(Strict):
    expected_content_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    reviewer: Text
    attest_source_and_applicability: bool

    @model_validator(mode="after")
    def attestation(self):
        if self.attest_source_and_applicability is not True or not self.reviewer.strip():
            raise ValueError(
                "Explicit source, units, conditions and applicability review is required"
            )
        return self


class Retirement(Strict):
    expected_content_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    reason: str = Field(min_length=5, max_length=1000)


class Calculation(Strict):
    icao: str = Field(min_length=2, max_length=4)
    registration: str | None = Field(default=None, max_length=20)
    variant: Text
    configuration: str = Field(min_length=1, max_length=2000)
    table_id: str = Field(min_length=1, max_length=64)
    conditions: dict[str, Condition] = Field(min_length=1, max_length=24)


class DatasetRecord(Strict):
    id: str
    content_sha256: str
    content: DatasetDraft
    source_metadata: dict[str, str | list[str]]
    created_at: str
    reviewed_at: str | None
    reviewer: str | None
    retired_at: str | None
    retirement_reason: str | None
    state: Literal["draft", "reviewed", "stale", "retired"]
    usable: bool
    unavailable_reason: str | None


class DatasetSummary(Strict):
    id: str
    content_sha256: str
    title: str
    icao: str
    variant: str
    source_revision: str
    configuration: str
    source_document_id: str
    source_sha256: str
    created_at: str
    reviewed_at: str | None
    reviewer: str | None
    retired_at: str | None
    retirement_reason: str | None
    state: Literal["draft", "reviewed", "stale", "retired"]
    usable: bool
    unavailable_reason: str | None
    table_ids: list[str]
    metrics: list[Metric]


class DatasetList(Strict):
    datasets: list[DatasetSummary]
    offset: int
    limit: int
    total: int


class Capabilities(Strict):
    metrics: dict[str, str]
    axes: dict[str, str]
    requires_explicit_review: Literal[True]
    extrapolation: Literal[False]
    model_provider_required: Literal[False]
    privacy: str
    max_points_per_table: int
    correction_scope: str
    limitations: str


class Contribution(Strict):
    coordinates: dict[str, Number]
    value: Number
    weight: Number
    citations: list[Citation]


class CorrectionStep(Strict):
    rule: Correction
    requested_value: Condition
    factor: Number


class Source(Strict):
    document_id: str
    sha256: str
    original_url: str
    revision: str
    metadata: dict[str, str | list[str]]


class Result(Strict):
    dataset_id: str
    content_sha256: str
    table_id: str
    metric: Metric
    units: str
    value: Number
    uncorrected_value: Number
    conditions: dict[str, Condition]
    variant: str
    configuration: str
    registration: str | None
    source: Source
    source_table: str
    interpolation_axes: list[str]
    interpolation_citations: list[Citation]
    combination_citations: list[Citation]
    contributions: list[Contribution]
    corrections: list[CorrectionStep]
    notes: list[str]
    reviewer: str
    reviewed_at: str
    calculated_at: str
    method: str
    warnings: list[str]
    approved_for_flight: Literal[False]
    limitations: str
