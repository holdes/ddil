import { Clock, Cpu, Coins, ExternalLink, Sparkles, AlertTriangle, ShieldCheck } from "lucide-react";
import type { RoundMetadata } from "../../hooks/useAgentChat";
import { SearchSpectrum } from "../diagrams/SearchSpectrum";
import { TraditionalComparison } from "./TraditionalComparison";

interface Props {
  meta: RoundMetadata;
  toolCallCount: number;
}

/**
 * Below-the-answer panel: pairs the live run's latency and token counts with the
 * "Search is changing" spectrum + Elastic context-management story.
 *
 * The agent runs on the airgapped kit (Nemotron 3.5 Lightning via Ollama on the
 * DGX Spark), so there is no per-token bill to compute or project.
 *
 * Numbers cited:
 *   21–39% token reduction via dynamically loaded skills
 *   27–34% via top-snippets retrieval
 *   Up to 40% combined reduction
 *   30+ turn conversations without degradation
 *   — Elastic Search Labs (Agent Builder context management)
 */

export function TradeoffPanel({ meta, toolCallCount }: Props) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5 space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">The tradeoff in agentic search</h3>
          <p className="text-xs text-slate-400 mt-1">Autonomy isn't free: every extra reasoning hop costs tokens and GPU time on the kit. Context management is how Elastic keeps it bounded.</p>
        </div>
        <a
          href="https://www.elastic.co/search-labs/blog/elastic-agent-builder-ai-agents-context-management"
          target="_blank" rel="noreferrer"
          className="text-[10px] text-[var(--color-elastic)] hover:underline flex items-center gap-1 shrink-0"
        >
          Search Labs · context management <ExternalLink size={10} />
        </a>
      </div>

      {/* Row 2 — what the same job costs through every other approach we'd actually consider */}
      <TraditionalComparison meta={meta} toolCallCount={toolCallCount} />

      <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-5">
        {/* Spectrum visual */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-2">Search is changing</div>
          <SearchSpectrum activeIndex={3} />
        </div>

        {/* This run's numbers */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={11} className="text-amber-400" /> This run's actual numbers
          </div>
          <div className="space-y-3">
            <RunStat Icon={Clock} label="Time to last token"
                     value={meta.timeToLastTokenMs ? `${(meta.timeToLastTokenMs / 1000).toFixed(1)} s` : "—"}
                     sub={meta.timeToFirstTokenMs ? `ttft ${(meta.timeToFirstTokenMs / 1000).toFixed(1)} s` : ""} />
            <RunStat Icon={Cpu} label="LLM round-trips"
                     value={meta.llmCalls ? `${meta.llmCalls}` : "—"}
                     sub={`${toolCallCount} tool call${toolCallCount === 1 ? "" : "s"}`} />
            <RunStat Icon={Coins} label="Tokens"
                     value={meta.inputTokens != null ? `${(meta.inputTokens / 1000).toFixed(0)}k in · ${(meta.outputTokens ?? 0).toLocaleString()} out` : "—"}
                     sub={meta.model || ""} />
            <RunStat Icon={ShieldCheck} label="Cloud spend (this answer)"
                     value="None"
                     sub="answered on the DGX Spark, inside the case" />
          </div>
        </div>

        {/* Elastic context-management story */}
        <div className="rounded-xl border border-[var(--color-elastic)]/30 bg-[var(--color-elastic)]/[0.04] p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--color-elastic)] mb-3 flex items-center gap-1.5">
            <Sparkles size={11} /> How Elastic shrinks this
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <Bullet label="Dynamically loaded skills">
              <span className="text-[var(--color-elastic)] font-mono">21–39%</span> input-token reduction — instructions load on demand, not in every system prompt.
            </Bullet>
            <Bullet label="Top-snippets retrieval">
              <span className="text-[var(--color-elastic)] font-mono">27–34%</span> token reduction — only the matching passages enter context, not whole documents.
            </Bullet>
            <Bullet label="Selective context compaction">
              Earlier turns summarized rather than truncated — sustains <span className="text-[var(--color-elastic)] font-mono">30+ turn</span> conversations.
            </Bullet>
            <Bullet label="Combined">
              <span className="text-[var(--color-elastic)] font-mono">up to 40%</span> combined token reduction without sacrificing answer quality.
            </Bullet>
          </ul>

          <div className="mt-4 pt-3 border-t border-slate-700/40 text-[11px] text-slate-400 leading-snug">
            <span className="font-semibold text-slate-200">On the kit,</span> fewer tokens means faster answers and more headroom on the DGX Spark GPU. There is no per-token bill to shrink: the model runs inside the case.
          </div>
        </div>
      </div>
    </div>
  );
}

function RunStat({ Icon, label, value, sub }: { Icon: typeof Clock; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={13} className="text-slate-500 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-sm font-mono font-semibold text-slate-100">{value}</div>
        {sub && <div className="text-[10px] text-slate-500 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function Bullet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="leading-snug">
      <span className="font-semibold text-slate-100">{label}.</span>{" "}
      <span className="text-slate-300">{children}</span>
    </li>
  );
}
