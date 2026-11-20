import { useState } from "react";
import { Search, Clock } from "lucide-react";

type RetrievalMode = "bm25" | "semantic" | "hybrid";

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
  index: string;
}

export function SearchPlayground() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<RetrievalMode>("hybrid");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<{
    embed: number;
    search: number;
    total: number;
  } | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
      setLatency(data.latency ?? null);
    } catch {
      // Mock results for development
      setResults([
        {
          id: "1",
          title: "Block B3 — Soil Station #17",
          snippet:
            "Moisture: 31% (down 12% from 30-day avg), EC rising. Similar to Cook Farm Station 22, Aug 2012 (pre-drought pattern).",
          score: 0.943,
          source: "historical",
          index: "vineyard-soil",
        },
        {
          id: "2",
          title: "Block B7 — Soil Station #31",
          snippet:
            "Moisture: 28%, Temperature anomaly at 24\" depth. Trending toward drought threshold.",
          score: 0.891,
          source: "historical",
          index: "vineyard-soil",
        },
        {
          id: "3",
          title: "Regional Context — Virginia Wine Region",
          snippet:
            "20-year SoMo.ml soil moisture trend shows drying pattern across VA wine region, consistent with current readings.",
          score: 0.847,
          source: "historical",
          index: "vineyard-soil",
        },
      ]);
      setLatency({ embed: 12, search: 28, total: 47 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400 mb-2">
        <span className="w-2 h-2 bg-emerald-500" />
        Hybrid retrieval &middot; BM25 + kNN + RRF &middot; 615K+ vectors
      </div>
      <h2 className="text-[30px] leading-none font-bold tracking-[-0.02em] text-slate-50 mb-6">Search Playground</h2>

      {/* Search Input */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="blocks showing drought stress similar to 2012 conditions"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Retrieval Mode Toggle */}
      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-lg w-fit">
        {(["bm25", "semantic", "hybrid"] as RetrievalMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              mode === m
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {m === "bm25" ? "BM25" : m === "semantic" ? "Semantic" : "Hybrid (RRF)"}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {results.map((r, i) => (
          <div
            key={r.id}
            className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono">
                  {i + 1}.
                </span>
                <h3 className="text-sm font-semibold text-slate-200">
                  {r.title}
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400">
                {r.score.toFixed(3)}
              </span>
            </div>
            <p className="text-sm text-slate-400 ml-5">{r.snippet}</p>
            <div className="flex gap-2 ml-5 mt-2">
              <span className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">
                {r.index}
              </span>
              <span className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">
                {r.source}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Latency */}
      {latency && (
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <Clock size={12} />
          <span>
            Total: {latency.total}ms (embed: {latency.embed}ms + search:{" "}
            {latency.search}ms)
          </span>
          <span>
            Retrieved: {results.length} of 615K+ docs &middot;{" "}
            {mode === "hybrid"
              ? "Hybrid RRF (BM25 + kNN)"
              : mode === "semantic"
              ? "kNN Vector Search"
              : "BM25 Keyword"}
          </span>
        </div>
      )}

      {/* Semantic + multimodal search lives in Jina — expand the story here */}
      <div className="mt-8 border border-slate-50 bg-slate-900 p-5 shadow-[7px_7px_0_0_rgba(29,30,36,0.07)]">
        <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400 mb-3">
          <span className="w-2 h-2 bg-violet-500" />
          Semantic + multimodal search &middot; Jina in Elastic
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4 max-w-3xl">
          Vineyard records are structured sensor data, so this playground is{" "}
          <span className="text-slate-50 font-semibold">lexical</span>. For
          meaning-based and <span className="text-slate-50 font-semibold">cross-modal</span>{" "}
          search, the kit runs{" "}
          <span className="font-mono text-violet-500">Jina Embeddings v5 Omni</span> on the DGX
          Spark — text and images share <span className="text-slate-50 font-semibold">one vector
          space</span>, embedded by Elasticsearch&rsquo;s own inference endpoint.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["One vector space", "Text and images embed into the same space — type words, retrieve pictures, no CLIP glue."],
            ["Native ES inference", "query_vector_builder embeds the query through the on-box Jina endpoint — nothing embedded app-side."],
            ["Hybrid + DLS", "BM25 + kNN fused with RRF, plus document-level security scoping every result to the analyst's clearance."],
          ].map(([t, b]) => (
            <div key={t} className="border border-slate-700 bg-slate-900 p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-violet-500 mb-1.5">{t}</div>
              <div className="text-[12px] text-slate-400 leading-snug">{b}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 font-mono text-[11px] text-slate-400">
          &rarr; See the <span className="text-violet-500 font-semibold">Multimodal Intelligence</span> adventure for the live Jina demo.
        </div>
      </div>
    </div>
  );
}
