import { motion } from "framer-motion";
import { Zap, Database, Cpu, ArrowRight, Gauge } from "lucide-react";

interface Props {
  adventure: "vineyard" | "sec";
  onContinue: () => void;
}

const ADVENTURE_CONTEXT = {
  vineyard: {
    title: "Ingesting Vineyard Data",
    subtitle: "Domaine de la Côte Cachée",
    description:
      "Before we can analyze your vineyard, we need to index 869,000 sensor records, nutrient profiles, harvest data, and disease imagery into Elasticsearch.",
    datasets: [
      { name: "Soil Sensor Readings", count: "841,536", dims: "8-dim vectors", icon: "💧" },
      { name: "Disease Imagery", count: "17K", dims: "2048-dim embeddings", icon: "🍂" },
      { name: "NPK Nutrient Profiles", count: "10K", dims: "7-dim vectors", icon: "🧪" },
      { name: "Harvest & Wine Quality", count: "281", dims: "structured", icon: "🍇" },
    ],
  },
  sec: {
    title: "Ingesting SEC Filings",
    subtitle: "EDGAR Dataset",
    description:
      "Before we can analyze regulatory filings, we need to index thousands of 10-K, 10-Q, and 8-K documents with semantic embeddings into Elasticsearch.",
    datasets: [
      { name: "10-K Annual Reports", count: "TBD", dims: "semantic embeddings", icon: "📄" },
      { name: "10-Q Quarterly Reports", count: "TBD", dims: "semantic embeddings", icon: "📋" },
      { name: "8-K Current Events", count: "TBD", dims: "semantic embeddings", icon: "📰" },
      { name: "Company Metadata", count: "TBD", dims: "structured", icon: "🏢" },
    ],
  },
};

export function RaceIntro({ adventure, onContinue }: Props) {
  const ctx = ADVENTURE_CONTEXT[adventure];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl w-full relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 text-xs text-slate-400 mb-4">
            <Database size={12} />
            {ctx.subtitle}
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">{ctx.title}</h1>
          <p className="text-slate-400 max-w-lg mx-auto">{ctx.description}</p>
        </div>

        {/* Dataset cards */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          {ctx.datasets.map((ds, i) => (
            <motion.div
              key={ds.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="text-2xl">{ds.icon}</div>
              <div>
                <div className="text-sm font-medium text-slate-200">{ds.name}</div>
                <div className="text-xs text-slate-500">
                  {ds.count} records &middot; {ds.dims}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* GPU acceleration callout */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-emerald-500/10 via-slate-900/60 to-amber-500/10 border border-emerald-500/20 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-start gap-6">
            {/* GPU side */}
            <div className="flex-1 text-center">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                <Zap size={28} className="text-emerald-400" />
              </div>
              <div className="text-lg font-bold text-emerald-400">NVIDIA cuVS</div>
              <div className="text-xs text-slate-500 mt-1">GPU-Accelerated HNSW</div>
              <div className="text-3xl font-mono font-bold text-white mt-2">~28,500</div>
              <div className="text-xs text-slate-400">vectors/second</div>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center justify-center py-4">
              <div className="text-xs text-slate-600 mb-2">vs</div>
              <div className="w-px h-12 bg-slate-800" />
              <div className="mt-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold">
                12x faster
              </div>
            </div>

            {/* CPU side */}
            <div className="flex-1 text-center">
              <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <Cpu size={28} className="text-slate-400" />
              </div>
              <div className="text-lg font-bold text-slate-400">Standard CPU</div>
              <div className="text-xs text-slate-500 mt-1">Traditional HNSW</div>
              <div className="text-3xl font-mono font-bold text-white mt-2">~2,400</div>
              <div className="text-xs text-slate-400">vectors/second</div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/50 text-center">
            <p className="text-sm text-slate-400">
              The NVIDIA DGX Spark's <span className="text-white font-medium">Blackwell GPU</span> accelerates
              vector index construction using <span className="text-emerald-400 font-medium">cuVS</span> — building
              HNSW graphs up to <span className="text-emerald-400 font-medium">12x faster</span> with identical
              recall quality. Same data, same search results, dramatically faster time-to-insight.
            </p>
          </div>
        </motion.div>

        {/* Hardware */}
        <div className="flex items-center justify-center gap-8 text-xs text-slate-600 mb-8">
          <div className="flex items-center gap-2">
            <Gauge size={14} />
            <span>DGX Spark &middot; GB10 Blackwell &middot; 1 PFLOP</span>
          </div>
          <span>&middot;</span>
          <div>Framework Desktop &middot; Ryzen AI Max+ 395</div>
          <span>&middot;</span>
          <div>Elasticsearch 9.3.1</div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <button
            onClick={onContinue}
            className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors text-lg"
          >
            Start the Race
            <ArrowRight size={20} />
          </button>
          <div className="text-xs text-slate-600 mt-3">
            Watch GPU vs CPU index the same vectors side-by-side
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
