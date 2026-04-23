import { OrbitObject } from "@/lib/orbital";
import { useMemo } from "react";

interface Props {
  catalog: OrbitObject[];
  visibleIds: Set<string>;
}

export function StatsBar({ catalog, visibleIds }: Props) {
  const stats = useMemo(() => {
    const visible = catalog.filter((o) => visibleIds.has(o.id));
    const debris = visible.filter((o) => o.kind === "debris").length;
    const payloads = visible.filter((o) => o.kind === "payload").length;
    const highRisk = visible.filter((o) => o.risk > 0.7).length;
    const avgAlt =
      visible.reduce((s, o) => s + (o.perigeeKm + o.apogeeKm) / 2, 0) /
      Math.max(1, visible.length);
    return { tracked: visible.length, debris, payloads, highRisk, avgAlt };
  }, [catalog, visibleIds]);

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 hidden lg:flex gap-3">
      <Stat label="Tracked" value={stats.tracked.toLocaleString()} />
      <Stat label="Debris" value={stats.debris.toLocaleString()} accent="purple" />
      <Stat label="Payloads" value={stats.payloads.toLocaleString()} accent="cyan" />
      <Stat
        label="High-risk"
        value={stats.highRisk.toLocaleString()}
        accent={stats.highRisk > 0 ? "red" : "default"}
      />
      <Stat label="Avg alt" value={`${stats.avgAlt.toFixed(0)} km`} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "cyan" | "purple" | "red";
}) {
  const colorMap = {
    default: "text-foreground",
    cyan: "text-primary",
    purple: "text-[#a78bfa]",
    red: "text-danger animate-blink-danger",
  };
  return (
    <div className="panel rounded-lg px-4 py-2 min-w-[100px]">
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className={`font-mono text-lg font-semibold ${colorMap[accent]}`}>
        {value}
      </div>
    </div>
  );
}
