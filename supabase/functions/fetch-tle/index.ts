// CelesTrak TLE fetcher with DB cache.
// Returns a JSON array of { name, noradId, line1, line2, group }.
// Caches per group for 6 hours.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Allowed CelesTrak group names — keeps it tight.
const ALLOWED_GROUPS = new Set([
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
]);

interface TleRow {
  name: string;
  noradId: string;
  line1: string;
  line2: string;
  group: string;
}

function parseTle(text: string, group: string): TleRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const out: TleRow[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].trim();
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (!name || !l1?.startsWith("1 ") || !l2?.startsWith("2 ")) continue;
    const noradId = l1.substring(2, 7).trim();
    out.push({ name, noradId, line1: l1, line2: l2, group });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const group = (url.searchParams.get("group") ?? "active").trim();
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "2000", 10) || 2000,
      10000
    );

    if (!ALLOWED_GROUPS.has(group)) {
      return new Response(
        JSON.stringify({ error: `Group not allowed: ${group}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check cache freshness
    const { data: latest } = await supabase
      .from("tle_cache")
      .select("fetched_at")
      .eq("group_name", group)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const isFresh =
      latest &&
      Date.now() - new Date(latest.fetched_at).getTime() < CACHE_TTL_MS;

    if (!isFresh) {
      console.log(`[fetch-tle] cache miss for group=${group}, fetching`);
      const upstream = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`;
      const resp = await fetch(upstream, {
        headers: { "User-Agent": "OrbitalWatch/1.0 (+lovable)" },
      });
      if (!resp.ok) {
        throw new Error(`CelesTrak responded ${resp.status}`);
      }
      const text = await resp.text();
      const parsed = parseTle(text, group);
      console.log(`[fetch-tle] parsed ${parsed.length} rows for ${group}`);

      if (parsed.length > 0) {
        // Replace cache for this group
        await supabase.from("tle_cache").delete().eq("group_name", group);
        // Chunked insert
        const CHUNK = 500;
        for (let i = 0; i < parsed.length; i += CHUNK) {
          const chunk = parsed.slice(i, i + CHUNK).map((r) => ({
            group_name: r.group,
            norad_id: r.noradId,
            name: r.name,
            line1: r.line1,
            line2: r.line2,
          }));
          const { error } = await supabase.from("tle_cache").insert(chunk);
          if (error) console.error("[fetch-tle] insert error", error);
        }
      }
    } else {
      console.log(`[fetch-tle] cache hit for group=${group}`);
    }

    const { data: rows, error } = await supabase
      .from("tle_cache")
      .select("name, norad_id, line1, line2, group_name, fetched_at")
      .eq("group_name", group)
      .limit(limit);

    if (error) throw error;

    const result = (rows ?? []).map((r) => ({
      name: r.name,
      noradId: r.norad_id,
      line1: r.line1,
      line2: r.line2,
      group: r.group_name,
    }));

    return new Response(
      JSON.stringify({
        group,
        count: result.length,
        cached: isFresh,
        fetchedAt: latest?.fetched_at ?? new Date().toISOString(),
        objects: result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[fetch-tle] error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
