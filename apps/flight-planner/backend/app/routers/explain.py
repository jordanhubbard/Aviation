"""
AI explanation router for the Flight Planner backend.

Provides POST /api/explain endpoint that proxies requests to the RCC brain API.
"""
from __future__ import annotations

import os
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["ai-explainer"])

_DEFAULT_BRAIN_URL = "http://localhost:8765/api/brain/request"


def _brain_url() -> str:
    return os.environ.get("RCC_BRAIN_URL", _DEFAULT_BRAIN_URL)


class ExplainRequest(BaseModel):
    context: str
    question: Optional[str] = None


class ExplainResponse(BaseModel):
    explanation: str


@router.post("/api/explain", response_model=ExplainResponse)
async def explain(body: ExplainRequest) -> ExplainResponse:
    """Proxy an explanation request to the RCC brain API."""
    payload: dict = {"context": body.context}
    if body.question is not None:
        payload["question"] = body.question

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(_brain_url(), json=payload)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"RCC brain request failed: {exc.response.status_code}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"RCC brain unreachable: {exc}",
        ) from exc

    data = response.json()
    if "explanation" not in data:
        raise HTTPException(
            status_code=502, detail="RCC brain response missing explanation field"
        )
    return ExplainResponse(explanation=data["explanation"])
