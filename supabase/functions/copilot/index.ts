// Orbital Watch AI Co-pilot — agentic LLM endpoint
// Uses Lovable AI Gateway (no key required) with tool/function calling.
// The model can call back into our "tools" to query the live debris catalog
// the client just streamed up, so answers are grounded in real data.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CatalogItem {
  id: string;
  name: string;
  kind: "payload" | "rocket_body" | "debris";
  country: string;
  perigeeKm: number;
  apogeeKm: number;
  inclinationDeg: number;
  periodMin: number;
  risk: number;
}

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface RequestBody {
  messages: ChatMessage[];
  catalog: CatalogItem[];
}

const SYSTEM_PROMPT = `You are the Orbital Watch Co-pilot, an expert in orbital mechanics and space situational awareness.
You have access to the user's currently-loaded space-object catalog via tools.
Always call a tool when a question can be answered with data — never invent numbers.
Keep answers tight (3-5 sentences) and lead with the number or finding.
When listing objects, format as a compact bulleted list with name, altitude, inclination, and risk.
If asked about Kessler syndrome, collisions, or risk, reference the catalog's actual high-risk objects.`;

const tools = [
  {
    type: "function",
    function: {
      name: "catalog_summary",
      description:
        "Get aggregate stats for the loaded catalog: counts by kind, average altitude, high-risk count, altitude bands.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search_objects",
      description:
        "Find objects matching filters. Returns up to `limit` items sorted by risk descending.",
      parameters: {
        type: "object",
        properties: {
          name_contains: { type: "string", description: "Case-insensitive name substring" },
          kind: { type: "string", enum: ["payload", "rocket_body", "debris"] },
          country: { type: "string" },
          min_alt_km: { type: "number" },
          max_alt_km: { type: "number" },
          min_inclination_deg: { type: "number" },
          max_inclination_deg: { type: "number" },
          min_risk: { type: "number", description: "0..1" },
          limit: { type: "number", description: "default 10, max 25" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "altitude_histogram",
      description: "Bucket the catalog into altitude bands and return counts by kind per band.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "kessler_risk_assessment",
      description:
        "Identify the most congested altitude shells and the highest-risk objects within them.",
      parameters: {
        type: "object",
        properties: {
          shell_km: { type: "number", description: "Shell width in km, default 50" },
        },
      },
    },
  },
];

function execTool(name: string, args: Record<string, unknown>, catalog: CatalogItem[]): unknown {
  const mid = (o: CatalogItem) => (o.perigeeKm + o.apogeeKm) / 2;

  if (name === "catalog_summary") {
    const debris = catalog.filter((o) => o.kind === "debris").length;
    const payloads = catalog.filter((o) => o.kind === "payload").length;
    const rockets = catalog.filter((o) => o.kind === "rocket_body").length;
    const highRisk = catalog.filter((o) => o.risk > 0.7).length;
    const avgAlt =
      catalog.reduce((s, o) => s + mid(o), 0) / Math.max(1, catalog.length);
    return {
      total: catalog.length,
      payloads,
      rocket_bodies: rockets,
      debris,
      high_risk_count: highRisk,
      average_altitude_km: Math.round(avgAlt),
    };
  }

  if (name === "search_objects") {
    const a = args as Record<string, unknown>;
    let out = catalog.filter((o) => {
      const m = mid(o);
      if (a.name_contains && !o.name.toLowerCase().includes(String(a.name_contains).toLowerCase()))
        return false;
      if (a.kind && o.kind !== a.kind) return false;
      if (a.country && o.country !== a.country) return false;
      if (typeof a.min_alt_km === "number" && m < a.min_alt_km) return false;
      if (typeof a.max_alt_km === "number" && m > a.max_alt_km) return false;
      if (typeof a.min_inclination_deg === "number" && o.inclinationDeg < a.min_inclination_deg)
        return false;
      if (typeof a.max_inclination_deg === "number" && o.inclinationDeg > a.max_inclination_deg)
        return false;
      if (typeof a.min_risk === "number" && o.risk < a.min_risk) return false;
      return true;
    });
    out.sort((x, y) => y.risk - x.risk);
    const limit = Math.min(25, Math.max(1, Number(a.limit ?? 10)));
    return {
      match_count: out.length,
      results: out.slice(0, limit).map((o) => ({
        name: o.name,
        kind: o.kind,
        country: o.country,
        altitude_km: Math.round(mid(o)),
        inclination_deg: Number(o.inclinationDeg.toFixed(1)),
        period_min: Number(o.periodMin.toFixed(1)),
        risk: Number(o.risk.toFixed(2)),
      })),
    };
  }

  if (name === "altitude_histogram") {
    const bands = [
      [200, 400], [400, 600], [600, 800], [800, 1000],
      [1000, 1200], [1200, 1500], [1500, 2000], [2000, 36000],
    ];
    return bands.map(([min, max]) => {
      const items = catalog.filter((o) => {
        const m = mid(o);
        return m >= min && m < max;
      });
      return {
        band_km: `${min}-${max}`,
        total: items.length,
        debris: items.filter((o) => o.kind === "debris").length,
        rocket_bodies: items.filter((o) => o.kind === "rocket_body").length,
        payloads: items.filter((o) => o.kind === "payload").length,
      };
    });
  }

  if (name === "kessler_risk_assessment") {
    const shell = Number((args as { shell_km?: number }).shell_km ?? 50);
    const shells = new Map<number, CatalogItem[]>();
    catalog.forEach((o) => {
      const key = Math.floor(mid(o) / shell) * shell;
      if (!shells.has(key)) shells.set(key, []);
      shells.get(key)!.push(o);
    });
    const ranked = [...shells.entries()]
      .map(([alt, items]) => ({
        shell_km: `${alt}-${alt + shell}`,
        density: items.length,
        avg_risk: Number(
          (items.reduce((s, o) => s + o.risk, 0) / items.length).toFixed(2)
        ),
        top_objects: items
          .sort((a, b) => b.risk - a.risk)
          .slice(0, 3)
          .map((o) => ({ name: o.name, risk: Number(o.risk.toFixed(2)) })),
      }))
      .sort((a, b) => b.density * b.avg_risk - a.density * a.avg_risk)
      .slice(0, 5);
    return { most_congested_shells: ranked };
  }

  return { error: `Unknown tool: ${name}` };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    const catalog = (body.catalog ?? []).slice(0, 6000); // cap upload size

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...body.messages,
    ];

    // Agentic loop — let model call tools up to N times
    for (let step = 0; step < 5; step++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools,
        }),
      });

      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable Cloud." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!resp.ok) {
        const txt = await resp.text();
        console.error("AI gateway error", resp.status, txt);
        return new Response(JSON.stringify({ error: "AI gateway error", detail: txt }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      // No tool calls → final answer
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return new Response(
          JSON.stringify({ reply: msg.content ?? "", tool_trace: messages.filter((m) => m.role === "tool") }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Execute each tool call and append results
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(call.function.arguments || "{}");
        } catch (_) {
          parsed = {};
        }
        const result = execTool(call.function.name, parsed, catalog);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(
      JSON.stringify({ reply: "I couldn't reach a final answer in the tool budget." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("copilot error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
