import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw, Zap, Cpu } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useRaceMetrics, type PathMetrics } from "../../hooks/useRaceMetrics";
import { formatNumber, formatDuration } from "../../lib/utils";

function ProgressBar({
  percent,
  color,
}: {
  percent: number;
  color: "amber" | "emerald";
}) {
  const bg = color === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${bg} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(percent, 100)}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}

function MetricsCard({
  path,
  label,
  icon,
  color,
}: {
  path: PathMetrics;
  label: string;
  icon: React.ReactNode;
  color: "amber" | "emerald";
}) {
  const pct = path.totalDocs > 0 ? (path.docsIndexed / path.totalDocs) * 100 : 0;
  const borderColor =
    color === "amber" ? "border-amber-500/30" : "border-emerald-500/30";
  const textColor = color === "amber" ? "text-amber-400" : "text-emerald-400";

  return (
    <div className={`flex-1 p-6 border ${borderColor} rounded-lg bg-slate-900/50`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={textColor}>{icon}</span>
        <h3 className={`font-semibold ${textColor}`}>{label}</h3>
        {path.complete && (
          <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
            Complete
          </span>
        )}
      </div>

      <ProgressBar percent={pct} color={color} />

      <div className="mt-2 text-xs text-slate-400">
        {formatNumber(path.docsIndexed)} / {formatNumber(path.totalDocs)} vectors
        <span className="float-right">{pct.toFixed(1)}%</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <div className="text-xs text-slate-500">Throughput</div>
          <div className="text-lg font-mono font-bold text-slate-200">
            {formatNumber(Math.round(path.throughput))}
            <span className="text-xs text-slate-500 ml-1">v/s</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Merge Time</div>
          <div className="text-lg font-mono font-bold text-slate-200">
            {path.mergeTimeMs.toFixed(0)}
            <span className="text-xs text-slate-500 ml-1">ms</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">
            {path.gpuPercent !== undefined ? "GPU Util" : "CPU"}
          </div>
          <div className="text-lg font-mono font-bold text-slate-200">
            {(path.gpuPercent ?? path.cpuPercent ?? 0).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Elapsed</div>
          <div className="text-lg font-mono font-bold text-slate-200">
            {formatDuration(path.elapsedMs)}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="mt-4 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={path.history}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Line
              type="monotone"
              dataKey="throughput"
              stroke={color === "amber" ? "#f59e0b" : "#10b981"}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function RaceDashboard({ onComplete, autoStart }: { onComplete?: () => void; autoStart?: boolean } = {}) {
  const { metrics, startRace, resetRace } = useRaceMetrics();
  const [starting, setStarting] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  // Auto-start race on mount if requested
  useEffect(() => {
    if (autoStart && !hasAutoStarted && metrics.status === "idle") {
      setHasAutoStarted(true);
      setStarting(true);
      startRace().then(() => setStarting(false));
    }
  }, [autoStart, hasAutoStarted, metrics.status]);

  const handleStart = async () => {
    setStarting(true);
    await startRace();
    setStarting(false);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Indexing Race</h2>
          <p className="text-sm text-slate-400 mt-1">
            DGX Spark &middot; Blackwell GPU &middot; 1 PFLOP &middot; GPU
            HNSW vs CPU HNSW
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleStart}
            disabled={starting || metrics.status === "running"}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            <Play size={16} />
            {starting ? "Starting..." : "Start Race"}
          </button>
          <button
            onClick={resetRace}
            disabled={metrics.status === "running"}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm transition-colors"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          {onComplete && (
            <button
              onClick={onComplete}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              {metrics.status === "complete" ? "Continue to Demo →" : "Skip →"}
            </button>
          )}
        </div>
      </div>

      {/* Split Screen */}
      <div className="flex gap-4 flex-1">
        <MetricsCard
          path={metrics.cpu}
          label="CPU HNSW (Port 9201)"
          icon={<Cpu size={18} />}
          color="amber"
        />
        <MetricsCard
          path={metrics.gpu}
          label="GPU HNSW — cuVS (Port 9200)"
          icon={<Zap size={18} />}
          color="emerald"
        />
      </div>

      {/* GPU finished explainer — appears while CPU is still running */}
      {metrics.gpu.complete && !metrics.cpu.complete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Zap size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-400 mb-2">
                GPU finished — CPU still working
              </h3>
              <p className="text-sm text-slate-300 mb-3">
                The NVIDIA Blackwell GPU completed indexing {formatNumber(metrics.gpu.docsIndexed)} vectors
                in <span className="text-emerald-400 font-medium">{formatDuration(metrics.gpu.elapsedMs)}</span> while
                the CPU has only processed {formatNumber(metrics.cpu.docsIndexed)} of {formatNumber(metrics.cpu.totalDocs)}.
              </p>
              <h4 className="text-sm font-semibold text-white mb-2">What's being accelerated?</h4>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>
                    <span className="text-slate-200 font-medium">HNSW Graph Construction</span> — When vectors are indexed,
                    Elasticsearch builds a Hierarchical Navigable Small World graph for approximate nearest-neighbor search.
                    This graph construction is compute-intensive and happens during segment merges.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>
                    <span className="text-slate-200 font-medium">NVIDIA cuVS</span> — The CUDA Vector Similarities library
                    offloads graph construction to the GPU. The Blackwell architecture processes thousands of distance
                    calculations in parallel, building the same HNSW graph 12x faster.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>
                    <span className="text-slate-200 font-medium">Same recall quality</span> — The GPU produces an identical
                    HNSW graph. Search results are the same (98.9% recall). Only the build time changes — critical for
                    large-scale ingestion where millions of vectors need indexing quickly.
                  </span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-300 mb-2">When to use GPU-accelerated vectors</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-emerald-400 font-medium mb-1">Ideal for:</div>
                    <ul className="text-slate-400 space-y-1">
                      <li>• Large-scale initial data loads (millions of vectors)</li>
                      <li>• Time-sensitive reindexing operations</li>
                      <li>• High-dimensional embeddings (768+ dims)</li>
                      <li>• Airgapped / edge deployments with limited time windows</li>
                    </ul>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium mb-1">Less impactful for:</div>
                    <ul className="text-slate-400 space-y-1">
                      <li>• Small incremental updates (&lt;1K docs)</li>
                      <li>• Search/query performance (already fast on CPU)</li>
                      <li>• Low-dimensional vectors (&lt;32 dims)</li>
                      <li>• Indices that rarely rebuild</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary Ribbon — when both complete */}
      {metrics.status === "complete" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
        >
          <div className="flex items-center justify-around mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">
                {metrics.speedup.toFixed(1)}x
              </div>
              <div className="text-xs text-slate-400">Speedup</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">
                {formatDuration(metrics.timeSaved)}
              </div>
              <div className="text-xs text-slate-400">Time Saved</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-200">
                {metrics.recallGpu.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-400">Recall — identical quality</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-200">
                {formatNumber(metrics.gpu.docsIndexed + metrics.cpu.docsIndexed)}
              </div>
              <div className="text-xs text-slate-400">Total Vectors Indexed</div>
            </div>
          </div>
          <div className="text-center text-sm text-slate-400">
            Both paths produced identical search indices. The GPU-accelerated node finished in{" "}
            <span className="text-emerald-400 font-medium">{formatDuration(metrics.gpu.elapsedMs)}</span>{" "}
            vs <span className="text-amber-400 font-medium">{formatDuration(metrics.cpu.elapsedMs)}</span>{" "}
            on CPU — a <span className="text-white font-bold">{metrics.speedup.toFixed(1)}x improvement</span>{" "}
            powered by NVIDIA cuVS on the Blackwell architecture.
          </div>
        </motion.div>
      )}
    </div>
  );
}
