// Vineyard Intelligence endpoints: /api/vineyard/*, /api/chat*, /api/search, /api/images/search, /api/sensors/*.
// Shapes follow demo/backend/app/routers/{vineyard,chat,search,images,sensors}.py.
// Values come from the kit's own staged fallbacks, as carried by enablement/mock/js/data-vineyard.js.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, "..", "data", "vineyard-config.json"), "utf8"));
export const LLM_NAME = "Nemotron 3.5 Lightning";

export function makeVineyard(M, { sleep, pace }) {
  const V = M.data.vineyard;
  const blockCfg = (id) => CONFIG.blocks.find((b) => b.id === id);

  const alertType = (msg) => {
    const m = msg.toLowerCase();
    if (m.includes("potassium")) return "nutrient";
    if (m.includes("high moisture") || m.includes("drainage")) return "saturation";
    if (m.includes("mildew") || m.includes("disease")) return "disease";
    return "drought";
  };
  const isoAgo = (min) => new Date(Date.now() - min * 60000).toISOString();

  function blockSummary(id) {
    const s = V.summaries[id];
    const b = blockCfg(id);
    if (!s) {
      // Same shape the router returns for an unknown block with no ES hits.
      return { block_id: id, block_name: id, variety: "Unknown", health: "healthy", alerts: [],
        soil: { moisture_pct: null, temp_6in_c: null, temp_12in_c: null, ec: null, timestamp: null },
        npk: { nitrogen: null, phosphorus: null, potassium: null, ph: null, timestamp: null },
        latest_harvest: { vintage_year: null, grape_mass_kg: null, sugar_brix: null, quality_score: null } };
    }
    return {
      block_id: id,
      block_name: b ? b.name : id,
      variety: b ? b.variety : "Unknown",
      health: s.health,
      alerts: s.alerts.map((message) => ({ type: alertType(message), message })),
      soil: { moisture_pct: s.soil.m, temp_6in_c: s.soil.t6, temp_12in_c: s.soil.t12, ec: s.soil.ec, timestamp: isoAgo(7) },
      npk: { nitrogen: s.npk.n, phosphorus: s.npk.p, potassium: s.npk.k, ph: s.npk.ph, timestamp: isoAgo(42) },
      latest_harvest: { vintage_year: s.harvest.year, grape_mass_kg: s.harvest.kg, sugar_brix: s.harvest.brix, quality_score: s.harvest.q },
    };
  }

  function dashboard() {
    const ids = CONFIG.blocks.map((b) => b.id);
    const block_summaries = ids.map((id) => {
      const s = V.summaries[id].soil;
      return { block_id: id, moisture: s.m, temp: s.t6, ec: s.ec };
    });
    const avg = (k) => Math.round((block_summaries.reduce((a, s) => a + s[k], 0) / block_summaries.length) * 10) / 10;
    const counts = { ...V.estate.indexCounts };
    return {
      vineyard: CONFIG.name,
      total_docs: Object.values(counts).reduce((a, b) => a + b, 0),
      index_counts: counts,
      avg_moisture: avg("moisture"),
      avg_temp: avg("temp"),
      block_summaries,
      blocks_total: ids.length,
    };
  }

  // ── /api/chat/agent/stream (SSE, routers/chat.py) ────────────────────────────
  const BLOCK_HINTS = [
    ["BLK-A", /block a\b|les pierres|blk-a/], ["BLK-B", /block b\b|clos du vent|blk-b/],
    ["BLK-C", /block c\b|la rivi|blk-c/], ["BLK-D", /block d\b|le jardin|blk-d/],
    ["BLK-E", /block e\b|vieilles|blk-e/], ["BLK-F", /block f\b|le plateau|blk-f/],
  ];
  function inferBlock(message, blockId) {
    if (blockId && V.summaries[blockId]) return blockId;
    const q = (message || "").toLowerCase();
    for (const [id, re] of BLOCK_HINTS) if (re.test(q)) return id;
    return V.latestBlock; // kit: latest doc across all blocks (FACTS F8); mock fixes it to BLK-F
  }
  const VARIETY_NOTES = {
    "Cabernet Sauvignon": "Cabernet Sauvignon tolerates mild water stress after veraison; hold moisture near 30% to keep berries small and tannins ripe.",
    Syrah: "Syrah concentrates well under controlled deficit; avoid stress before fruit set, which cuts yield without a quality gain.",
    Merlot: "Merlot is sensitive to waterlogging and potassium shortfall; both show as uneven ripening and lower brix at harvest.",
    Chardonnay: "Chardonnay's tight clusters hold humidity; canopy airflow is the main lever against powdery mildew.",
    "Cabernet Franc": "Cabernet Franc on old roots draws from deep volcanic soil; keep inputs minimal and use the block as the reference profile.",
    Riesling: "Riesling on limestone keeps acidity in cool nights; irrigate lightly and watch potassium, which limestone holds poorly.",
  };

  async function agentStream(body, send, isClosed) {
    const message = String(body.message || "");
    const block = inferBlock(message, body.block_id);
    const key = V.pickResponse(message, block);
    const R = V.responses[key];
    const s = V.summaries[block];
    const variety = blockCfg(block)?.variety || "Cabernet Sauvignon";
    const P = V.pipelineTiming; // kit-pace seconds per phase
    const step = async (sec) => { if (!isClosed()) await sleep(sec * 1000 * pace()); };
    const ev = (event, data) => { if (!isClosed()) send(event, data); };

    ev("job_start", { job_id: `agent-${Math.floor(Date.now() / 1000)}` });

    // Phase 0
    ev("phase_start", { phase_id: "sensors", progress_pct: 5 });
    ev("phase_progress", { phase_id: "sensors", message: "Querying soil + NPK indices..." });
    await step(P.sensors);
    const health = s.soil.m < 25 || s.npk.k < 100 ? "alert" : s.soil.m > 45 ? "watch" : "healthy";
    ev("phase_progress", { phase_id: "sensors", message: `Block ${block}: moisture ${s.soil.m}%, K:${s.npk.k} mg/kg` });
    ev("phase_complete", { phase_id: "sensors", progress_pct: 20, data: {
      block_id: block, moisture: s.soil.m, temperature: s.soil.t6, nitrogen: s.npk.n, phosphorus: s.npk.p,
      potassium: s.npk.k, ph: s.npk.ph, health } });

    // Phase 1
    ev("phase_start", { phase_id: "historical", progress_pct: 20 });
    ev("phase_progress", { phase_id: "historical", message: "kNN vector search against 841K soil records..." });
    await step(P.historical * 0.35);
    ev("phase_progress", { phase_id: "historical", message: `Analyzing historical patterns with ${LLM_NAME}...` });
    await step(P.historical * 0.65);
    ev("phase_progress", { phase_id: "historical", message: `Found ${R.matches.length} similar conditions across 8 years` });
    ev("phase_complete", { phase_id: "historical", progress_pct: 40, data: {
      pattern_summary: R.pattern.slice(0, 500), matches: R.matches.slice(0, 5), years_of_data: 8 } });

    // Phases 2-4: started together, completed in sequence with 3 s heartbeats (as the kit does)
    for (const id of ["risk", "recommendation", "action_plan"]) ev("phase_start", { phase_id: id, progress_pct: 40 });
    ev("phase_progress", { phase_id: "risk", message: `Running risk, recommendation, and action plan in parallel via ${LLM_NAME}...` });
    const heartbeat = async (phase, total, msgs) => {
      let t = 0, i = 0;
      while (t < total && !isClosed()) {
        const d = Math.min(3, total - t);
        await step(d); t += d;
        if (t < total && i < msgs.length) ev("phase_progress", { phase_id: phase, message: msgs[i++] });
      }
    };
    await heartbeat("risk", P.risk, [
      "Evaluating disease pressure from 17K imagery records...",
      "Analyzing moisture stress against historical thresholds...",
      "Checking nutrient deficiency indicators...",
    ]);
    ev("phase_complete", { phase_id: "risk", progress_pct: 60, data: {
      overall_risk: R.overall,
      risks: R.risks.slice(0, 5).map((r) => ({ severity: r.severity, description: r.description, category: r.category || "general" })),
      summary: `Overall risk ${R.overall}. ${R.risks[0].description}` } });

    ev("phase_progress", { phase_id: "recommendation", message: `Generating ${variety}-specific management recommendations...` });
    await heartbeat("recommendation", P.recommendation, [
      "Consulting harvest quality trends for this block...",
      "Prioritizing actions by urgency...",
    ]);
    ev("phase_complete", { phase_id: "recommendation", progress_pct: 80, data: {
      recommendations: R.recs.slice(0, 5).map((r) => ({ action: r.action, priority: r.priority, rationale: r.rationale })),
      variety_notes: VARIETY_NOTES[variety] || "",
      summary: R.recs[0].action } });

    ev("phase_progress", { phase_id: "action_plan", message: "Building concrete task assignments and timeline..." });
    await heartbeat("action_plan", P.action_plan, Array(10).fill("Finalizing action plan..."));
    ev("phase_complete", { phase_id: "action_plan", progress_pct: 100, data: {
      actions: R.actions.slice(0, 6).map((a) => ({ task: a.task, assignee: a.assignee, deadline: a.deadline, equipment: a.equipment || "" })),
      estimated_cost: R.cost, summary: R.summary } });
    ev("job_complete", { results: { action_plan: { summary: R.summary }, model: LLM_NAME, phases_completed: 5 } });
  }

  // ── /api/search (routers/search.py) ──────────────────────────────────────────
  // The kit returns its two canned "Block B3 / B7" results whenever ES errors (FACTS F4, C9).
  // The stub answers from the estate instead, so the screen shows data that matches the rest of the demo.
  function search(body) {
    const t0 = Date.now();
    const q = String(body.query || "").toLowerCase();
    const mode = body.mode || "hybrid";
    const terms = q.split(/[^a-z0-9.-]+/).filter((w) => w.length > 2);
    const docs = [];
    for (const b of CONFIG.blocks) {
      const s = V.summaries[b.id];
      docs.push({ id: `soil-${b.id}`, index: "vineyard-soil", source: "sensor",
        title: `${b.name} (${b.id}) · soil station ${b.id.slice(-1)}-01`,
        snippet: `${b.variety}, ${b.soil_type}. Moisture ${s.soil.m}%, soil temp ${s.soil.t6}°C at 6in, EC ${s.soil.ec} dS/m. ${s.alerts.join(". ")}`.trim() });
      docs.push({ id: `npk-${b.id}`, index: "vineyard-npk", source: "sensor",
        title: `${b.name} (${b.id}) · NPK profile`,
        snippet: `Nitrogen ${s.npk.n} mg/kg, phosphorus ${s.npk.p} mg/kg, potassium ${s.npk.k} mg/kg, pH ${s.npk.ph}. ${b.story}` });
      docs.push({ id: `harvest-${b.id}`, index: "vineyard-harvest", source: "historical",
        title: `${b.name} (${b.id}) · vintage ${s.harvest.year}`,
        snippet: `${b.variety}: ${s.harvest.kg.toLocaleString("en-US")} kg, brix ${s.harvest.brix}, quality ${s.harvest.q}/10.` });
    }
    for (const r of Object.values(V.responses)) for (const m of r.matches) {
      if (!docs.some((d) => d.title === m.title)) docs.push({ id: `hist-${docs.length}`, index: "vineyard-soil", source: "historical", title: m.title, snippet: r.pattern });
    }
    const scored = docs.map((d) => {
      const hay = (d.title + " " + d.snippet).toLowerCase();
      let sc = 0;
      for (const t of terms) if (hay.includes(t)) sc += 1;
      return { ...d, raw: sc };
    }).filter((d) => d.raw > 0 || terms.length === 0).sort((a, b) => b.raw - a.raw).slice(0, 10);
    const top = scored.length ? scored[0].raw : 1;
    const base = mode === "bm25" ? 7.2 : mode === "semantic" ? 0.95 : 0.033;
    const results = (scored.length ? scored : docs.slice(0, 4).map((d) => ({ ...d, raw: 0.5 }))).map((d, i) => ({
      id: d.id, title: d.title, snippet: d.snippet.slice(0, 200), source: d.source, index: d.index,
      score: Math.round(base * (d.raw / top) * (1 - i * 0.03) * 1000) / 1000,
    }));
    const embed = mode === "bm25" ? 0 : 12;
    const searchMs = (mode === "hybrid" ? 31 : mode === "semantic" ? 24 : 9) + (Date.now() - t0);
    return { results, latency: { embed, search: searchMs, total: embed + searchMs + 4 } };
  }

  // ── /api/chat (routers/chat.py, simple RAG; not on any in-scope screen) ──────
  function chat(body) {
    const R = V.responses[V.pickResponse(String(body.message || ""), null)];
    return { response: R.summary, sources: R.matches.map((m) => ({ title: m.title, score: m.similarity })), latency: { total: 2140 } };
  }

  // ── /api/images/search (routers/images.py returns this fixed result on the kit too) ──
  const leaf = () => ({
    classification: V.leaf.classification, confidence: V.leaf.confidence, similarCount: V.leaf.similarCount,
    affectedBlocks: V.leaf.affectedBlocks, recommendation: V.leaf.recommendation,
    similarImages: V.leaf.similar.map((score, i) => ({ path: `/images/disease/blackrot_00${i + 1}.jpg`, score })),
  });

  // ── /api/sensors (routers/sensors.py drift model) ────────────────────────────
  const reading = { moisture: 34.2, temp6: 18.4, temp12: 16.1, temp24: 14.8, ec: 0.42, nitrogen: 42.0, phosphorus: 28.0, potassium: 186.0, ph: 6.2, timestamp: Date.now() / 1000 };
  function sensorLatest() {
    const j = (k, a) => { reading[k] += (Math.random() - 0.5) * a; };
    j("moisture", 0.3); j("temp6", 0.1); j("temp12", 0.05); j("temp24", 0.03); j("ec", 0.01);
    j("nitrogen", 0.5); j("phosphorus", 0.3); j("potassium", 1.0); j("ph", 0.02);
    reading.timestamp = Date.now() / 1000;
    return { ...reading };
  }

  return { config: () => CONFIG, blockSummary, dashboard, agentStream, search, chat, leaf, sensorLatest };
}
