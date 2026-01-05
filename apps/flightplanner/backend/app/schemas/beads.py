from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class BeadsErrorReport(BaseModel):
    source: Literal["frontend", "backend", "log"] = Field(
        ..., description="Where the error originated"
    )
    message: str = Field(..., description="Human readable error message")
    stack: Optional[str] = Field(None, description="Stack trace, if available")
    url: Optional[str] = Field(None, description="URL where error occurred (frontend)")
    user_agent: Optional[str] = Field(None, description="Browser user agent (frontend)")
    context: dict[str, Any] = Field(default_factory=dict, description="Extra context")


class BeadsReportResponse(BaseModel):
    enabled: bool
    created: bool
    issue_id: Optional[str] = None
    reason: Optional[str] = None
