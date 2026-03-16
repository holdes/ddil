import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  Search,
  AlertTriangle,
  Leaf,
  ClipboardList,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAgentStream } from "./useAgentStream";
import type { PhaseInfo } from "./useAgentStream";
import { useAppContext } from "../../App";

const PHASE_ICONS: Record<string, React.ReactNode> = {
  sensors: <Activity size={16} />,
  historical: <Search size={16} />,
  risk: <AlertTriangle size={16} />,
  recommendation: <Leaf size={16} />,
  action_plan: <ClipboardList size={16} />,
};

const PHASE_COLORS: Record<string, string> = {
  sensors: "text-blue-400",
  historical: "text-purple-400",
  risk: "text-amber-400",
  recommendation: "text-emerald-400",
  action_plan: "text-cyan-400",
};

const SUGGESTED_QUERIES = [
  "Why is La Rivière (BLK-C) underperforming since 2022?",
  "Why was the 2020 Clos du Vent Syrah our best wine despite the drought?",
  "Which blocks are at risk for disease this season?",
  "What's happening with potassium levels in Block C?",
  "Compare Block E (Vieilles Vignes) consistency across all vintages",
  "What should I prioritize this week across the estate?",
];

function StatusBadge({ status }: { status: PhaseInfo["status"] }) {
  switch (status) {
    case "pending":
      return <div className="w-2 h-2 rounded-full bg-slate-600" />;
    case "running":
      return <Loader2 size={14} className="text-emerald-400 animate-spin" />;
    case "complete":
      return <CheckCircle2 size={14} className="text-emerald-400" />;
    case "error":
      return <AlertCircle size={14} className="text-red-400" />;
  }
}

function PhaseCard({
  phase,
  isLast,
}: {
  phase: PhaseInfo;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasData = phase.status === "complete" && phase.data;

  // Auto-expand on complete
  useEffect(() => {
    if (phase.status === "complete") setExpanded(true);
  }, [phase.status]);

  return (
    <div className="relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-slate-800" />
      )}

      <div
        className={`flex gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
          phase.status === "running"
            ? "bg-slate-800/60 border border-slate-700"
            : phase.status === "complete"
            ? "bg-slate-900/50"
            : "opacity-50"
        }`}
        onClick={() => hasData && setExpanded(!expanded)}
      >
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            phase.status === "running"
              ? "bg-emerald-500/20"
              : phase.status === "complete"
              ? "bg-slate-800"
              : "bg-slate-900"
          } ${PHASE_COLORS[phase.id] || "text-slate-400"}`}
        >
          {PHASE_ICONS[phase.id]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{phase.name}</span>
              <StatusBadge status={phase.status} />
            </div>
            {hasData && (
              <span className="text-slate-500">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
          </div>

          {/* Live progress messages */}
          {phase.status === "running" && phase.messages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-slate-400 mt-1"
            >
              {phase.messages[phase.messages.length - 1]}
            </motion.div>
          )}

          {/* Expanded data */}
          <AnimatePresence>
            {expanded && hasData && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <PhaseDetail phaseId={phase.id} data={phase.data!} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function PhaseDetail({
  phaseId,
  data,
}: {
  phaseId: string;
  data: Record<string, unknown>;
}) {
  switch (phaseId) {
    case "sensors":
      return (
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          {[
            { label: "Moisture", value: `${data.moisture}%`, color: "text-blue-400" },
            { label: "Temp", value: `${data.temperature}°C`, color: "text-orange-400" },
            { label: "N", value: `${data.nitrogen}`, color: "text-emerald-400" },
            { label: "P", value: `${data.phosphorus}`, color: "text-blue-400" },
            { label: "K", value: `${data.potassium}`, color: "text-purple-400" },
            { label: "pH", value: `${data.ph}`, color: "text-slate-300" },
          ].map((m) => (
            <div key={m.label} className="bg-slate-800/60 rounded p-2 text-center">
              <div className={`font-mono font-bold ${m.color}`}>{m.value}</div>
              <div className="text-slate-500">{m.label}</div>
            </div>
          ))}
        </div>
      );

    case "historical": {
      const matches = (data.matches as Array<Record<string, unknown>>) || [];
      return (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-slate-400">{data.pattern_summary as string}</p>
          {matches.slice(0, 3).map((m, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-slate-800/40 rounded p-2">
              <span className="text-slate-300">{m.title as string}</span>
              <span className="text-purple-400 font-mono">{((m.similarity as number) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      );
    }

    case "risk": {
      const risks = (data.risks as Array<Record<string, unknown>>) || [];
      const severityColors: Record<string, string> = {
        low: "bg-emerald-500/20 text-emerald-400",
        medium: "bg-amber-500/20 text-amber-400",
        high: "bg-orange-500/20 text-orange-400",
        critical: "bg-red-500/20 text-red-400",
      };
      return (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Overall:</span>
            <span className={`text-xs px-2 py-0.5 rounded ${severityColors[data.overall_risk as string] || ""}`}>
              {(data.overall_risk as string || "").toUpperCase()}
            </span>
          </div>
          {risks.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded ${severityColors[r.severity as string] || ""}`}>
                {(r.severity as string || "").toUpperCase()}
              </span>
              <span className="text-slate-300">{r.description as string}</span>
            </div>
          ))}
        </div>
      );
    }

    case "recommendation": {
      const recs = (data.recommendations as Array<Record<string, unknown>>) || [];
      const prioColors: Record<string, string> = {
        low: "text-slate-400",
        medium: "text-blue-400",
        high: "text-amber-400",
        urgent: "text-red-400",
      };
      return (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-slate-400">{data.variety_notes as string}</p>
          {recs.map((r, i) => (
            <div key={i} className="text-xs bg-slate-800/40 rounded p-2">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${prioColors[r.priority as string] || ""}`}>
                  [{(r.priority as string || "").toUpperCase()}]
                </span>
                <span className="text-slate-200">{r.action as string}</span>
              </div>
              <div className="text-slate-500 mt-0.5">{r.rationale as string}</div>
            </div>
          ))}
        </div>
      );
    }

    case "action_plan": {
      const actions = (data.actions as Array<Record<string, unknown>>) || [];
      return (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-slate-400 italic">{data.estimated_cost as string}</p>
          {actions.map((a, i) => (
            <div key={i} className="text-xs bg-slate-800/40 rounded p-2 flex items-start gap-2">
              <span className="font-mono text-emerald-400 shrink-0">{i + 1}.</span>
              <div>
                <div className="text-slate-200 font-medium">{a.task as string}</div>
                <div className="text-slate-500">
                  {a.assignee as string} &middot; {a.deadline as string}
                  {a.equipment && ` &middot; ${a.equipment}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    default:
      return (
        <pre className="mt-2 text-xs text-slate-400 overflow-auto max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}

interface CachedConversation {
  query: string;
  blockId: string | null;
  phases: PhaseInfo[];
  results: Record<string, unknown> | null;
  elapsed: number;
  timestamp: number;
}

const CACHE_KEY = "vineyard-conversations";
const MAX_CACHED = 20;

function loadCachedConversations(): CachedConversation[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversation(conv: CachedConversation) {
  const existing = loadCachedConversations();
  const updated = [conv, ...existing].slice(0, MAX_CACHED);
  localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
}

export function AgentChat() {
  const [input, setInput] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [history, setHistory] = useState<CachedConversation[]>(loadCachedConversations);
  const [viewingCached, setViewingCached] = useState<CachedConversation | null>(null);
  const { state, startStream, reset } = useAgentStream();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { pendingQuery, setPendingQuery, selectedBlockId } = useAppContext();

  // Auto-fire pending query from dashboard/map navigation
  useEffect(() => {
    if (pendingQuery && !state.isRunning) {
      const q = pendingQuery;
      setPendingQuery(null);
      setLastQuery(q);
      setViewingCached(null);
      reset();
      setTimeout(() => startStream(q, selectedBlockId || undefined), 100);
    }
  }, [pendingQuery]);

  // Cache completed conversations
  useEffect(() => {
    if (state.results && lastQuery) {
      const conv: CachedConversation = {
        query: lastQuery,
        blockId: selectedBlockId,
        phases: state.phases,
        results: state.results,
        elapsed: state.elapsed,
        timestamp: Date.now(),
      };
      saveConversation(conv);
      setHistory(loadCachedConversations());
    }
  }, [state.results]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.phases]);

  const handleSubmit = (query?: string) => {
    const msg = query || input.trim();
    if (!msg || state.isRunning) return;
    setLastQuery(msg);
    setViewingCached(null);
    setInput("");
    startStream(msg);
  };

  const handleNewQuery = () => {
    setViewingCached(null);
    reset();
  };

  const progressPct = state.phases.reduce(
    (max, p) => Math.max(max, p.progress_pct),
    0
  );

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">AI Agronomist</h2>
          <p className="text-sm text-slate-400 mt-1">
            Multi-phase agentic advisor &middot; Elastic + LLM pipeline
          </p>
        </div>
        {state.isRunning && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock size={14} />
            {state.elapsed}s
          </div>
        )}
        {(state.results || viewingCached) && (
          <button
            onClick={handleNewQuery}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            New Query
          </button>
        )}
      </div>

      {/* Progress bar */}
      {state.isRunning && (
        <div className="h-1 bg-slate-800 rounded-full mb-4 overflow-hidden">
          <motion.div
            className="h-full bg-emerald-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Main content area */}
      <div ref={scrollRef} className="flex-1 overflow-auto min-h-0">
        {!state.isRunning && !state.results && !viewingCached ? (
          /* Initial state — show suggested queries + history */
          <div className="flex flex-col h-full gap-6 overflow-auto">
            <div className="text-center pt-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Leaf size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-300">
                Ask about your vineyard
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                5-phase agentic pipeline: sensor data, historical context, risk analysis, recommendations, and action plan.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-2xl mx-auto">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSubmit(q)}
                  className="text-left text-sm p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Conversation History */}
            {history.length > 0 && (
              <div className="max-w-2xl mx-auto w-full">
                <h4 className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1.5">
                  <Clock size={12} />
                  Recent Investigations
                </h4>
                <div className="space-y-1.5">
                  {history.slice(0, 8).map((conv, i) => (
                    <button
                      key={i}
                      onClick={() => setViewingCached(conv)}
                      className="w-full text-left p-3 rounded-lg bg-slate-900/30 border border-slate-800/50 hover:border-slate-700 transition-colors group"
                    >
                      <div className="text-sm text-slate-300 group-hover:text-slate-100 truncate">
                        {conv.query}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-600">
                        {conv.blockId && <span className="text-emerald-500/60">{conv.blockId}</span>}
                        <span>{conv.elapsed}s</span>
                        <span>{new Date(conv.timestamp).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : viewingCached ? (
          /* Viewing a cached conversation */
          <div className="space-y-2 max-w-2xl mx-auto">
            <div className="mb-4 p-3 rounded-lg bg-slate-800/40 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500 mb-1">Previous Investigation</div>
                <div className="text-[10px] text-slate-600">{new Date(viewingCached.timestamp).toLocaleString()}</div>
              </div>
              <div className="text-sm text-slate-200">{viewingCached.query}</div>
            </div>

            {viewingCached.phases.map((phase, i) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                isLast={i === viewingCached.phases.length - 1}
              />
            ))}

            {viewingCached.results && (
              <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                  <CheckCircle2 size={16} />
                  Analysis Complete &middot; {viewingCached.elapsed}s
                </div>
                <p className="text-sm text-slate-300">
                  {(
                    (viewingCached.results.action_plan as Record<string, unknown>)
                      ?.summary as string
                  ) || "Review each phase above for details."}
                </p>
              </div>
            )}

            <button
              onClick={() => handleSubmit(viewingCached.query)}
              className="w-full mt-3 py-2.5 text-sm rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Re-run this investigation
            </button>
          </div>
        ) : (
          /* Pipeline phases */
          <div className="space-y-2 max-w-2xl mx-auto">
            {/* User query */}
            {state.jobId && (
              <div className="mb-4 p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                <div className="text-xs text-slate-500 mb-1">Your Question</div>
                <div className="text-sm text-slate-200">
                  {/* Extract from first event or show generic */}
                  {lastQuery || input || "Processing..."}
                </div>
              </div>
            )}

            {state.phases.map((phase, i) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                isLast={i === state.phases.length - 1}
              />
            ))}

            {/* Final summary */}
            <AnimatePresence>
              {state.results && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
                >
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                    <CheckCircle2 size={16} />
                    Analysis Complete &middot; {state.elapsed}s
                  </div>
                  <p className="text-sm text-slate-300">
                    {(
                      (state.results.action_plan as Record<string, unknown>)
                        ?.summary as string
                    ) || "Pipeline complete. Review each phase above for details."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {state.error && (
              <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                  <AlertCircle size={16} />
                  {state.error}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Ask about soil, irrigation, disease risk, crop management..."
          disabled={state.isRunning}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
        />
        <button
          onClick={() => handleSubmit()}
          disabled={state.isRunning || !input.trim()}
          className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.isRunning ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
}
