"""Optional LLM access. Everything here is inert unless an LLM is configured.

Environment:
  ANTHROPIC_API_KEY [+ KMLAB_LLM_MODEL]                       -> Anthropic Messages API
  KMLAB_LLM_BASE_URL (+ KMLAB_LLM_API_KEY, KMLAB_LLM_MODEL)    -> any OpenAI-compatible endpoint
  KMLAB_LLM_DISABLE=1                                          -> force off
Only a compact numeric digest of an analysis is ever sent; raw tracklog points never are.
"""
from __future__ import annotations

import json
import os

import httpx

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5"


class LlmDisabled(RuntimeError):
    pass


def config() -> dict | None:
    if os.environ.get("KMLAB_LLM_DISABLE") == "1":
        return None
    base = os.environ.get("KMLAB_LLM_BASE_URL")
    if base:
        return {"provider": "openai-compatible", "base_url": base.rstrip("/"),
                "key": os.environ.get("KMLAB_LLM_API_KEY", ""), "model": os.environ.get("KMLAB_LLM_MODEL", "default")}
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return {"provider": "anthropic", "key": key, "model": os.environ.get("KMLAB_LLM_MODEL", DEFAULT_ANTHROPIC_MODEL)}
    return None


def capabilities() -> dict:
    c = config()
    return {"llm": c is not None, "provider": c["provider"] if c else None, "model": c["model"] if c else None}


SYSTEM = ("You are an experienced flight instructor reviewing numbers derived from a GPS tracklog. "
          "Use ONLY figures present in the JSON digest; never invent numbers, aircraft types, or airport facts. "
          "Altitudes are GPS geometric, speeds are wind-corrected estimates only when the digest says so, and "
          "touchdown timing carries the stated uncertainty. Be concrete, prioritise the 3 most useful "
          "observations, and say when the data cannot support a conclusion.")


def complete(system: str, user: str, max_tokens: int = 1200) -> str:
    c = config()
    if not c:
        raise LlmDisabled("no LLM configured")
    if c["provider"] == "anthropic":
        r = httpx.post("https://api.anthropic.com/v1/messages", timeout=90,
                       headers={"x-api-key": c["key"], "anthropic-version": "2023-06-01"},
                       json={"model": c["model"], "max_tokens": max_tokens, "system": system,
                             "messages": [{"role": "user", "content": user}]})
        r.raise_for_status()
        return "".join(b.get("text", "") for b in r.json().get("content", []))
    headers = {"Authorization": f"Bearer {c['key']}"} if c["key"] else {}
    r = httpx.post(f"{c['base_url']}/chat/completions", timeout=90, headers=headers,
                   json={"model": c["model"], "max_tokens": max_tokens,
                         "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def _r(v, nd=0):
    return None if v is None else round(v, nd)


def digest(a: dict) -> dict:
    """Compact, coordinate-free numeric summary of one analysis."""
    def ev(e, keys):
        return {k: _r(e.get(k), 1) if isinstance(e.get(k), float) else e.get(k) for k in keys}
    return {
        "source": a["source"], "duration_min": _r(a["duration_s"] / 60, 1), "wind": a.get("wind") and
        {k: _r(v, 0) if isinstance(v, float) else v for k, v in a["wind"].items() if k in ("from_deg", "speed_kt", "confidence", "uncertainty_kt")},
        "speed_basis": a["speed_basis"], "warnings": a["warnings"],
        "takeoffs": [ev(t, ["kind", "style", "roll_entry_gs_kt", "runway", "ground_roll_ft", "dist50_ft", "gs_lof_kt", "headwind_kt", "timing_uncertainty_ft"]) for t in a["takeoffs"]],
        "landings": [ev(t, ["kind", "type", "runway", "dist50_ft", "roll_ft", "gs_td_kt", "tas_50_kt", "sink_fpm", "headwind_kt", "timing_uncertainty_ft"]) for t in a["landings"]],
        "go_arounds": len(a["go_arounds"]),
        "patterns": [{"side": p["side"], "straight_in": p["straight_in"],
                      "downwind_agl_ft": _r((p["legs"].get("downwind") or {}).get("agl_ft")),
                      "downwind_offset_ft": _r(abs((p["legs"].get("downwind") or {}).get("offset_ft") or 0) or None),
                      "downwind_speed_kt": _r((p["legs"].get("downwind") or {}).get("speed_kt")),
                      "agl_error_ft": _r(p.get("agl_error_ft")), "max_bank_deg": _r(p.get("max_bank_deg")),
                      "final": {k: _r(v, 1) for k, v in (p.get("final") or {}).items()}} for p in a["patterns"]],
        "performance": {k: v for k, v in a["performance"].items() if k in ("climb", "cruise", "descent", "best_rate_speed_kt", "max_bank_deg", "landing")},
        "accuracy": {k: v for k, v in a["accuracy"].items() if k in ("altitude_hold", "airspeed_hold", "pattern_altitude", "downwind_offset", "final_approach", "touchdown_repeatability")},
    }


def debrief(a: dict, focus: str | None = None) -> str:
    prompt = ("Write a flight debrief for the pilot: take-off, pattern work, approaches/landings, and precision of "
              "altitude and airspeed. End with up to three prioritised drills." + (f" Focus: {focus}" if focus else "") +
              "\n\nDIGEST:\n" + json.dumps(digest(a), separators=(",", ":")))
    return complete(SYSTEM, prompt)


def ask(analyses: list[dict], question: str) -> str:
    docs = {a["id"]: digest(a) for a in analyses}
    prompt = ("Answer the pilot's question from the digests only.\n\nQUESTION: " + question[:2000] +
              "\n\nDIGESTS:\n" + json.dumps(docs, separators=(",", ":")))
    return complete(SYSTEM, prompt)
