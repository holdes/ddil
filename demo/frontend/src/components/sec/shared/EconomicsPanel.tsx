import { Bot, Sparkles, ShieldCheck, Clock } from "lucide-react";

interface Props {
  gpuTotalMs: number;       // ingest + force-merge for GPU side (from the race)
  cpuTotalMs: number;       // ingest + force-merge for CPU side (from the race)
}

/**
 * Kit economics. The SEC demo runs on the airgapped DDIL kit, so there is no
 * per-hour instance price and no per-token model bill to show. This panel states
 * what is true without measurement: where the work ran and what left the case
 * (nothing). Race durations come from the same race the chart above shows.
 */
export function EconomicsPanel({ gpuTotalMs, cpuTotalMs }: Props) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-[var(--color-elastic)]" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Kit economics · everything runs in the case</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <JobTile label="CPU · Framework Desktop" detail="Ryzen AI Max+ 395 · es-cpu" jobMs={cpuTotalMs} tone="amber" />
        <JobTile label="GPU · DGX Spark" detail="NVIDIA GB10 · es-gpu · cuVS" jobMs={gpuTotalMs} tone="emerald" />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700/60">
        <Fact
          Icon={Bot}
          title="Inference on the kit"
          body="NVIDIA Nemotron 3.5 Lightning through Ollama on the DGX Spark. Agent Builder reaches it through a Kibana connector."
        />
        <Fact
          Icon={Sparkles}
          title="Embeddings on the kit"
          body="Jina Embeddings v5 Omni on the DGX Spark embeds the corpus and every query."
        />
        <Fact
          Icon={ShieldCheck}
          title="Nothing leaves the case"
          body="No cloud account, no per-hour or per-token bill. The filings, vectors and answers stay on the two nodes."
        />
      </div>
    </div>
  );
}

function JobTile({ label, detail, jobMs, tone }: { label: string; detail: string; jobMs: number; tone: "amber" | "emerald" }) {
  const text = tone === "amber" ? "text-amber-300" : "text-emerald-300";
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-3">
      <div className={`text-xs font-semibold ${text}`}>{label}</div>
      <div className="text-[10px] text-slate-500 mb-2">{detail}</div>
      <div className="flex items-baseline gap-1.5 text-2xl font-mono font-bold text-slate-100">
        <Clock size={16} className="text-slate-500 self-center" />
        {jobMs ? `${(jobMs / 1000).toFixed(1)}s` : "—"}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">ingest + force-merge, this race</div>
    </div>
  );
}

function Fact({ Icon, title, body }: { Icon: typeof Bot; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-elastic)]/25 bg-[var(--color-elastic)]/[0.04] p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
        <Icon size={13} className="text-[var(--color-elastic)]" />
        {title}
      </div>
      <p className="text-[11px] text-slate-400 mt-1 leading-snug">{body}</p>
    </div>
  );
}
