from __future__ import annotations

from fastapi import APIRouter
from aviation.health import create_health_report


router = APIRouter()


@router.get("/health")
def health() -> dict:
    return create_health_report()
