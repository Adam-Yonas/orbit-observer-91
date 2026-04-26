import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X, Loader2, Wrench } from "lucide-react";
import { OrbitObject } from "@/lib/orbital";
import { supabase } from "@/integrations/supabase/client";
import { BACKEND_URL, USING_CUSTOM_BACKEND } from "@/lib/backend";

interface Message {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
}

interface Props {
  catalog: OrbitObject[];
  externalPrompt?: { text: string; nonce: number } | null;
}

const SUGGESTIONS = [
  "Which altitude shells are most dangerous?",
  "List the 5 highest-risk debris objects",
  "How many Iridium fragments are above 700 km?",
  "Summarize the catalog",
];

export function Copilot({ catalog, externalPrompt }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm the Orbital Watch Co-pilot. Ask me anything about the loaded catalog and I'll query it for you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!externalPrompt) return;
    setOpen(true);
    send(externalPrompt.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt?.nonce]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      // Slim the catalog to just what the model needs
      const slim = catalog.map((o) => ({
        id: o.id,
        name: o.name,
        kind: o.kind,
        country: o.country,
        perigeeKm: o.perigeeKm,
        apogeeKm: o.apogeeKm,
        inclinationDeg: o.inclinationDeg,
        periodMin: o.periodMin,
        risk: o.risk,
      }));

      let data: { reply?: string; tool_trace?: { content: string }[]; error?: string };

      if (USING_CUSTOM_BACKEND && BACKEND_URL) {
        // Self-hosted Python backend
        const resp = await fetch(`${BACKEND_URL}/copilot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            catalog: slim,
          }),
        });
        if (!resp.ok) throw new Error(`Backend ${resp.status}: ${await resp.text()}`);
        data = await resp.json();
      } else {
        // Lovable Cloud edge function
        const result = await supabase.functions.invoke("copilot", {
          body: {
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            catalog: slim,
          },
        });
        if (result.error) throw result.error;
        data = result.data;
      }

      if (data?.error) throw new Error(data.error);

      const tools: string[] = (data?.tool_trace ?? [])
        .map((t: { content: string }) => t.content)
        .slice(0, 3);

      setMessages((m) => [
        ...m,
        { role: "assistant", content: data?.reply ?? "(no reply)", tools },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full panel border border-primary/40 hover:border-primary text-primary glow-primary text-xs font-mono uppercase tracking-wider transition-all hover:scale-105"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Ask Co-pilot
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-30 w-[min(380px,calc(100vw-2rem))] h-[480px] panel rounded-lg flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary/15 border border-primary/40 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Orbital Co-pilot</div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Gemini 2.5 · agentic tools
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm ${
              m.role === "user" ? "text-foreground" : "text-foreground/90"
            }`}
          >
            <div
              className={`inline-block max-w-full rounded-lg px-3 py-2 whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary/15 border border-primary/30"
                  : "bg-secondary/50 border border-border"
              }`}
            >
              {m.content}
            </div>
            {m.tools && m.tools.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.tools.map((_, j) => (
                  <span
                    key={j}
                    className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-primary/80 border border-primary/30 rounded px-1.5 py-0.5"
                  >
                    <Wrench className="w-2.5 h-2.5" /> tool call
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> querying catalog…
          </div>
        )}
        {messages.length === 1 && !loading && (
          <div className="space-y-1.5 pt-2">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Try
            </div>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left text-xs px-2.5 py-1.5 rounded border border-border hover:border-primary/50 hover:text-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 px-3 py-2.5 border-t border-border"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the catalog…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
