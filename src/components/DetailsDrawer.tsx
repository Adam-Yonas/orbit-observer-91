import { useState } from "react";
import { OrbitObject } from "@/lib/orbital";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";

export interface CascadeInputs {
  count: number;
  impactorMassKg: number;
  impactorVelKms: number;
  // Impactor approach direction in the parent's VNC frame (each in [-1, 1]).
  dirV: number;
  dirN: number;
  dirC: number;
  ejectaConeDeg: number;
  chainEnabled: boolean;
  chainHorizonMin: number;
  missDistanceKm: number;
}

interface Props {
  obj: OrbitObject | null;
  onClose: () => void;
  onCascade: (id: string, inputs: CascadeInputs) => void;
}

const DIRECTION_PRESETS: Array<{
  label: string;
  desc: string;
  v: number;
  n: number;
  c: number;
}> = [
  { label: "Head-on", desc: "Retrograde, along velocity", v: -1, n: 0, c: 0 },
  { label: "Tail chase", desc: "Prograde, slow rear-end", v: 1, n: 0, c: 0 },
  { label: "Cross-track", desc: "Perpendicular, polar-ish", v: 0, n: 1, c: 0 },
  { label: "Radial", desc: "From below / above", v: 0, n: 0, c: 1 },
  { label: "Oblique", desc: "45° head-on + cross", v: -0.7, n: 0.7, c: 0 },
];

export function DetailsDrawer({ obj, onClose, onCascade }: Props) {
  const [count, setCount] = useState(80);
  const [mass, setMass] = useState(100);
  const [vel, setVel] = useState(10);
  const [dirV, setDirV] = useState(-1);
  const [dirN, setDirN] = useState(0);
  const [dirC, setDirC] = useState(0);
  const [cone, setCone] = useState(180);
  const [chainEnabled, setChainEnabled] = useState(true);
  const [chainHorizon, setChainHorizon] = useState(90);
  const [missDist, setMissDist] = useState(5);

  if (!obj) return null;
  const altMid = ((obj.perigeeKm + obj.apogeeKm) / 2).toFixed(0);
  const riskPct = (obj.risk * 100).toFixed(0);
  const riskColor =
    obj.risk > 0.7 ? "text-danger" : obj.risk > 0.4 ? "text-accent" : "text-success";

  const applyPreset = (p: { v: number; n: number; c: number }) => {
    setDirV(p.v);
    setDirN(p.n);
    setDirC(p.c);
  };

  return (
    <div className="absolute right-4 top-20 bottom-4 w-80 panel rounded-lg p-5 z-20 overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-mono text-primary uppercase tracking-wider">
            {obj.kind.replace("_", " ")}
          </div>
          <h3 className="text-lg font-semibold mt-1">{obj.name}</h3>
          <div className="text-xs text-muted-foreground font-mono mt-1">
            {obj.id} · {obj.country}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
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

        <div className="pt-3 border-t border-border space-y-3">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Collision parameters
          </div>

          <SliderRow
            label="Impactor mass"
            value={`${mass} kg`}
            min={1}
            max={2000}
            step={1}
            v={mass}
            onChange={setMass}
          />
          <SliderRow
            label="Relative velocity"
            value={`${vel.toFixed(1)} km/s`}
            min={0.5}
            max={15}
            step={0.1}
            v={vel}
            onChange={setVel}
          />
          <SliderRow
            label="Fragments"
            value={`${count}`}
            min={20}
            max={300}
            step={10}
            v={count}
            onChange={setCount}
          />
        </div>

        <div className="pt-3 border-t border-border space-y-3">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Impactor approach (VNC frame)
          </div>
          <div className="flex flex-wrap gap-1">
            {DIRECTION_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                title={p.desc}
                className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border border-border hover:border-primary hover:text-primary transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <SliderRow
            label="Along-track (V)"
            value={dirV.toFixed(2)}
            min={-1}
            max={1}
            step={0.05}
            v={dirV}
            onChange={setDirV}
          />
          <SliderRow
            label="Cross-track (N)"
            value={dirN.toFixed(2)}
            min={-1}
            max={1}
            step={0.05}
            v={dirN}
            onChange={setDirN}
          />
          <SliderRow
            label="Radial (C)"
            value={dirC.toFixed(2)}
            min={-1}
            max={1}
            step={0.05}
            v={dirC}
            onChange={setDirC}
          />
          <SliderRow
            label="Ejecta cone"
            value={`±${cone}°`}
            min={10}
            max={180}
            step={5}
            v={cone}
            onChange={setCone}
          />
        </div>

        <div className="pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Chain reactions
            </div>
            <Switch checked={chainEnabled} onCheckedChange={setChainEnabled} />
          </div>
          {chainEnabled && (
            <>
              <SliderRow
                label="Screening horizon"
                value={`${chainHorizon} min`}
                min={15}
                max={240}
                step={15}
                v={chainHorizon}
                onChange={setChainHorizon}
              />
              <SliderRow
                label="Miss distance"
                value={`${missDist} km`}
                min={1}
                max={50}
                step={1}
                v={missDist}
                onChange={setMissDist}
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Each fragment is propagated forward and any catalog object that passes
                within the miss distance is shattered, recursively spawning more
                fragments (up to 3 generations).
              </p>
            </>
          )}

          <Button
            variant="destructive"
            className="w-full mt-2"
            onClick={() =>
              onCascade(obj.id, {
                count,
                impactorMassKg: mass,
                impactorVelKms: vel,
                dirV,
                dirN,
                dirC,
                ejectaConeDeg: cone,
                chainEnabled,
                chainHorizonMin: chainHorizon,
                missDistanceKm: missDist,
              })
            }
          >
            Trigger Kessler Cascade
          </Button>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Fragments inherit the parent's state vector at impact, then receive a
            Δv kick biased along the impactor's approach vector and spread inside
            the chosen ejecta cone. New orbits propagate with SGP4 and (optionally)
            screen for downstream conjunctions.
          </p>
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  v,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  v: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <Slider
        value={[v]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
      />
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
