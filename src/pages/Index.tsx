import { useEffect, useMemo, useRef, useState } from "react";
import { Globe } from "@/components/Globe";
import { FilterPanel, Filters } from "@/components/FilterPanel";
import { TimeScrubber } from "@/components/TimeScrubber";
import { StatsBar } from "@/components/StatsBar";
import { DetailsDrawer } from "@/components/DetailsDrawer";
import { AltitudeChart } from "@/components/AltitudeChart";
import { Copilot } from "@/components/Copilot";
import { AboutPanel } from "@/components/AboutPanel";
import { LaunchPanel } from "@/components/LaunchPanel";
import { generateCatalog, fetchLiveCatalog, OrbitObject, spawnCollision, runChainReactionAsync, type Conjunction, type CollisionEvent } from "@/lib/orbital";
import type { SpacecraftBody } from "@/lib/spacecraft";
import { Satellite, AlertTriangle, Radio, Loader2 } from "lucide-react";
import { toast } from "sonner";

type DataSource = "live" | "synthetic";

const Index = () => {
  const [catalog, setCatalog] = useState<OrbitObject[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>("live");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    payload: true,
    rocket_body: true,
    debris: true,
    altMin: 200,
    altMax: 2200,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cascadeIds, setCascadeIds] = useState<Set<string>>(new Set());
  const [cascadeRunning, setCascadeRunning] = useState(false);
  const [collisionEvent, setCollisionEvent] = useState<(CollisionEvent & { key: number }) | null>(null);
  const [pendingCollision, setPendingCollision] = useState<{
    victimId: string;
    body: SpacecraftBody;
    collisionTime: Date;
    horizonHours: number;
  } | null>(null);
  const [userObject, setUserObject] = useState<OrbitObject | null>(null);
  const [conjunctions, setConjunctions] = useState<Conjunction[]>([]);
  const [copilotPrompt, setCopilotPrompt] = useState<{ text: string; nonce: number } | null>(null);

  const baseTime = useRef(new Date());
  const [offsetMin, setOffsetMin] = useState(0);
  const [speed, setSpeed] = useState(60);
  const [playing, setPlaying] = useState(true);

  // Load catalog (live or synthetic)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCascadeIds(new Set());

    if (dataSource === "synthetic") {
      const cat = generateCatalog(2200);
      if (!cancelled) {
        setCatalog(cat);
        setLoading(false);
      }
      return () => {
        cancelled = true;
      };
    }

    fetchLiveCatalog([
      "active",
      "iridium-33-debris",
      "cosmos-1408-debris",
      "fengyun-1c-debris",
    ])
      .then((cat) => {
        if (cancelled) return;
        if (cat.length === 0) {
          toast.error("Live feed empty — falling back to synthetic catalog");
          setCatalog(generateCatalog(2200));
        } else {
          setCatalog(cat);
          toast.success(`Loaded ${cat.length.toLocaleString()} live objects from CelesTrak`);
        }
      })
      .catch((err) => {
        console.error("Live catalog fetch failed", err);
        if (cancelled) return;
        toast.error("CelesTrak fetch failed — using synthetic catalog");
        setCatalog(generateCatalog(2200));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataSource]);

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

  // Combined catalog including the user satellite (if any)
  const renderedCatalog = useMemo(
    () => (userObject ? [...catalog, userObject] : catalog),
    [catalog, userObject]
  );

  // Visible IDs based on filters
  const visibleIds = useMemo(() => {
    const set = new Set<string>();
    renderedCatalog.forEach((o) => {
      if (o.kind === "user") {
        set.add(o.id);
        return;
      }
      if (!filters[o.kind]) return;
      const mid = (o.perigeeKm + o.apogeeKm) / 2;
      if (mid < filters.altMin || mid > filters.altMax) return;
      set.add(o.id);
    });
    return set;
  }, [renderedCatalog, filters]);

  const selectedObj = useMemo(
    () => renderedCatalog.find((o) => o.id === selectedId) ?? null,
    [renderedCatalog, selectedId]
  );

  // Launch-driven collision: the user's launched body strikes a catalog object
  // at the conjunction time. Relative velocity + geometry come from the orbits
  // and the chosen spacecraft body — no imaginary impactor mass.
  const triggerLaunchCollision = async (
    victimId: string,
    body: SpacecraftBody,
    collisionTime: Date
  ) => {
    if (cascadeRunning) return;
    if (!userObject) {
      toast.error("Launch a satellite first");
      return;
    }
    const victim = renderedCatalog.find((o) => o.id === victimId);
    if (!victim) {
      toast.error("Could not find the conjunction target");
      return;
    }

    // Jump the sim clock to the moment of impact and pause.
    setPlaying(false);
    setOffsetMin((collisionTime.getTime() - baseTime.current.getTime()) / 60_000);

    setCascadeRunning(true);
    try {
      const { fragments, collision, vRelKms } = spawnCollision(
        victim,
        userObject,
        { massKg: body.massKg, charLenM: body.charLenM },
        collisionTime
      );

      if (collision) {
        setCollisionEvent({ ...collision, key: Date.now() });
        window.setTimeout(() => setCollisionEvent(null), 3000);
      }
      if (fragments.length === 0) {
        toast.error("Collision produced no surviving fragments");
        return;
      }
      fragments.forEach((f) => (f.collisionGeneration = 0));

      const newCascade = new Set(cascadeIds);
      newCascade.add(victim.id);
      fragments.forEach((f) => newCascade.add(f.id));

      // Cascade onward through the catalog.
      const result = await runChainReactionAsync(catalog, fragments, collisionTime, {
        horizonMin: 90,
        missDistanceKm: 5,
      });
      result.destroyedIds.forEach((d) => newCascade.add(d));
      result.newFragments.forEach((f) => newCascade.add(f.id));

      setCatalog((prev) => [...prev, ...fragments, ...result.newFragments]);
      setCascadeIds(newCascade);

      const total = fragments.length + result.newFragments.length;
      toast.warning(
        `Impact · ${body.name} hit ${victim.name} at ${vRelKms.toFixed(1)} km/s · ${total} fragments · ${result.events.length} secondary collision${result.events.length === 1 ? "" : "s"}`
      );
    } finally {
      setCascadeRunning(false);
    }
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
              <span className="sr-only"> — Live Space Debris Tracker</span>
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Live space debris tracker · v1.0
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loading && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading catalog…
            </div>
          )}
          <div className="flex items-center rounded border border-border overflow-hidden text-[10px] font-mono uppercase tracking-wider">
            <button
              onClick={() => setDataSource("live")}
              className={`px-2.5 py-1 flex items-center gap-1.5 transition-colors ${
                dataSource === "live"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-muted/30"
              }`}
            >
              <Radio className="w-3 h-3" /> Live
            </button>
            <button
              onClick={() => setDataSource("synthetic")}
              className={`px-2.5 py-1 transition-colors ${
                dataSource === "synthetic"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-muted/30"
              }`}
            >
              Synthetic
            </button>
          </div>
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
        {renderedCatalog.length > 0 && (
          <Globe
            catalog={renderedCatalog}
            visibleIds={visibleIds}
            time={time}
            selectedId={selectedId}
            onSelect={setSelectedId}
            cascadeIds={cascadeIds}
            collisionEvent={collisionEvent}
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
      <DetailsDrawer obj={selectedObj} onClose={() => setSelectedId(null)} />
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
      <LaunchPanel
        catalog={catalog}
        time={time}
        userObject={userObject}
        setUserObject={setUserObject}
        conjunctions={conjunctions}
        setConjunctions={setConjunctions}
        onAskCopilot={(text) => setCopilotPrompt({ text, nonce: Date.now() })}
        onSelect={setSelectedId}
        onSimulateCollision={triggerLaunchCollision}
      />
      <Copilot catalog={catalog} externalPrompt={copilotPrompt} />
      <AboutPanel />
    </main>
  );
};

export default Index;
