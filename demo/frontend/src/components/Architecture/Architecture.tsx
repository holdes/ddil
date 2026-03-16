import { motion } from "framer-motion";
import {
  Server,
  Cpu,
  Zap,
  Database,
  Brain,
  Network,
  HardDrive,
  Monitor,
  Wifi,
  ArrowRight,
  ArrowDown,
  ArrowLeftRight,
} from "lucide-react";

interface Props {
  onContinue: () => void;
}

function NodeCard({
  title,
  subtitle,
  specs,
  services,
  color,
  icon,
  delay,
}: {
  title: string;
  subtitle: string;
  specs: string[];
  services: { name: string; detail: string; color: string }[];
  color: string;
  icon: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-slate-900/70 border rounded-2xl p-6 flex-1 border-${color}-500/30`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-xl bg-${color}-500/15 flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>

      <div className="space-y-1 mb-4">
        {specs.map((s, i) => (
          <div key={i} className="text-xs text-slate-400 flex items-center gap-2">
            <div className={`w-1 h-1 rounded-full bg-${color}-500`} />
            {s}
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800 pt-3 space-y-2">
        {services.map((svc, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${svc.color} animate-pulse`} />
              <span className="text-slate-300 font-medium">{svc.name}</span>
            </div>
            <span className="text-slate-500">{svc.detail}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function Architecture({ onContinue }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-emerald-500/3 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-blue-500/3 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 relative z-10"
      >
        <div className="text-xs font-mono text-slate-500 tracking-widest uppercase mb-2">
          DDIL Demo Kit
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">System Architecture</h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Two compute nodes in a Pelican case — fully airgapped, GPU-accelerated AI search and inference.
        </p>
      </motion.div>

      <div className="max-w-5xl w-full relative z-10">
        {/* Two nodes side by side */}
        <div className="flex gap-6 mb-6">
          <NodeCard
            title="NVIDIA DGX Spark"
            subtitle="192.168.1.20 — AI/ML Powerhouse"
            color="emerald"
            icon={<Zap size={24} className="text-emerald-400" />}
            delay={0.1}
            specs={[
              "Grace Blackwell GB10 — 1 PFLOP AI",
              "128 GB Unified Memory",
              "aarch64 Architecture",
              "NVIDIA cuVS Library (HNSW acceleration)",
            ]}
            services={[
              { name: "Elasticsearch (GPU)", detail: "9.3.1 + cuVS JAR", color: "bg-emerald-500" },
              { name: "Ollama — GPT-OSS 120B", detail: "65 GB MXFP4", color: "bg-emerald-500" },
              { name: "Ollama — Jina v4", detail: "4.6 GB Embeddings", color: "bg-emerald-500" },
              { name: "Inference Endpoint", detail: "ES → Ollama", color: "bg-emerald-500" },
            ]}
          />

          <NodeCard
            title="Framework Desktop"
            subtitle="192.168.1.10 — Presentation Layer"
            color="blue"
            icon={<Monitor size={24} className="text-blue-400" />}
            delay={0.2}
            specs={[
              "Ryzen AI Max+ 395 — 64 GB RAM",
              "x86_64 Architecture",
              "Demo App Frontend + Backend",
              "CPU HNSW (race comparison node)",
            ]}
            services={[
              { name: "Elasticsearch (CPU)", detail: "9.3.1 stock", color: "bg-blue-500" },
              { name: "Kibana", detail: "Agent Builder + Workflows", color: "bg-blue-500" },
              { name: "React Frontend", detail: "Vite + Tailwind", color: "bg-blue-500" },
              { name: "FastAPI Backend", detail: "Python 3.12", color: "bg-blue-500" },
            ]}
          />
        </div>

        {/* Network bar */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wifi size={16} className="text-amber-400" />
              <div>
                <div className="text-sm font-medium text-white">UniFi Express 7</div>
                <div className="text-xs text-slate-500">Gateway + Wi-Fi 7 AP &middot; 192.168.1.1</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Network size={14} />
                Switch Flex Mini &middot; 5-port GbE
              </div>
              <div className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                1 Gbps Cat6a
              </div>
              <div className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 font-mono">
                &lt; 1.2ms latency
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-500">Airgapped</span>
            </div>
          </div>
        </motion.div>

        {/* Data flow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 mb-6"
        >
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Elastic AI Stack — Data Flow</h3>
          <div className="flex items-center justify-between text-xs">
            <div className="flex-1 text-center">
              <div className="bg-slate-800 rounded-lg p-3 mb-2">
                <div className="text-slate-300 font-medium">User Query</div>
                <div className="text-slate-500">"Why is Block C failing?"</div>
              </div>
            </div>

            <ArrowRight size={16} className="text-slate-600 mx-2 shrink-0" />

            <div className="flex-1 text-center">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-2">
                <div className="text-blue-400 font-medium">Agent Builder</div>
                <div className="text-slate-500">Tool selection + orchestration</div>
              </div>
            </div>

            <ArrowRight size={16} className="text-slate-600 mx-2 shrink-0" />

            <div className="flex-1 text-center">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-2">
                <div className="text-purple-400 font-medium">ES|QL + kNN</div>
                <div className="text-slate-500">841K vectors searched</div>
              </div>
            </div>

            <ArrowRight size={16} className="text-slate-600 mx-2 shrink-0" />

            <div className="flex-1 text-center">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-2">
                <div className="text-emerald-400 font-medium">GPT-OSS 120B</div>
                <div className="text-slate-500">On-device inference</div>
              </div>
            </div>

            <ArrowRight size={16} className="text-slate-600 mx-2 shrink-0" />

            <div className="flex-1 text-center">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-2">
                <div className="text-amber-400 font-medium">Actionable Insights</div>
                <div className="text-slate-500">Risk + Recommendations</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Key stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-5 gap-3 mb-8"
        >
          {[
            { value: "869K", label: "Documents Indexed", icon: <Database size={14} /> },
            { value: "2 nodes", label: "Mixed Arch Cluster", icon: <Server size={14} /> },
            { value: "120B", label: "Parameter LLM", icon: <Brain size={14} /> },
            { value: "12x", label: "GPU Index Speedup", icon: <Zap size={14} /> },
            { value: "<50 lbs", label: "Pelican Air 1615", icon: <HardDrive size={14} /> },
          ].map((stat, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-center">
              <div className="flex justify-center mb-1 text-slate-500">{stat.icon}</div>
              <div className="text-xl font-mono font-bold text-white">{stat.value}</div>
              <div className="text-[10px] text-slate-500">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center"
        >
          <button
            onClick={onContinue}
            className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
          >
            Continue
            <ArrowRight size={18} />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
