import { OrbitObject } from "@/lib/orbital";
import { X } from "lucide-react";

interface Props {
  obj: OrbitObject | null;
  onClose: () => void;
}

export function DetailsDrawer({ obj, onClose }: Props) {
  if (!obj) return null;
  const altMid = ((obj.perigeeKm + obj.apogeeKm) / 2).toFixed(0);
  const riskPct = (obj.risk * 100).toFixed(0);
  const riskColor =
    obj.risk > 0.7 ? "text-danger" : obj.risk > 0.4 ? "text-accent" : "text-success";

  return (
    <div className="absolute right-4 top-20 bottom-4 w-80 panel rounded-lg p-5 z-20 overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-mono text-primary uppercase tracking-wider">
            {obj.kind.replace("_", " ")}
          </div>
          <h2 className="text-lg font-semibold mt-1">{obj.name}</h2>
          <div className="text-xs text-muted-foreground font-mono mt-1">
            {obj.id} · {obj.country}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close object details" className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <Row label="Mean altitude" value={`${altMid} km`} />
        <Row label="Perigee" value={`${obj.perigeeKm.toFixed(0)} km`} />
        <Row label="Apogee" value={`${obj.apogeeKm.toFixed(0)} km`} />
        <Row label="Inclination" value={`${obj.inclinationDeg.toFixed(2)}°`} />
        <Row label="Period" value={`${obj.periodMin.toFixed(1)} min`} />

        <div className="pt-3 border-t border-border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">
              Conjunction risk
            </span>
            <span className={`font-mono font-semibold ${riskColor}`}>{riskPct}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${riskPct}%`,
                background:
                  obj.risk > 0.7
                    ? "hsl(var(--danger))"
                    : obj.risk > 0.4
                    ? "hsl(var(--accent))"
                    : "hsl(var(--success))",
              }}
            />
          </div>
        </div>

        <p className="pt-3 border-t border-border text-xs text-muted-foreground leading-relaxed">
          Collisions are now driven by the Launch Simulator: launch a spacecraft
          body, screen for conjunctions, then let one play out to model the
          impact and resulting breakup.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
