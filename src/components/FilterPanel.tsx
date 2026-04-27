import { OrbitObject } from "@/lib/orbital";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

export interface Filters {
  payload: boolean;
  rocket_body: boolean;
  debris: boolean;
  altMin: number;
  altMax: number;
}

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  catalog: OrbitObject[];
  visibleCount: number;
}

export function FilterPanel({ filters, setFilters, catalog, visibleCount }: Props) {
  const altitudeFilteredObjects = catalog.filter((o) => {
    const mid = (o.perigeeKm + o.apogeeKm) / 2;
    return mid >= filters.altMin && mid <= filters.altMax;
  });
  
  const counts = {
    payload: altitudeFilteredObjects.filter((o) => o.kind === "payload").length,
    rocket_body: altitudeFilteredObjects.filter((o) => o.kind === "rocket_body").length,
    debris: altitudeFilteredObjects.filter((o) => o.kind === "debris").length,
  };

  return (
    <div className="absolute left-4 top-20 w-72 panel rounded-lg p-5 z-20 space-y-5">
      <div>
        <div className="text-xs font-mono text-primary uppercase tracking-wider mb-3">
          Object Class
        </div>
        <div className="space-y-2.5">
          <Toggle
            checked={filters.payload}
            onChange={(v) => setFilters({ ...filters, payload: v })}
            label="Payloads"
            count={counts.payload}
            color="#22d3ee"
          />
          <Toggle
            checked={filters.rocket_body}
            onChange={(v) => setFilters({ ...filters, rocket_body: v })}
            label="Rocket Bodies"
            count={counts.rocket_body}
            color="#f59e0b"
          />
          <Toggle
            checked={filters.debris}
            onChange={(v) => setFilters({ ...filters, debris: v })}
            label="Debris"
            count={counts.debris}
            color="#a78bfa"
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-baseline mb-3">
          <div className="text-xs font-mono text-primary uppercase tracking-wider">
            Altitude Band
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            {filters.altMin}–{filters.altMax} km
          </div>
        </div>
        <Slider
          min={200}
          max={2200}
          step={50}
          value={[filters.altMin, filters.altMax]}
          onValueChange={(v) =>
            setFilters({ ...filters, altMin: v[0], altMax: v[1] })
          }
        />
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-2">
          <span>LEO</span>
          <span>MEO →</span>
        </div>
      </div>

      <div className="pt-3 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Visible
          </span>
          <span className="font-mono text-primary text-glow">
            {visibleCount.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  count,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <div className="flex items-center gap-2.5">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onChange(!!v)}
        />
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <span className="text-sm group-hover:text-primary transition-colors">{label}</span>
      </div>
      <span className="text-xs font-mono text-muted-foreground">{count}</span>
    </label>
  );
}
