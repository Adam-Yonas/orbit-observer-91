import { useEffect, useMemo, useRef, useState } from "react";
import { Globe } from "@/components/Globe";
import { FilterPanel, Filters } from "@/components/FilterPanel";
import { TimeScrubber } from "@/components/TimeScrubber";
import { StatsBar } from "@/components/StatsBar";
import { DetailsDrawer } from "@/components/DetailsDrawer";
import { AltitudeChart } from "@/components/AltitudeChart";
import { generateCatalog, OrbitObject, propagate } from "@/lib/orbital";
import * as satellite from "satellite.js";
import { Satellite, AlertTriangle } from "lucide-react";

const Index = () => {
  const [catalog, setCatalog] = useState<OrbitObject[]>([]);
  const [filters, setFilters] = useState<Filters>({
    payload: true,
    rocket_body: true,
    debris: true,
    altMin: 200,
    altMax: 2200,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cascadeIds, setCascadeIds] = useState<Set<string>>(new Set());

  const baseTime = useRef(new Date());
  const [offsetMin, setOffsetMin] = useState(0);
  const [speed, setSpeed] = useState(60);
  const [playing, setPlaying] = useState(true);

  // Generate the catalog once
  useEffect(() => {
    setCatalog(generateCatalog(2200));
  }, []);

  // Time animation loop
  useEffect(() => {
    if (!playing) return;
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setOffsetMin((m) => m + (dt * speed) / 60);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const time = useMemo(
    () => new Date(baseTime.current.getTime() + offsetMin * 60_000),
    [offsetMin]
  );

  // Visible IDs based on filters
  const visibleIds = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((o) => {
      if (!filters[o.kind]) return;
      const mid = (o.perigeeKm + o.apogeeKm) / 2;
      if (mid < filters.altMin || mid > filters.altMax) return;
      set.add(o.id);
    });
    return set;
  }, [catalog, filters]);

  const selectedObj = useMemo(
    () => catalog.find((o) => o.id === selectedId) ?? null,
    [catalog, selectedId]
  );

  // Kessler cascade: spawn fragments from the chosen object's current position
  const triggerCascade = (id: string) => {
    const parent = catalog.find((o) => o.id === id);
    if (!parent) return;
    const pos = propagate(parent, time);
    if (!pos) return;

    const fragments: OrbitObject[] = [];
    const newCascade = new Set(cascadeIds);
    newCascade.add(id);

    const baseAlt = (parent.perigeeKm + parent.apogeeKm) / 2;
    for (let i = 0; i < 80; i++) {
      // Build a TLE-like satrec by perturbing parent's elements
      const inc = parent.inclinationDeg + (Math.random() - 0.5) * 6;
      const alt = baseAlt + (Math.random() - 0.5) * 200;
      const a = 6371 + alt;
      const periodSec = 2 * Math.PI * Math.sqrt((a * a * a) / 398600.4418);
      const meanMotion = 86400 / periodSec;
      const ecc = Math.random() * 0.03;
      const raan = Math.random() * 360;
      const argp = Math.random() * 360;
      const ma = Math.random() * 360;
      const noradId = (90000 + Math.floor(Math.random() * 9000)).toString();
      const eccStr = ecc.toFixed(7).slice(2);
      const incStr = inc.toFixed(4).padStart(8, " ");
      const raanStr = raan.toFixed(4).padStart(8, " ");
      const argpStr = argp.toFixed(4).padStart(8, " ");
      const maStr = ma.toFixed(4).padStart(8, " ");
      const mmStr = meanMotion.toFixed(8).padStart(11, " ");
      const l1 = `1 ${noradId}U 24001A   24001.50000000  .00000000  00000-0  00000-0 0  9990`;
      const l2 = `2 ${noradId} ${incStr} ${raanStr} ${eccStr} ${argpStr} ${maStr} ${mmStr}000010`;
      const satrec = satellite.twoline2satrec(l1, l2);
      if (!satrec || satrec.error) continue;
      const fragId = `frag-${Date.now()}-${i}`;
      fragments.push({
        id: fragId,
        name: `FRAG-${i}`,
        kind: "debris",
        country: parent.country,
        satrec,
        perigeeKm: a * (1 - ecc) - 6371,
        apogeeKm: a * (1 + ecc) - 6371,
        inclinationDeg: inc,
        periodMin: periodSec / 60,
        risk: 0.9,
      });
      newCascade.add(fragId);
    }
    setCatalog([...catalog, ...fragments]);
    setCascadeIds(newCascade);
  };

  const reset = () => {
    setCatalog((prev) => prev.filter((o) => !o.id.startsWith("frag-")));
    setCascadeIds(new Set());
  };

  return (
    <main className="relative h-screen w-full overflow-hidden scan-line">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4 panel border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
            <Satellite className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              ORBITAL <span className="text-primary text-glow">WATCH</span>
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Live space debris tracker · v1.0
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {cascadeIds.size > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded border border-danger/50 text-danger hover:bg-danger/10 transition-colors"
            >
              <AlertTriangle className="w-3 h-3" />
              {cascadeIds.size} cascade · reset
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
            <span className="text-muted-foreground">SGP4 propagation active</span>
          </div>
        </div>
      </header>

      {/* 3D scene fills viewport */}
      <div className="absolute inset-0">
        {catalog.length > 0 && (
          <Globe
            catalog={catalog}
            visibleIds={visibleIds}
            time={time}
            selectedId={selectedId}
            onSelect={setSelectedId}
            cascadeIds={cascadeIds}
          />
        )}
      </div>

      {/* Overlays */}
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        catalog={catalog}
        visibleCount={visibleIds.size}
      />
      <StatsBar catalog={catalog} visibleIds={visibleIds} />
      <AltitudeChart catalog={catalog} visibleIds={visibleIds} />
      <DetailsDrawer
        obj={selectedObj}
        onClose={() => setSelectedId(null)}
        onCascade={triggerCascade}
      />
      <TimeScrubber
        time={time}
        baseTime={baseTime.current}
        offsetMin={offsetMin}
        setOffsetMin={setOffsetMin}
        speed={speed}
        setSpeed={setSpeed}
        playing={playing}
        setPlaying={setPlaying}
      />
    </main>
  );
};

export default Index;
