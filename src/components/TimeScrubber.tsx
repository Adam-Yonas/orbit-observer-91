import { Play, Pause, Rewind, FastForward } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface Props {
  time: Date;
  baseTime: Date;
  offsetMin: number;
  setOffsetMin: (n: number) => void;
  speed: number;
  setSpeed: (n: number) => void;
  playing: boolean;
  setPlaying: (b: boolean) => void;
}

const SPEEDS = [1, 60, 600, 3600];

export function TimeScrubber({
  time,
  offsetMin,
  setOffsetMin,
  speed,
  setSpeed,
  playing,
  setPlaying,
}: Props) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 panel rounded-lg px-5 py-3 z-20 w-[min(720px,calc(100%-2rem))]">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">UTC</span>
          <span className="font-mono text-sm text-primary text-glow">
            {time.toISOString().replace("T", " ").slice(0, 19)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffsetMin(offsetMin - 30)}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
          >
            <Rewind className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className="p-2 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setOffsetMin(offsetMin + 30)}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1">
          <Slider
            min={-720}
            max={720}
            step={1}
            value={[offsetMin]}
            onValueChange={(v) => setOffsetMin(v[0])}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
            <span>−12h</span>
            <span>now</span>
            <span>+12h</span>
          </div>
        </div>

        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${
                speed === s
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {s === 1 ? "1×" : s === 60 ? "1m/s" : s === 600 ? "10m/s" : "1h/s"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
