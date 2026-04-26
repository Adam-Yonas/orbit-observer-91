# Orbital Watch — Python Backend

Standalone FastAPI service that replaces the Lovable Cloud edge functions.
Deploy this anywhere that runs Python (Render, Fly, Railway, your own VPS).

## Endpoints

| Method | Path                        | Purpose                                  |
| ------ | --------------------------- | ---------------------------------------- |
| GET    | `/health`                   | Liveness probe                           |
| GET    | `/fetch-tle?group=active`   | CelesTrak TLE proxy (6h in-memory cache) |
| POST   | `/copilot`                  | Agentic Gemini chat with tool calling    |

## Local development

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# pick ONE LLM key:
export LOVABLE_API_KEY=...     # if you have a Lovable AI Gateway key
# or
export GEMINI_API_KEY=...      # direct Google AI Studio key

uvicorn app:app --reload --port 8000
```

Smoke test:

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/fetch-tle?group=stations&limit=10"
```

## Deploying to Render

The repo ships with a `render.yaml` blueprint at the project root.

1. Push this repo to GitHub.
2. In Render, click **New → Blueprint** and pick the repo.
3. After the service spins up, open it and add your LLM key under
   **Environment**:
   - `LOVABLE_API_KEY` — preferred, or
   - `GEMINI_API_KEY` — direct Google AI Studio key
4. Tighten `ALLOWED_ORIGINS` to your frontend URL (e.g.
   `https://your-username.github.io`) once you know it.

Render will give you a public URL like
`https://orbital-watch-backend.onrender.com`. Use that as
`VITE_BACKEND_URL` for the frontend (see the root `README.md`).

## Environment variables

| Name              | Required | Purpose                                                                |
| ----------------- | -------- | ---------------------------------------------------------------------- |
| `LOVABLE_API_KEY` | one of   | Lovable AI Gateway key (uses `google/gemini-2.5-flash`)                |
| `GEMINI_API_KEY`  | one of   | Direct Google AI Studio key (fallback if no Lovable key)               |
| `ALLOWED_ORIGINS` | no       | Comma-separated CORS origins. Defaults to `*`.                         |
| `PORT`            | no       | Bind port. Render injects this automatically.                          |

## Notes

- The TLE cache is **in-memory**, so each instance maintains its own cache.
  That's fine for this app's scale — CelesTrak gets at most one hit per
  group per 6 hours per instance.
- If you need persistence later, swap `_tle_cache` for a Redis or Postgres
  backed store.
