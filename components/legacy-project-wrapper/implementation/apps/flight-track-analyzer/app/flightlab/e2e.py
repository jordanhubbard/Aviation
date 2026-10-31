"""KMLab adapter for the shared SDK's signed E2E run protocol."""
import os

from fastapi import HTTPException, Request
from aviation.e2e import E2EContractError, RUN_ID_PATTERN, verify_e2e_headers

APP_ID = "flight-track-analyzer"
RUN_ID = RUN_ID_PATTERN


def verified_run(request: Request) -> str | None:
    try:
        return verify_e2e_headers(APP_ID, request.headers, os.environ.get("AVIATION_E2E_SECRET"))
    except E2EContractError as error:
        raise HTTPException(403, str(error)) from None
