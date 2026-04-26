"""
Orbital Watch — Python backend
==============================

A standalone FastAPI service that replaces the two Supabase Edge Functions
(`fetch-tle` and `copilot`) so you can host the backend yourself on Render
(or any container host) instead of Lovable Cloud.

Endpoints
---------
GET  /health                  -> liveness probe
GET  /fetch-tle?group=active  -> CelesTrak proxy with in-memory 6h cache
POST /copilot                 -> Agentic Gemini chat with tool calling

Environment variables
---------------------
LOVABLE_API_KEY      (required for /copilot) — Lovable AI Gateway key.
                     If you don't have one, set GEMINI_API_KEY instead and
                     the service will call Google's API directly.
GEMINI_API_KEY       (optional fallback) — direct Google Gemini key.
ALLOWED_ORIGINS      (optional) — comma-separated CORS origins.
                     Defaults to "*". Set to your frontend URL in prod.
PORT                 (optional) — port to bind. Render sets this automatically.

Run locally
-----------
    pip install -r backend/requirements.txt
    uvicorn backend.app:app --reload --port 8000

Deploy on Render
----------------
    Build:  pip install -r backend/requirements.txt
    Start:  uvicorn backend.app:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------

app = FastAPI(title="Orbital Watch Backend", version="1.0.0")

_origins = os.getenv("ALLOWED_ORIGINS", "*")
allow_origins = ["*"] if _origins.strip() == "*" else [
    o.strip() for o in _origins.split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


# ===========================================================================
# /fetch-tle  — CelesTrak proxy with in-memory cache
# ===========================================================================

CACHE_TTL_S = 6 * 60 * 60  # 6 hours

ALLOWED_GROUPS = {
    "active",
    "stations",
    "starlink",
    "oneweb",
    "iridium-NEXT",
    "geo",
    "gps-ops",
    "galileo",
    "weather",
    "noaa",
    "goes",
    "science",
    "iridium-33-debris",
    "cosmos-1408-debris",
    "cosmos-2251-debris",
    "fengyun-1c-debris",
    "last-30-days",
}

# group_name -> { fetched_at: float, objects: list[dict] }
_tle_cache: Dict[str, Dict[str, Any]] = {}


def _parse_tle(text: str, group: str) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    lines = [l.rstrip() for l in text.splitlines()]
    i = 0
    while i + 2 < len(lines):
        name = lines[i].strip()
        l1 = lines[i + 1]
        l2 = lines[i + 2]
        if name and l1.startswith("1 ") and l2.startswith("2 "):
            out.append({
                "name": name,
                "noradId": l1[2:7].strip(),
                "line1": l1,
                "line2": l2,
                "group": group,
            })
            i += 3
        else:
            i += 1
    return out


@app.get("/fetch-tle")
async def fetch_tle(
    group: str = Query("active"),
    limit: int = Query(2000, ge=1, le=10000),
) -> Dict[str, Any]:
    group = group.strip()
    if group not in ALLOWED_GROUPS:
        raise HTTPException(status_code=400, detail=f"Group not allowed: {group}")

    now = time.time()
    cached = _tle_cache.get(group)
    is_fresh = cached is not None and (now - cached["fetched_at"]) < CACHE_TTL_S

    if not is_fresh:
        url = (
            "https://celestrak.org/NORAD/elements/gp.php"
            f"?GROUP={group}&FORMAT=tle"
        )
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    url, headers={"User-Agent": "OrbitalWatch/1.0 (+self-hosted)"}
                )
                resp.raise_for_status()
                parsed = _parse_tle(resp.text, group)
        except httpx.HTTPError as e:
            # If we have a stale cache, serve it rather than 500.
            if cached:
                parsed = cached["objects"]
            else:
                raise HTTPException(status_code=502, detail=f"CelesTrak error: {e}")

        if parsed:
            _tle_cache[group] = {"fetched_at": now, "objects": parsed}
            cached = _tle_cache[group]

    objects = (cached or {"objects": []})["objects"][:limit]
    fetched_at = (cached or {"fetched_at": now})["fetched_at"]

    return {
        "group": group,
        "count": len(objects),
        "cached": is_fresh,
        "fetchedAt": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime(fetched_at)
        ),
        "objects": objects,
    }


# ===========================================================================
# /copilot  — Agentic Gemini tool-calling endpoint
# ===========================================================================

class CatalogItem(BaseModel):
    id: str
    name: str
    kind: str  # "payload" | "rocket_body" | "debris"
    country: str = ""
    perigeeKm: float
    apogeeKm: float
    inclinationDeg: float
    periodMin: float
    risk: float


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system" | "tool"
    content: str = ""
    tool_call_id: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None


class CopilotRequest(BaseModel):
    messages: List[ChatMessage]
    catalog: List[CatalogItem] = Field(default_factory=list)


SYSTEM_PROMPT = (
    "You are the Orbital Watch Co-pilot, an expert in orbital mechanics and "
    "space situational awareness. You have access to the user's currently-"
    "loaded space-object catalog via tools. Always call a tool when a "
    "question can be answered with data — never invent numbers. Keep answers "
    "tight (3-5 sentences) and lead with the number or finding. When listing "
    "objects, format as a compact bulleted list with name, altitude, "
    "inclination, and risk. If asked about Kessler syndrome, collisions, or "
    "risk, reference the catalog's actual high-risk objects."
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "catalog_summary",
            "description": (
                "Get aggregate stats for the loaded catalog: counts by kind, "
                "average altitude, high-risk count, altitude bands."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_objects",
            "description": (
                "Find objects matching filters. Returns up to `limit` items "
                "sorted by risk descending."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "name_contains": {"type": "string"},
                    "kind": {
                        "type": "string",
                        "enum": ["payload", "rocket_body", "debris"],
                    },
                    "country": {"type": "string"},
                    "min_alt_km": {"type": "number"},
                    "max_alt_km": {"type": "number"},
                    "min_inclination_deg": {"type": "number"},
                    "max_inclination_deg": {"type": "number"},
                    "min_risk": {"type": "number"},
                    "limit": {"type": "number"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "altitude_histogram",
            "description": (
                "Bucket the catalog into altitude bands and return counts by "
                "kind per band."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "kessler_risk_assessment",
            "description": (
                "Identify the most congested altitude shells and the highest-"
                "risk objects within them."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "shell_km": {"type": "number"},
                },
            },
        },
    },
]


def _mid(o: CatalogItem) -> float:
    return (o.perigeeKm + o.apogeeKm) / 2


def exec_tool(
    name: str, args: Dict[str, Any], catalog: List[CatalogItem]
) -> Any:
    if name == "catalog_summary":
        debris = sum(1 for o in catalog if o.kind == "debris")
        payloads = sum(1 for o in catalog if o.kind == "payload")
        rockets = sum(1 for o in catalog if o.kind == "rocket_body")
        high_risk = sum(1 for o in catalog if o.risk > 0.7)
        avg_alt = (
            sum(_mid(o) for o in catalog) / max(1, len(catalog))
        )
        return {
            "total": len(catalog),
            "payloads": payloads,
            "rocket_bodies": rockets,
            "debris": debris,
            "high_risk_count": high_risk,
            "average_altitude_km": round(avg_alt),
        }

    if name == "search_objects":
        out = []
        for o in catalog:
            m = _mid(o)
            if "name_contains" in args and args["name_contains"]:
                if str(args["name_contains"]).lower() not in o.name.lower():
                    continue
            if args.get("kind") and o.kind != args["kind"]:
                continue
            if args.get("country") and o.country != args["country"]:
                continue
            if "min_alt_km" in args and m < float(args["min_alt_km"]):
                continue
            if "max_alt_km" in args and m > float(args["max_alt_km"]):
                continue
            if (
                "min_inclination_deg" in args
                and o.inclinationDeg < float(args["min_inclination_deg"])
            ):
                continue
            if (
                "max_inclination_deg" in args
                and o.inclinationDeg > float(args["max_inclination_deg"])
            ):
                continue
            if "min_risk" in args and o.risk < float(args["min_risk"]):
                continue
            out.append(o)
        out.sort(key=lambda x: x.risk, reverse=True)
        limit = max(1, min(25, int(args.get("limit", 10))))
        return {
            "match_count": len(out),
            "results": [
                {
                    "name": o.name,
                    "kind": o.kind,
                    "country": o.country,
                    "altitude_km": round(_mid(o)),
                    "inclination_deg": round(o.inclinationDeg, 1),
                    "period_min": round(o.periodMin, 1),
                    "risk": round(o.risk, 2),
                }
                for o in out[:limit]
            ],
        }

    if name == "altitude_histogram":
        bands = [
            (200, 400), (400, 600), (600, 800), (800, 1000),
            (1000, 1200), (1200, 1500), (1500, 2000), (2000, 36000),
        ]
        result = []
        for lo, hi in bands:
            items = [o for o in catalog if lo <= _mid(o) < hi]
            result.append({
                "band_km": f"{lo}-{hi}",
                "total": len(items),
                "debris": sum(1 for o in items if o.kind == "debris"),
                "rocket_bodies": sum(1 for o in items if o.kind == "rocket_body"),
                "payloads": sum(1 for o in items if o.kind == "payload"),
            })
        return result

    if name == "kessler_risk_assessment":
        shell = float(args.get("shell_km", 50))
        shells: Dict[float, List[CatalogItem]] = {}
        for o in catalog:
            key = (int(_mid(o) // shell)) * shell
            shells.setdefault(key, []).append(o)
        ranked = []
        for alt, items in shells.items():
            avg_risk = sum(o.risk for o in items) / len(items)
            top = sorted(items, key=lambda x: x.risk, reverse=True)[:3]
            ranked.append({
                "shell_km": f"{int(alt)}-{int(alt + shell)}",
                "density": len(items),
                "avg_risk": round(avg_risk, 2),
                "top_objects": [
                    {"name": o.name, "risk": round(o.risk, 2)} for o in top
                ],
            })
        ranked.sort(key=lambda r: r["density"] * r["avg_risk"], reverse=True)
        return {"most_congested_shells": ranked[:5]}

    return {"error": f"Unknown tool: {name}"}


# --- LLM provider ---------------------------------------------------------

LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions"
GEMINI_DIRECT_URL = (
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
)


async def _call_llm(messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Call Lovable AI Gateway, falling back to direct Gemini if configured."""
    lovable_key = os.getenv("LOVABLE_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if lovable_key:
        url = LOVABLE_GATEWAY_URL
        headers = {
            "Authorization": f"Bearer {lovable_key}",
            "Content-Type": "application/json",
        }
        model = "google/gemini-2.5-flash"
    elif gemini_key:
        url = GEMINI_DIRECT_URL
        headers = {
            "Authorization": f"Bearer {gemini_key}",
            "Content-Type": "application/json",
        }
        model = "gemini-2.5-flash"
    else:
        raise HTTPException(
            status_code=500,
            detail="No LLM key configured. Set LOVABLE_API_KEY or GEMINI_API_KEY.",
        )

    payload = {"model": model, "messages": messages, "tools": TOOLS}
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=headers, json=payload)

    if resp.status_code == 429:
        raise HTTPException(429, "Rate limit exceeded. Try again in a moment.")
    if resp.status_code == 402:
        raise HTTPException(402, "AI credits exhausted.")
    if resp.status_code >= 400:
        raise HTTPException(
            502, f"LLM provider error {resp.status_code}: {resp.text[:300]}"
        )
    return resp.json()


@app.post("/copilot")
async def copilot(body: CopilotRequest) -> Dict[str, Any]:
    catalog = body.catalog[:6000]  # cap upload size

    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *[m.model_dump(exclude_none=True) for m in body.messages],
    ]

    for _ in range(5):  # agentic loop
        data = await _call_llm(messages)
        choice = (data.get("choices") or [{}])[0]
        msg = choice.get("message")
        if not msg:
            break

        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:
            return {
                "reply": msg.get("content", ""),
                "tool_trace": [m for m in messages if m.get("role") == "tool"],
            }

        # Append assistant tool-call request, then each tool result.
        messages.append({
            "role": "assistant",
            "content": msg.get("content", ""),
            "tool_calls": tool_calls,
        })
        for call in tool_calls:
            try:
                args = json.loads(call["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            result = exec_tool(call["function"]["name"], args, catalog)
            messages.append({
                "role": "tool",
                "tool_call_id": call["id"],
                "content": json.dumps(result),
            })

    return {"reply": "I couldn't reach a final answer in the tool budget."}
