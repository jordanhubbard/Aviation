from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class IssueErrorReport(BaseModel):
    source: Literal["frontend", "backend", "log"] = Field(
        ..., description="Where the error originated"
    )
    message: str = Field(
        ..., min_length=1, max_length=4000, description="Human readable error message"
    )
    stack: Optional[str] = Field(
        None, max_length=12000, description="Stack trace, if available"
    )
    url: Optional[str] = Field(
        None, max_length=2000, description="URL where error occurred (frontend)"
    )
    user_agent: Optional[str] = Field(None, description="Browser user agent (frontend)")
    context: dict[str, Any] = Field(default_factory=dict, description="Extra context")


class IssueReportResponse(BaseModel):
    enabled: bool
    created: bool
    issue_number: Optional[int] = None
    issue_url: Optional[str] = None
    reason: Optional[str] = None
