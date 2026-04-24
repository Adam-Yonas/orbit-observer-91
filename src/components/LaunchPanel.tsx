import { useState } from "react";
import { Rocket, Loader2, ShieldAlert, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  buildUserOrbit,
  screenConjunctionsAsync,
  findSafeOrbitNear,
  type OrbitObject,
  type Conjunction,
  type UserOrbitParams,
} from "@/lib/orbital";
import { toast } from "sonner";

interface Props {
  catalog: OrbitObject[];
  time: Date;
  userObject: OrbitObject | null;
  setUserObject: (o: OrbitObject | null) => void;
  conjunctions: Conjunction[];
  setConjunctions: (c: Conjunction[]) => void;
  onAskCopilot: (prompt: string) => void;
  onSelect: (id: string | null) => void;
}

export function LaunchPanel({
  catalog,
  time,
  userObject,
  setUserObject,
  conjunctions,
  setConjunctions,
  onAskCopilot,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<UserOrbitParams>({
    name: "MY SAT",
    altKm: 550,
    incDeg: 53,
    raanDeg: 0,
    eccentricity: 0,
  });
  const [scanning, setScanning] = useState(false);
  const [missKm, setMissKm] = useState(10);

  async function launch() {
    setScanning(true);
    const obj = buildUserOrbit(params, time);
    if (!obj) {
      toast.error("Invalid orbit parameters");
      setScanning(false);
      return;
    }
    setUserObject(obj);
    onSelect(obj.id);
    try {
      const conjs = await screenConjunctionsAsync(obj, catalog, time, {
        horizonMin: 720,
        missDistanceKm: missKm,
        stepSec: 30,
        maxResults: 50,
      });
      setConjunctions(conjs);
      if (conjs.length === 0) {
        toast.success(`Orbit clear · 12 h horizon · ${missKm} km miss threshold`);
      } else {
        toast.warning(
          `${conjs.length} conjunction${conjs.length === 1 ? "" : "s"} detected · closest ${conjs[0].minDistanceKm.toFixed(1)} km`
        );
      }
    } finally {
      setScanning(false);
    }
  }

  function clearUserObject() {
    setUserObject(null);
    setConjunctions([]);
    onSelect(null);
  }

  function autoSafe() {
    setScanning(true);
    setTimeout(() => {
      const safe = findSafeOrbitNear(params, catalog, time, { missKm, horizonMin: 360 });
      setScanning(false);
      if (!safe) {
        toast.error("No safer orbit found in local search window");
        return;
      }
      if (safe.conjunctions === 0) {
        toast.success(
          `Safe orbit found · alt ${safe.params.altKm.toFixed(0)} km · RAAN ${(safe.params.raanDeg ?? 0).toFixed(0)}°`
        );
      } else {
        toast.warning(
          `Best alt ${safe.params.altKm.toFixed(0)} km · RAAN ${(safe.params.raanDeg ?? 0).toFixed(0)}° still has ${safe.conjunctions} hit(s) (${safe.minMissKm.toFixed(1)} km)`
        );
      }
      setParams(safe.params);
    }, 0);
  }

  function askCopilot() {
    const top = conjunctions.slice(0, 5).map((c) =>
      `${c.victimName} (${c.victimKind}, alt ${c.altKm.toFixed(0)} km, miss ${c.minDistanceKm.toFixed(1)} km @ T+${c.timeOffsetMin.toFixed(0)} min)`
    );
    const prompt = `I'm planning to launch a satellite into this orbit:
- Altitude: ${params.altKm} km
- Inclination: ${params.incDeg}°
- RAAN: ${params.raanDeg ?? 0}°
- Eccentricity: ${params.eccentricity ?? 0}

Conjunction screen over 12 h with ${missKm} km miss threshold returned ${conjunctions.length} hit${conjunctions.length === 1 ? "" : "s"}:
${top.join("\n")}

Recommend a similar but conflict-free orbit. Use catalog tools to find an altitude shell with low debris density at a comparable inclination, and tell me what altitude and RAAN to shift to.`;
    onAskCopilot(prompt);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute left-4 bottom-32 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full panel border border-success/40 hover:border-success text-success text-xs font-mono uppercase tracking-wider transition-all hover:scale-105"
        style={{ color: "#84cc16", borderColor: "#84cc1666" }}
      >
        <Rocket className="w-3.5 h-3.5" />
        Launch sim
      </button>
    );
  }

  const worst = conjunctions[0];

  return (
    <div className="absolute left-4 bottom-32 z-30 w-[320px] panel rounded-lg p-4 space-y-3 max-h-[70vh] overflow-y-auto">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4" style={{ color: "#84cc16" }} />
          <div className="text-xs font-mono uppercase tracking-wider" style={{ color: "#84cc16" }}>
            Launch Simulator
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
          ×
        </button>
      </header>

      <div className="space-y-2.5 text-xs font-mono">
        <Field label="Altitude (km)" value={params.altKm.toFixed(0)}>
          <Slider
            min={200}
            max={2000}
            step={10}
            value={[params.altKm]}
            onValueChange={([v]) => setParams({ ...params, altKm: v })}
          />
        </Field>
        <Field label="Inclination (°)" value={params.incDeg.toFixed(1)}>
          <Slider
            min={0}
            max={120}
            step={0.5}
            value={[params.incDeg]}
            onValueChange={([v]) => setParams({ ...params, incDeg: v })}
          />
        </Field>
        <Field label="RAAN (°)" value={(params.raanDeg ?? 0).toFixed(0)}>
          <Slider
            min={0}
            max={360}
            step={1}
            value={[params.raanDeg ?? 0]}
            onValueChange={([v]) => setParams({ ...params, raanDeg: v })}
          />
        </Field>
        <Field label="Eccentricity" value={(params.eccentricity ?? 0).toFixed(3)}>
          <Slider
            min={0}
            max={0.1}
            step={0.005}
            value={[params.eccentricity ?? 0]}
            onValueChange={([v]) => setParams({ ...params, eccentricity: v })}
          />
        </Field>
        <Field label="Miss threshold (km)" value={missKm.toFixed(0)}>
          <Slider min={1} max={50} step={1} value={[missKm]} onValueChange={([v]) => setMissKm(v)} />
        </Field>
      </div>

      <div className="flex gap-2">
        <button
          onClick={launch}
          disabled={scanning}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-mono uppercase tracking-wider border transition-colors disabled:opacity-50"
          style={{ borderColor: "#84cc16", color: "#84cc16" }}
        >
          {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
          {userObject ? "Re-screen" : "Launch & screen"}
        </button>
        {userObject && (
          <button
            onClick={clearUserObject}
            className="px-2.5 py-2 rounded border border-border text-muted-foreground hover:text-danger hover:border-danger/60"
            title="Remove user satellite"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {userObject && !scanning && (
        <div
          className="rounded border p-2.5 text-xs space-y-2"
          style={{
            borderColor: conjunctions.length === 0 ? "#22c55e66" : "#ef444466",
            background: conjunctions.length === 0 ? "#22c55e10" : "#ef444410",
          }}
        >
          <div className="flex items-center gap-2 font-mono uppercase tracking-wider">
            {conjunctions.length === 0 ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-success" />
                <span className="text-success">Orbit clear</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-danger" />
                <span className="text-danger">{conjunctions.length} conjunction(s)</span>
              </>
            )}
          </div>
          {worst && (
            <div className="text-muted-foreground space-y-0.5">
              <div>
                Closest: <span className="text-foreground">{worst.victimName}</span>
              </div>
              <div>
                {worst.minDistanceKm.toFixed(2)} km @ T+{worst.timeOffsetMin.toFixed(0)} min ·{" "}
                {worst.altKm.toFixed(0)} km alt
              </div>
            </div>
          )}
          {conjunctions.length > 1 && (
            <details className="text-[10px]">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                show all
              </summary>
              <ul className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
                {conjunctions.slice(0, 25).map((c) => (
                  <li key={c.victimId} className="flex justify-between gap-2">
                    <span className="truncate">{c.victimName}</span>
                    <span className="text-muted-foreground shrink-0">
                      {c.minDistanceKm.toFixed(1)} km
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {conjunctions.length > 0 && (
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={autoSafe}
                disabled={scanning}
                className="flex-1 text-[10px] font-mono uppercase tracking-wider px-2 py-1.5 rounded border border-success/50 text-success hover:bg-success/10 disabled:opacity-50"
              >
                Auto-find safe
              </button>
              <button
                onClick={askCopilot}
                className="flex-1 flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-1.5 rounded border border-primary/50 text-primary hover:bg-primary/10"
              >
                <Sparkles className="w-2.5 h-2.5" /> Ask copilot
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</span>
        <span className="text-foreground">{value}</span>
      </div>
      {children}
    </div>
  );
}
