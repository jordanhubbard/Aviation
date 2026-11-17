"""Lossless source semantics with bounded list previews and explicit coverage."""

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

Environment = Literal["production", "staging", "fit"]
Status = Literal["available", "no_reports", "partial", "stale", "unavailable"]
Activity = Literal[
    "effective",
    "scheduled",
    "expired",
    "cancelled",
    "unknown_end",
    "unknown_type",
    "source_incomplete",
    "schedule_requires_review",
]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class NMSSource(Model):
    provider: Literal["FAA NMS"] = "FAA NMS"
    url: str | None
    retrieved_at_utc: str | None
    environment: Environment | None


class NMSNotice(Model):
    id: str
    number: str | None
    series: str | None
    year: str | None
    location: str
    icao_location: str | None
    text: str | None
    text_length: int
    text_truncated: bool
    detail_url: str
    classification: str
    type: str | None
    effective_start_utc: str | None
    effective_end_utc: str | None
    cancelled_at_utc: str | None
    last_updated_utc: str
    permanent: bool
    estimated: bool
    schedule: str | None
    activity: Activity
    missing_fields: list[str]
    severity: Literal["critical", "high", "medium", "low"] | None = Field(
        description="Advisory keyword-based text hint, not an FAA-assigned severity or flight-applicability determination"
    )


class NMSReports(Model):
    snapshot_id: str | None
    status: Status
    environment: Environment | None
    production_data: bool
    complete_snapshot: bool
    requested_locations: list[str]
    matched_locations: list[str]
    source: NMSSource
    synchronized_at: str | None
    full_load_at: str | None
    incomplete_records: int
    total: int
    offset: int
    limit: int
    next_offset: int | None
    notams: list[NMSNotice]
    warnings: list[str]
    error: str | None = None


class NMSDetail(Model):
    snapshot_id: str
    status: Status
    environment: Environment
    production_data: bool
    source: NMSSource
    notice: NMSNotice
    source_feature: dict
    warnings: list[str]


class NMSCapabilities(Model):
    environment: Environment | None
    cache_present: bool
    reads_contact_provider: Literal[False] = False
    client_credentials_required: Literal[False] = False
    coverage: str
    max_locations: Literal[100] = 100
    max_page_size: Literal[100] = 100
    source_text_in_list: Literal["preview"] = "preview"
    warnings: list[str]
