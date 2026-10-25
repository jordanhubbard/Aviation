"""FastAPI application: JSON API plus the static front end."""
from __future__ import annotations

import os
import base64
import binascii
import shutil
import sqlite3
import threading
import time
from contextvars import ContextVar
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import aggregate, e2e, llm, poh
from .kml import MAX_BYTES, KmlError
from .store import Store

STATIC = Path(__file__).resolve().parent.parent / "static"
MAX_FILES = 25


class AskBody(BaseModel):
    question: str
    flight_ids: list[str] = []


class DebriefBody(BaseModel):
    focus: str | None = None


class MetaBody(BaseModel):
    aircraft: str | None = Field(None, max_length=10)
    oat_c: float | None = Field(None, ge=-60, le=60)
    altimeter_inhg: float | None = Field(None, ge=27.0, le=32.0)
    weight_lb: float | None = Field(None, ge=300, le=20000)
    wind_from_deg: float | None = Field(None, ge=0, le=360)
    wind_kt: float | None = Field(None, ge=0, le=80)


class PohRow(BaseModel):
    pa_ft: float = Field(ge=-2000, le=30000)
    oat_c: float = Field(ge=-60, le=60)
    ground_roll_ft: float | None = Field(None, ge=0, le=20000)
    total50_ft: float | None = Field(None, ge=0, le=30000)


class PohBody(BaseModel):
    takeoff: list[PohRow] = Field(default_factory=list, max_length=300)
    landing: list[PohRow] = Field(default_factory=list, max_length=300)
    weight_lb: float | None = Field(None, ge=300, le=20000)
    notes: str = Field("", max_length=300)


class E2EFixture(BaseModel):
    fixture_type: str
    record: dict


def create_app(data_dir: str | None = None) -> FastAPI:
    app = FastAPI(title="Flight track analyzer", docs_url="/api/docs", openapi_url="/api/openapi.json")
    store = Store(data_dir or os.environ.get("KMLAB_DATA_DIR", "data"))
    app.state.store = store
    active = ContextVar("kmlab_store", default=store)
    test_root = store.root / "__e2e"
    test_stores: dict[str, Store] = {}
    test_lock = threading.RLock()

    def remove_expired_runs():
        if not test_root.exists():
            return
        cutoff = time.time() - 3600
        for child in test_root.iterdir():
            if child.is_dir() and e2e.RUN_ID.fullmatch(child.name) and child.stat().st_mtime < cutoff:
                test_stores.pop(child.name, None)
                shutil.rmtree(child)

    def current_store() -> Store:
        return active.get()

    @app.middleware("http")
    async def isolate_e2e(request: Request, call_next):
        if not request.url.path.startswith(("/api/", "/__e2e/")):
            return await call_next(request)
        try:
            run = e2e.verified_run(request)
        except HTTPException as error:
            return JSONResponse({"error": error.detail}, status_code=error.status_code)
        if request.url.path.startswith("/__e2e/") and run is None:
            return JSONResponse({"error": "E2E credentials required"}, status_code=403)
        if run is None:
            return await call_next(request)
        if (request.url.path == f"/__e2e/runs/{run}" and request.method == "GET"
                and not (test_root / run).exists()):
            return JSONResponse({"count": 0, "is_test_data": True, "test_run_id": run})
        with test_lock:
            remove_expired_runs()
            if run not in test_stores:
                test_stores[run] = Store(test_root / run)
                with sqlite3.connect(test_stores[run].db_path) as connection:
                    connection.execute("CREATE TABLE IF NOT EXISTS e2e_runs "
                                       "(test_run_id TEXT PRIMARY KEY, is_test_data INTEGER NOT NULL CHECK(is_test_data=1))")
                    connection.execute("INSERT OR IGNORE INTO e2e_runs VALUES (?, 1)", (run,))
                    for table in ("aircraft", "flights", "flight_conditions", "events", "patterns", "poh_meta", "poh_reference"):
                        cols = {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}
                        if "is_test_data" not in cols:
                            connection.execute(f"ALTER TABLE {table} ADD COLUMN is_test_data INTEGER NOT NULL DEFAULT 1 CHECK(is_test_data=1)")
                        if "test_run_id" not in cols:
                            connection.execute(f"ALTER TABLE {table} ADD COLUMN test_run_id TEXT NOT NULL DEFAULT '{run}' CHECK(test_run_id='{run}')")
            selected = test_stores[run]
        token = active.set(selected)
        request.state.e2e_run = run
        try:
            return await call_next(request)
        finally:
            active.reset(token)

    @app.get("/__e2e/runs/{run_id}")
    def e2e_status(run_id: str, request: Request):
        if run_id != request.state.e2e_run:
            raise HTTPException(403, "E2E run mismatch")
        return {"count": len(current_store().list()), "is_test_data": True, "test_run_id": run_id}

    @app.delete("/__e2e/runs/{run_id}")
    def e2e_cleanup(run_id: str, request: Request):
        if run_id != request.state.e2e_run:
            raise HTTPException(403, "E2E run mismatch")
        with test_lock:
            test_stores.pop(run_id, None)
            shutil.rmtree(test_root / run_id, ignore_errors=False)
        return {"deleted": run_id, "is_test_data": True, "test_run_id": run_id}

    @app.post("/__e2e/fixtures")
    def e2e_fixture(body: E2EFixture, request: Request):
        run = request.state.e2e_run
        record = body.record
        if (body.fixture_type != "flight" or record.get("is_test_data") is not True
                or record.get("test_run_id") != run or record.get("aircraft") != "E2E"):
            raise HTTPException(422, "invalid tagged E2E flight")
        try:
            data = base64.b64decode(record["kml_base64"], validate=True)
        except (KeyError, TypeError, ValueError, binascii.Error):
            raise HTTPException(422, "invalid KML fixture") from None
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "KML fixture too large")
        flights = current_store().ingest(data, f"{run}.kml", "E2E")
        if not flights or any("error" in flight for flight in flights):
            raise HTTPException(422, "KML fixture analysis failed")
        return {"id": flights[0]["id"], "count": len(flights), "is_test_data": True, "test_run_id": run}

    @app.exception_handler(HTTPException)
    async def _http(_: Request, e: HTTPException):
        if isinstance(e.detail, dict):
            return JSONResponse({"error": e.detail.get("message", "error"), **{k: v for k, v in e.detail.items() if k != "message"}}, status_code=e.status_code)
        return JSONResponse({"error": e.detail}, status_code=e.status_code)

    @app.exception_handler(RequestValidationError)
    async def _val(_: Request, e: RequestValidationError):
        return JSONResponse({"error": "invalid request", "detail": [x["msg"] for x in e.errors()]}, status_code=422)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/capabilities")
    def capabilities():
        return llm.capabilities()

    @app.post("/api/flights")
    def upload(files: list[UploadFile] = File(...), aircraft: list[str] = Form(default=[])):
        """Each file must come with an aircraft tail number: one `aircraft` value per file (same order),
        or a single value applied to every file. Validated for all files before anything is parsed."""
        if len(files) > MAX_FILES:
            raise HTTPException(413, f"at most {MAX_FILES} files per upload")
        tails = [t.strip().upper() for t in aircraft]
        if len(tails) == 1 and len(files) > 1:
            tails = tails * len(files)
        names = [os.path.basename(f.filename or "upload.kml") for f in files]
        if len(tails) != len(files):
            raise HTTPException(422, {"message": "an aircraft tail number is required for every file "
                                      f"(got {len(tails)} for {len(files)} file(s))", "files": names})
        bad = [n for n, t in zip(names, tails) if not current_store().valid_tail(t)]
        if bad:
            raise HTTPException(422, {"message": "aircraft tail number missing or invalid "
                                      "(letters, digits or '-', max 10)", "files": bad})
        results = []
        for f, tail in zip(files, tails):
            data = f.file.read(MAX_BYTES + 1)
            name = os.path.basename(f.filename or "upload.kml")
            if len(data) > MAX_BYTES:
                results.append({"filename": name, "error": "file too large"})
                continue
            try:
                for r in current_store().ingest(data, name, tail):
                    results.append({"filename": name, **r})
            except KmlError as e:
                results.append({"filename": name, "error": str(e)})
            except Exception as e:  # never let one bad file fail the rest of the batch
                results.append({"filename": name, "error": f"could not process file: {type(e).__name__}"})
        return {"results": results}

    @app.get("/api/flights")
    def list_flights():
        return {"flights": current_store().list()}

    @app.get("/api/flights/{fid}")
    def get_flight(fid: str, target_agl_ft: float | None = Query(None, gt=100, lt=5000)):
        a = current_store().get(fid, target_agl_ft)
        if a is None:
            raise HTTPException(404, "flight not found")
        return a

    @app.delete("/api/flights/{fid}")
    def delete_flight(fid: str):
        if not current_store().delete(fid):
            raise HTTPException(404, "flight not found")
        return {"deleted": fid}

    @app.get("/api/summary")
    def summary(ids: str | None = None, aircraft: str | None = None):
        want = [i for i in (ids or "").split(",") if i] or [r["id"] for r in current_store().list(_tail(aircraft) if aircraft else None)]
        flights = [a for a in (current_store().get(i) for i in want) if a]
        return aggregate.summarize(flights)

    @app.get("/api/flights/{fid}/meta")
    def get_meta(fid: str):
        a = current_store().get(fid)
        if a is None:
            raise HTTPException(404, "flight not found")
        return {**current_store().get_meta(fid), "aircraft_guess": poh.guess_aircraft(a), "field_elev_ft": (a["fields"] or [{}])[0].get("elev_ft")}

    @app.put("/api/flights/{fid}/meta")
    def put_meta(fid: str, body: MetaBody):
        if current_store().get(fid) is None:
            raise HTTPException(404, "flight not found")
        d = body.model_dump()
        d["aircraft"] = (d["aircraft"] or "").strip().upper()
        if not current_store().valid_tail(d["aircraft"]):
            raise HTTPException(422, "every flight needs an aircraft tail number (letters, digits or '-', max 10)")
        if (d["wind_kt"] is None) != (d["wind_from_deg"] is None):
            raise HTTPException(422, "give both wind direction and speed, or neither")
        return current_store().set_meta(fid, d)

    @app.get("/api/aircraft")
    def aircraft_list():
        return {"aircraft": current_store().aircraft_list()}

    def _tail(t: str) -> str:
        t = t.upper()
        if not current_store().valid_tail(t):
            raise HTTPException(422, "invalid aircraft id")
        return t

    @app.get("/api/aircraft/{tail}/poh")
    def get_poh(tail: str):
        return current_store().get_poh(_tail(tail))

    @app.put("/api/aircraft/{tail}/poh")
    def put_poh(tail: str, body: PohBody):
        return current_store().set_poh(_tail(tail), body.model_dump())

    @app.get("/api/performance")
    def performance(aircraft: str | None = None):
        want = _tail(aircraft) if aircraft else None
        by_tail: dict = {}
        for r in current_store().list(want):
            a = current_store().get(r["id"])
            if a:
                by_tail.setdefault(r["aircraft"], []).extend(poh.event_rows(a, current_store().get_meta(r["id"])))
        out = []
        for tail, rows in sorted(by_tail.items()):
            ref = current_store().get_poh(tail)
            out.append({"aircraft": tail, "has_poh": bool(ref["takeoff"] or ref["landing"]), "poh_notes": ref.get("notes"),
                        "poh_weight_lb": ref.get("weight_lb"), "flights": len({x["flight_id"] for x in rows}),
                        "sections": poh.build(rows, ref)})
        return {"aircraft": out}

    def _need_llm():
        if llm.config() is None:
            raise HTTPException(404, "not found")

    @app.post("/api/flights/{fid}/debrief")
    def debrief(fid: str, body: DebriefBody | None = None):
        _need_llm()
        a = current_store().get(fid)
        if a is None:
            raise HTTPException(404, "flight not found")
        try:
            return {"text": llm.debrief(a, body.focus if body else None), "model": llm.capabilities()["model"]}
        except httpx.HTTPError as e:
            raise HTTPException(502, f"LLM request failed ({type(e).__name__})")

    @app.post("/api/ask")
    def ask(body: AskBody):
        _need_llm()
        ids = body.flight_ids or [r["id"] for r in current_store().list()][:5]
        flights = [a for a in (current_store().get(i) for i in ids) if a]
        if not flights:
            raise HTTPException(404, "no flights to ask about")
        try:
            return {"text": llm.ask(flights, body.question), "model": llm.capabilities()["model"]}
        except httpx.HTTPError as e:
            raise HTTPException(502, f"LLM request failed ({type(e).__name__})")

    if STATIC.exists():
        app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="static")
    return app
