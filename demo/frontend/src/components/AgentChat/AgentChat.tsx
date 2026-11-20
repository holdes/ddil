import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Leaf, Clock, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAgentChat } from "../sec/hooks/useAgentChat";
import type { ToolStep } from "../sec/hooks/useAgentChat";
import { ToolCard } from "../sec/shared/agent/ToolCard";
import { useAppContext } from "../../App";

// The vineyard "AI Agronomist" now runs the real `vineyard-advisor` Agent Builder
// agent (Kibana tool-calling over vineyard-* ES|QL tools) via the generic
// /api/agent/converse proxy — replacing the old hardcoded 5-phase Python harness.
// Tool-calls are rendered live so the agentic work is visible.

const SUGGESTED_QUERIES = [
  "Why is La Rivière (BLK-C) underperforming since 2022?",
  "Why was the 2020 Clos du Vent Syrah our best wine despite the drought?",
  "Which blocks are at risk for disease this season?",
  "What's happening with potassium levels in Block C?",
  "Compare Block E (Vieilles Vignes) consistency across all vintages",
  "What should I prioritize this week across the estate?",
];

interface CachedConversation {
  query: string;
  blockId: string | null;
  answer: string;
  tools: ToolStep[];
  timestamp: number;
}

const CACHE_KEY = "vineyard-conversations";
const MAX_CACHED = 20;

function loadCached(): CachedConversation[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveConversation(conv: CachedConversation) {
  localStorage.setItem(CACHE_KEY, JSON.stringify([conv, ...loadCached()].slice(0, MAX_CACHED)));
}

function AnswerMarkdown({ text }: { text: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-headings:text-slate-200 prose-strong:text-slate-100 prose-li:my-0.5 prose-table:text-xs">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

export function AgentChat() {
  const [input, setInput] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [history, setHistory] = useState<CachedConversation[]>(loadCached);
  const [viewingCached, setViewingCached] = useState<CachedConversation | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [brain, setBrain] = useState<"local" | "cheat">("local");
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { state, send, reset } = useAgentChat({
    endpoint: "/api/agent/converse",
    agentId: "vineyard-advisor",
    connectorId: brain === "cheat" ? "ddil-cheat-bedrock" : "ddil-agent-qwen3",
  });
  const { pendingQuery, setPendingQuery, selectedBlockId } = useAppContext();

  const running = state.status === "starting" || state.status === "streaming";

  // elapsed timer
  useEffect(() => {
    if (running) {
      const t0 = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  function run(msg: string) {
    const block = selectedBlockId ? `For block ${selectedBlockId}: ` : "";
    setLastQuery(msg);
    setViewingCached(null);
    setInput("");
    send(block + msg);
  }

  // Auto-fire pending query from dashboard/map navigation
  useEffect(() => {
    if (pendingQuery && !running) {
      const q = pendingQuery;
      setPendingQuery(null);
      reset();
      setTimeout(() => run(q), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuery]);

  // Cache completed conversations
  useEffect(() => {
    if (state.status === "done" && lastQuery && state.answer) {
      saveConversation({
        query: lastQuery, blockId: selectedBlockId,
        answer: state.answer, tools: state.tools, timestamp: Date.now(),
      });
      setHistory(loadCached());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.tools.length, state.answer]);

  const handleSubmit = (query?: string) => {
    const msg = query || input.trim();
    if (!msg || running) return;
    run(msg);
  };

  const showInitial = !running && state.status === "idle" && !viewingCached;

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400 mb-2">
            <span className="w-2 h-2 bg-emerald-500" />
            Elastic Agent Builder &middot; vineyard-advisor &middot; live tool-calling
          </div>
          <h2 className="text-[30px] leading-none font-bold tracking-[-0.02em] text-slate-50">AI Agronomist</h2>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {running && (
            <div className="flex items-center gap-1.5 font-mono text-[12px] text-slate-400"><Clock size={14} />{elapsed}s</div>
          )}
          {/* On-box (local) ↔ Cloud (Bedrock Claude cheat) brain toggle */}
          <div className="inline-flex border border-slate-50 font-mono text-[11px] uppercase tracking-wider">
            <button
              onClick={() => setBrain("local")}
              disabled={running}
              className={`px-3 py-1.5 transition-colors disabled:opacity-60 ${brain === "local" ? "bg-slate-50 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-50"}`}
            >
              ⚡ On-box
            </button>
            <button
              onClick={() => setBrain("cheat")}
              disabled={running}
              className={`px-3 py-1.5 border-l border-slate-50 transition-colors disabled:opacity-60 ${brain === "cheat" ? "bg-blue-500 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-50"}`}
            >
              ☁ Cloud · Claude
            </button>
          </div>
          {(state.status === "done" || viewingCached) && (
            <button onClick={() => { setViewingCached(null); reset(); }}
              className="font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 border border-slate-700 text-slate-400 hover:border-slate-50 hover:text-slate-50 transition-colors">
              New Query
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto min-h-0">
        {showInitial ? (
          <div className="flex flex-col h-full gap-6 overflow-auto">
            <div className="text-center pt-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Leaf size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-300">Ask about your vineyard</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                A real Elastic Agent Builder agent calls ES|QL tools over your sensor, NPK, harvest and imagery indices — live.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-2xl mx-auto">
              {SUGGESTED_QUERIES.map((q) => (
                <button key={q} onClick={() => handleSubmit(q)}
                  className="text-left text-sm p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors">
                  {q}
                </button>
              ))}
            </div>
            {history.length > 0 && (
              <div className="max-w-2xl mx-auto w-full">
                <h4 className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1.5"><Clock size={12} />Recent Investigations</h4>
                <div className="space-y-1.5">
                  {history.slice(0, 8).map((conv, i) => (
                    <button key={i} onClick={() => setViewingCached(conv)}
                      className="w-full text-left p-3 rounded-lg bg-slate-900/30 border border-slate-800/50 hover:border-slate-700 transition-colors group">
                      <div className="text-sm text-slate-300 group-hover:text-slate-100 truncate">{conv.query}</div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-600">
                        {conv.blockId && <span className="text-emerald-500/60">{conv.blockId}</span>}
                        <span>{conv.tools.length} tool calls</span>
                        <span>{new Date(conv.timestamp).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {/* Question */}
            <div className="mb-2 p-3 rounded-lg bg-slate-800/40 border border-slate-700">
              <div className="text-xs text-slate-500 mb-1">Your Question</div>
              <div className="text-sm text-slate-200">{viewingCached ? viewingCached.query : lastQuery}</div>
            </div>

            {/* Tool calls (live) */}
            {(viewingCached ? viewingCached.tools : state.tools).length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles size={12} /> Tool calls
                </div>
                {(viewingCached ? viewingCached.tools : state.tools).map((t, i) => (
                  <ToolCard key={t.id || i} step={t} index={i} />
                ))}
              </div>
            )}

            {/* Thinking indicator before any answer text */}
            {running && !state.answer && (
              <div className="flex items-center gap-2 text-sm text-slate-400 p-3">
                <Loader2 size={14} className="animate-spin text-emerald-400" />
                {state.tools.length ? "Analysing tool results…" : "Thinking…"}
              </div>
            )}

            {/* Streamed answer */}
            {(viewingCached ? viewingCached.answer : state.answer) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                {!running && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                    <CheckCircle2 size={16} /> Agronomist analysis
                  </div>
                )}
                <AnswerMarkdown text={viewingCached ? viewingCached.answer : state.answer} />
              </motion.div>
            )}

            {viewingCached && (
              <button onClick={() => handleSubmit(viewingCached.query)}
                className="w-full mt-1 py-2.5 text-sm rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
                Re-run this investigation
              </button>
            )}

            {state.error && (
              <div className="mt-2 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400 text-sm font-medium"><AlertCircle size={16} />{state.error}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Ask about soil, irrigation, disease risk, crop management..."
          disabled={running}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50" />
        <button onClick={() => handleSubmit()} disabled={running || !input.trim()}
          className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {running ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
