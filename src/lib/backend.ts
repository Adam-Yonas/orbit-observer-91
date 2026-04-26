// Resolves the backend base URL.
//
// Priority:
//   1. VITE_BACKEND_URL  (your self-hosted Python service, e.g. on Render)
//   2. VITE_SUPABASE_URL + /functions/v1  (Lovable Cloud edge functions)
//
// This lets the same frontend run against either backend without code changes —
// just set VITE_BACKEND_URL in the environment when you deploy outside Lovable.

type Env = Record<string, string | undefined>;
const env = ((import.meta as { env?: Env }).env ?? {}) as Env;

export const BACKEND_URL: string | null = (() => {
  const direct = env.VITE_BACKEND_URL?.replace(/\/+$/, "");
  if (direct) return direct;
  const supa = env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  if (supa) return `${supa}/functions/v1`;
  return null;
})();

// True when the frontend is talking to the standalone Python backend.
export const USING_CUSTOM_BACKEND = Boolean(env.VITE_BACKEND_URL);
