"""FastAPI application: JSON API plus the static front end."""
from __future__ import annotations

import os
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import aggregate, llm, poh
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


def create_app(data_dir: str | None = None) -> FastAPI:
    app = FastAPI(title="Flight track analyzer", docs_url="/api/docs", openapi_url="/api/openapi.json")
    store = Store(data_dir or os.environ.get("KMLAB_DATA_DIR", "data"))
    app.state.store = store

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
        bad = [n for n, t in zip(names, tails) if not store.valid_tail(t)]
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
                for r in store.ingest(data, name, tail):
                    results.append({"filename": name, **r})
            except KmlError as e:
                results.append({"filename": name, "error": str(e)})
            except Exception as e:  # never let one bad file fail the rest of the batch
                results.append({"filename": name, "error": f"could not process file: {type(e).__name__}"})
        return {"results": results}

    @app.get("/api/flights")
    def list_flights():
        return {"flights": store.list()}

    @app.get("/api/flights/{fid}")
    def get_flight(fid: str, target_agl_ft: float | None = Query(None, gt=100, lt=5000)):
        a = store.get(fid, target_agl_ft)
        if a is None:
            raise HTTPException(404, "flight not found")
        return a

    @app.delete("/api/flights/{fid}")
    def delete_flight(fid: str):
        if not store.delete(fid):
            raise HTTPException(404, "flight not found")
        return {"deleted": fid}

    @app.get("/api/summary")
    def summary(ids: str | None = None, aircraft: str | None = None):
        want = [i for i in (ids or "").split(",") if i] or [r["id"] for r in store.list(_tail(aircraft) if aircraft else None)]
        flights = [a for a in (store.get(i) for i in want) if a]
        return aggregate.summarize(flights)

    @app.get("/api/flights/{fid}/meta")
    def get_meta(fid: str):
        a = store.get(fid)
        if a is None:
            raise HTTPException(404, "flight not found")
        return {**store.get_meta(fid), "aircraft_guess": poh.guess_aircraft(a), "field_elev_ft": (a["fields"] or [{}])[0].get("elev_ft")}

    @app.put("/api/flights/{fid}/meta")
    def put_meta(fid: str, body: MetaBody):
        if store.get(fid) is None:
            raise HTTPException(404, "flight not found")
        d = body.model_dump()
        d["aircraft"] = (d["aircraft"] or "").strip().upper()
        if not store.valid_tail(d["aircraft"]):
            raise HTTPException(422, "every flight needs an aircraft tail number (letters, digits or '-', max 10)")
        if (d["wind_kt"] is None) != (d["wind_from_deg"] is None):
            raise HTTPException(422, "give both wind direction and speed, or neither")
        return store.set_meta(fid, d)

    @app.get("/api/aircraft")
    def aircraft_list():
        return {"aircraft": store.aircraft_list()}

    def _tail(t: str) -> str:
        t = t.upper()
        if not store.valid_tail(t):
            raise HTTPException(422, "invalid aircraft id")
        return t

    @app.get("/api/aircraft/{tail}/poh")
    def get_poh(tail: str):
        return store.get_poh(_tail(tail))

    @app.put("/api/aircraft/{tail}/poh")
    def put_poh(tail: str, body: PohBody):
        return store.set_poh(_tail(tail), body.model_dump())

    @app.get("/api/performance")
    def performance(aircraft: str | None = None):
        want = _tail(aircraft) if aircraft else None
        by_tail: dict = {}
        for r in store.list(want):
            a = store.get(r["id"])
            if a:
                by_tail.setdefault(r["aircraft"], []).extend(poh.event_rows(a, store.get_meta(r["id"])))
        out = []
        for tail, rows in sorted(by_tail.items()):
            ref = store.get_poh(tail)
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
        a = store.get(fid)
        if a is None:
            raise HTTPException(404, "flight not found")
        try:
            return {"text": llm.debrief(a, body.focus if body else None), "model": llm.capabilities()["model"]}
        except httpx.HTTPError as e:
            raise HTTPException(502, f"LLM request failed ({type(e).__name__})")

    @app.post("/api/ask")
    def ask(body: AskBody):
        _need_llm()
        ids = body.flight_ids or [r["id"] for r in store.list()][:5]
        flights = [a for a in (store.get(i) for i in ids) if a]
        if not flights:
            raise HTTPException(404, "no flights to ask about")
        try:
            return {"text": llm.ask(flights, body.question), "model": llm.capabilities()["model"]}
        except httpx.HTTPError as e:
            raise HTTPException(502, f"LLM request failed ({type(e).__name__})")

    if STATIC.exists():
        app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="static")
    return app
