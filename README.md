# Orbital Watch

A real-time 3D space-debris dashboard with an **agentic AI co-pilot**. Built end-to-end (frontend, edge functions, database, LLM tool-calling) as a portfolio piece for the **Klaviyo AI Builder Resident** program.

> Live demo: https://orbit-observer-91.lovable.app

---

## What it does

- **Live orbital cloud** — streams TLEs from CelesTrak through a cached edge function, then propagates ~5,000+ objects with **SGP4** (`satellite.js`) directly in the browser.
- **3D globe** — `react-three-fiber` renders the cloud at 60 fps with additive blending, an atmospheric glow, and a wireframe scan overlay.
- **Time scrubber** — play / pause / scrub ±12 h with 1×, 1 m/s, 10 m/s, 1 h/s speeds.
- **Filters** — toggle payloads / rocket bodies / debris and clamp the altitude band.
- **Object inspector** — click any point to see perigee, apogee, inclination, period, and a heuristic conjunction-risk score.
- **Kessler simulator** — fragment any object into ~80 perturbed children to demonstrate cascade dynamics.
- **AI Co-pilot** — a Gemini 2.5 chat that calls real tools against your loaded catalog (no hallucinated numbers).

## The agentic part (the interesting bit)

The `copilot` edge function exposes four tools to the LLM:

| Tool | What it returns |
| --- | --- |
| `catalog_summary` | Total counts, average altitude, high-risk count |
| `search_objects` | Filter by name / kind / country / altitude / inclination / risk |
| `altitude_histogram` | Counts per altitude shell, broken down by class |
| `kessler_risk_assessment` | Most congested shells ranked by `density × avg_risk` |

The function runs an **agentic loop** (up to 5 steps): the model picks a tool, the function executes it against the catalog the client uploaded, the result is appended to the message history, and the model decides whether to call another tool or answer.

Every number in an answer is traceable to a JSON tool result.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind, shadcn/ui
- **3D**: three.js, `@react-three/fiber`, `@react-three/drei`
- **Orbital math**: `satellite.js` (SGP4)
- **Backend**: Lovable Cloud (Supabase) — Postgres TLE cache + Deno edge functions
- **LLM**: Lovable AI Gateway → `google/gemini-2.5-flash` with OpenAI-compatible tool calling

## Architecture

```
Browser ──▶ /functions/fetch-tle ──▶ CelesTrak (cached 6h in Postgres)
   │
   ├─ SGP4 propagation (satellite.js) ──▶ react-three-fiber points cloud
   │
   └─▶ /functions/copilot ──▶ Lovable AI (Gemini 2.5)
                                   │
                                   └─ tool calls ─▶ executed in-function against
                                                     the slimmed catalog payload
```

## Run locally

```bash
bun install
bun run dev
```

The Supabase URL & anon key are auto-injected by Lovable Cloud — no manual env setup needed.

## Why this fits the Klaviyo AI Builder Resident role

- **Ships with AI in production**, not just a notebook demo.
- **Agentic workflow** with real tool execution and a bounded reasoning loop.
- **Full-stack ownership** — schema, edge functions, prompt design, UI, deploy.
- **Built fast with AI-assisted coding** (Lovable) and iterated to production polish.

---

Data: CelesTrak GP catalog. Risk scores are a visualization heuristic, not an operational conjunction-analysis product.
