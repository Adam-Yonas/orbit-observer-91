import { OrbitObject } from "@/lib/orbital";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  catalog: OrbitObject[];
  visibleIds: Set<string>;
}

const BANDS = [
  { min: 200, max: 400, label: "200" },
  { min: 400, max: 600, label: "400" },
  { min: 600, max: 800, label: "600" },
  { min: 800, max: 1000, label: "800" },
  { min: 1000, max: 1200, label: "1k" },
  { min: 1200, max: 1500, label: "1.2k" },
  { min: 1500, max: 2000, label: "1.5k" },
  { min: 2000, max: 3000, label: "2k+" },
];

export function AltitudeChart({ catalog, visibleIds }: Props) {
  const data = useMemo(() => {
    return BANDS.map((b) => {
      const items = catalog.filter((o) => {
        if (!visibleIds.has(o.id)) return false;
        const mid = (o.perigeeKm + o.apogeeKm) / 2;
        return mid >= b.min && mid < b.max;
      });
      return {
        band: b.label,
        debris: items.filter((o) => o.kind === "debris").length,
        rocket: items.filter((o) => o.kind === "rocket_body").length,
        payload: items.filter((o) => o.kind === "payload").length,
      };
    });
  }, [catalog, visibleIds]);

  return (
    <div className="absolute right-4 bottom-40 w-80 panel rounded-lg p-4 z-10 hidden md:block">
      <div className="text-xs font-mono text-primary uppercase tracking-wider mb-2">
        Altitude Density (km)
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="band"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              fontSize: 11,
              fontFamily: "JetBrains Mono",
            }}
          />
          <Bar dataKey="debris" stackId="a" fill="#a78bfa" />
          <Bar dataKey="rocket" stackId="a" fill="#f59e0b" />
          <Bar dataKey="payload" stackId="a" fill="#22d3ee" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
