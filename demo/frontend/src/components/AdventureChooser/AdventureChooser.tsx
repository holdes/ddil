import { motion } from "framer-motion";
import { Grape, Landmark, ScanSearch, Network, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
// Front of the kit, the background-removed rendering from the setup guide
// (enablement/setup/img/front.webp, downscaled). Bundled by Vite, no network load.
import kitFront from "./kit-front.webp";

type Adventure = "vineyard" | "sec" | "jina" | "ccs";

interface Props {
  onChoose: (adventure: Adventure) => void;
}

interface Card {
  id: Adventure;
  index: string;
  kicker: string;
  title: string;
  icon: ReactNode;
  body: ReactNode;
  stats: [string, string][];
  // Literal class strings so Tailwind sees them at build time.
  square: string;
  iconText: string;
  hoverBorder: string;
  cta: string;
  shadow: string;
}

const CARDS: Card[] = [
  {
    id: "vineyard",
    index: "01",
    kicker: "Edge AI",
    title: "Vineyard Intelligence",
    icon: <Grape size={22} strokeWidth={1.75} />,
    body: (
      <>
        Run a six-block Walla Walla estate from a case in the field: soil and
        nutrient sensors, eight vintages of history, and an AI agronomist
        that checks the data before it answers.
      </>
    ),
    stats: [
      ["841,536", "soil sensor readings"],
      ["869K", "docs across 5 indices"],
      ["5 phases", "kNN + Nemotron 3.5 Lightning"],
    ],
    square: "bg-emerald-400",
    iconText: "text-emerald-400",
    hoverBorder: "hover:border-emerald-400/70",
    cta: "text-emerald-400",
    shadow: "shadow-[12px_12px_0_0_rgba(72,239,207,0.10)]",
  },
  {
    id: "sec",
    index: "02",
    kicker: "Agentic RAG",
    title: "SEC Findings",
    icon: <Landmark size={22} strokeWidth={1.75} />,
    body: (
      <>
        Work S&amp;P 500 10-K filings as an analyst: semantic search, then an
        Elastic Agent Builder agent that answers with ES|QL tools and cites
        its filings.
      </>
    ),
    stats: [
      ["10-K", "SEC EDGAR filings"],
      ["kNN", "search + sector filter"],
      ["Agent Builder", "10 tools"],
    ],
    square: "bg-blue-400",
    iconText: "text-blue-400",
    hoverBorder: "hover:border-blue-400/70",
    cta: "text-blue-400",
    shadow: "shadow-[12px_12px_0_0_rgba(91,155,255,0.12)]",
  },
  {
    id: "jina",
    index: "03",
    kicker: "Need to know",
    title: "Multimodal Intelligence",
    icon: <ScanSearch size={22} strokeWidth={1.75} />,
    body: (
      <>
        Search a marked research corpus by meaning across text and figures.
        Each of four analysts only retrieves what their clearance and
        compartments allow.
      </>
    ),
    stats: [
      ["Jina v5 Omni", "text + image, one space"],
      ["Hybrid", "BM25 + kNN with RRF"],
      ["4", "clearance personas"],
    ],
    square: "bg-violet-400",
    iconText: "text-violet-400",
    hoverBorder: "hover:border-violet-400/70",
    cta: "text-violet-400",
    shadow: "shadow-[12px_12px_0_0_rgba(145,137,250,0.12)]",
  },
  {
    id: "ccs",
    index: "04",
    kicker: "Federation",
    title: "Edge Federation",
    icon: <Network size={22} strokeWidth={1.75} />,
    body: (
      <>
        Collect and embed field reports on the airgapped box. When HQ runs{" "}
        <span className="text-cyan-300">Synchronise Now</span>, the box dials
        out to Elastic Cloud and one search spans edge and cloud.
      </>
    ),
    stats: [
      ["Box", "is the CCS coordinator"],
      ["Outbound", "only, no inbound"],
      ["Edge + cloud", "one query"],
    ],
    square: "bg-cyan-400",
    iconText: "text-cyan-400",
    hoverBorder: "hover:border-cyan-400/70",
    cta: "text-cyan-400",
    shadow: "shadow-[12px_12px_0_0_rgba(99,200,227,0.11)]",
  },
];

// The horizontal logo file has generous padding (600×300 box, mark spans
// roughly x 85-515, y 75-224). Crop it with a fixed window instead of editing
// the asset.
function ElasticLogo({ height = 26 }: { height?: number }) {
  const scale = height / 149;
  return (
    <div
      aria-label="Elastic"
      role="img"
      style={{ height, width: Math.round(430 * scale), overflow: "hidden", position: "relative" }}
    >
      <img
        src="/logo-elastic-horizontal-white.svg"
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          height: 300 * scale,
          width: 600 * scale,
          maxWidth: "none",
          left: -85 * scale,
          top: -75 * scale,
        }}
      />
    </div>
  );
}

export function AdventureChooser({ onChoose }: Props) {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Blueprint grid ground */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-slate-900) 1px, transparent 1px), linear-gradient(to bottom, var(--color-slate-900) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at 70% 20%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 70% 20%, black 0%, transparent 75%)",
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-10 pt-6">
        <ElasticLogo height={24} />
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] uppercase text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          DDIL demo kit · airgapped
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-[1240px] mx-auto px-10 flex flex-col justify-center py-4">
        {/* Hero */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2.5 font-mono text-[12px] font-medium tracking-[0.12em] uppercase text-slate-400 mb-4">
              <span className="w-2 h-2 bg-blue-400 shrink-0" />
              Sovereign AI · Context engineering anywhere
            </div>
            <h1 className="text-[46px] leading-[1.05] font-semibold tracking-[-0.03em] text-slate-50 mb-4">
              Choose your adventure.
              <br />
              <span className="text-blue-400">No cloud required.</span>
            </h1>
            <p className="text-[16px] leading-relaxed text-slate-300 max-w-[540px]">
              GPU-accelerated search and agentic RAG on two nodes in a case.
              Models, indices and agents run on the kit. The cloud is optional.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: [0, -6, 0] }}
            transition={{
              opacity: { duration: 0.8, delay: 0.15 },
              y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
            }}
            className="-my-6 mr-6 hidden lg:flex flex-col items-center select-none pointer-events-none"
          >
            <img
              src={kitFront}
              alt="Front of the DDIL kit"
              draggable={false}
              className="h-[224px] w-auto [filter:drop-shadow(0_0_1px_rgba(245,247,250,0.55))_drop-shadow(0_18px_28px_rgba(0,0,0,0.5))]"
            />
            <div className="mt-2.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-slate-500">
              The kit · front
            </div>
          </motion.div>
        </div>

        {/* Adventure cards */}
        <div className="grid grid-cols-4 gap-6 pr-3">
          {CARDS.map((c, i) => (
            <motion.button
              key={c.id}
              type="button"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 + i * 0.07 }}
              whileHover={{ x: -3, y: -3 }}
              whileTap={{ x: 0, y: 0 }}
              onClick={() => onChoose(c.id)}
              className={`group relative flex flex-col text-left bg-slate-900 border border-slate-700 ${c.hoverBorder} rounded-none p-5 ${c.shadow} transition-colors`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase text-slate-400">
                  <span className={`w-2 h-2 ${c.square}`} />
                  {c.index} · {c.kicker}
                </div>
                <span className={c.iconText}>{c.icon}</span>
              </div>

              <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-slate-50 mb-2">
                {c.title}
              </h2>
              <p className="text-[13px] leading-[1.55] text-slate-300 mb-4">
                {c.body}
              </p>

              <div className="mt-auto border-t border-slate-700 pt-3 space-y-1 font-mono text-[11px] leading-snug">
                {c.stats.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-slate-100 font-medium whitespace-nowrap">{k}</span>
                    <span className="text-slate-400">{v}</span>
                  </div>
                ))}
              </div>

              <div
                className={`mt-4 flex items-center gap-1.5 font-mono text-[12px] font-medium tracking-[0.1em] uppercase ${c.cta}`}
              >
                Start demo
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-1"
                />
              </div>
            </motion.button>
          ))}
        </div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="relative z-10 flex items-center justify-between px-10 pb-5 font-mono text-[11px] tracking-[0.12em] uppercase text-slate-500"
      >
        <span>
          Elasticsearch 9.5.6 + NVIDIA <span className="normal-case">cuVS</span> · Nemotron 3.5 Lightning + Jina v5 Omni on DGX Spark
        </span>
        <span>Airgapped by default</span>
      </motion.footer>
    </div>
  );
}
