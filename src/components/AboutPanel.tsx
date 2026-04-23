import { useState } from "react";
import { Info, X, Github, ExternalLink } from "lucide-react";

export function AboutPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-4 right-4 z-20 w-9 h-9 rounded-full panel border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
        aria-label="About this project"
      >
        <Info className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm">
      <div className="panel rounded-lg max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 relative">
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-[10px] font-mono text-primary uppercase tracking-widest">
          About this build
        </div>
        <h2 className="text-2xl font-semibold mt-1 mb-3">
          Orbital Watch
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          A real-time 3D space-debris dashboard with an agentic AI co-pilot. Built end-to-end
          (frontend, edge functions, database, LLM tool-calling) as a portfolio piece for the
          Klaviyo AI Builder Resident program.
        </p>

        <div className="space-y-3 text-sm">
          <Section title="What it does">
            <li>Streams live TLEs from CelesTrak, propagates ~5,000+ objects with SGP4 in the browser.</li>
            <li>Renders the orbital cloud on a WebGL globe (react-three-fiber) at 60 fps.</li>
            <li>Lets you scrub time ±12h, filter by class &amp; altitude, and inspect any object.</li>
            <li>Simulates Kessler-syndrome cascades with ~80 fragments per event.</li>
            <li>An <strong className="text-primary">AI co-pilot</strong> (Gemini + tool calling) answers questions by querying the live catalog.</li>
          </Section>

          <Section title="The agentic part">
            <li>Edge function exposes 4 tools: <code className="text-primary text-xs">catalog_summary</code>, <code className="text-primary text-xs">search_objects</code>, <code className="text-primary text-xs">altitude_histogram</code>, <code className="text-primary text-xs">kessler_risk_assessment</code>.</li>
            <li>Model loops up to 5 times — calling tools, reading JSON results, then answering.</li>
            <li>No hallucinated numbers: every figure traces back to a tool call.</li>
          </Section>

          <Section title="Stack">
            <li>React 18 · TypeScript · Vite · Tailwind</li>
            <li>three.js / react-three-fiber · satellite.js (SGP4)</li>
            <li>Lovable Cloud (Supabase): Postgres cache, edge functions</li>
            <li>Lovable AI Gateway → Google Gemini 2.5 Flash</li>
          </Section>
        </div>

        <div className="flex gap-2 mt-5 pt-4 border-t border-border">
          <a
            href="https://github.com/Adam-Yonas/space-debris-dashboard"
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider px-3 py-2 rounded border border-border hover:border-primary hover:text-primary transition-colors"
          >
            <Github className="w-3.5 h-3.5" /> Source
          </a>
          <a
            href="https://celestrak.org/"
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider px-3 py-2 rounded border border-border hover:border-primary hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> CelesTrak
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono text-primary uppercase tracking-wider mb-1.5">
        {title}
      </div>
      <ul className="space-y-1 text-sm text-foreground/85 list-disc list-inside marker:text-primary/60">
        {children}
      </ul>
    </div>
  );
}
