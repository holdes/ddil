// SEC Findings endpoints: /api/finance/{sectors,search,agent/state,agent/chat}.
// Shapes follow demo/backend/app/routers/finance.py; the agent stream follows the Kibana Agent Builder
// SSE grammar parsed by components/sec/hooks/useAgentChat.ts.
// Seed: enablement/mock/js/data-sec.js (sector facet, hit lists, agent runs, tool names from provision-agent-local.sh).
// Passages are stand-in text written for the stub. They are not filing language; accession ids are acc-stub-*.
import { LLM_NAME } from "./vineyard.mjs";

export const EMBED_NAME = "jina-embeddings-v5-omni-small"; // Jina Embeddings v5 Omni
const LLM_TAG = "nemotron-3.5-lightning"; // Nemotron 3.5 Lightning via vLLM (finance-ollama-llm connector id kept)
const EMBED_DIMS = 768;

const TOPICS = [
  { key: "ai", words: ["ai", "artificial", "intelligence", "model", "governance", "generative", "machine", "learning"],
    text: (c) => `Item 1A. Risk Factors. ${c} describes its use of artificial intelligence and machine learning in products and internal operations, and states that evolving AI regulation in the United States and the European Union, model errors, and data-use restrictions could affect results, reputation and compliance costs.` },
  { key: "cre", words: ["commercial", "real", "estate", "cre", "office", "loan", "loans", "property"],
    text: (c) => `Item 7. Management's Discussion and Analysis. ${c} discusses its commercial real estate exposure, with attention to office properties, refinancing risk as loans mature at higher rates, and the allowance for credit losses held against the portfolio.` },
  { key: "supply", words: ["supply", "chain", "semiconductor", "semiconductors", "disruption", "foundry", "shortage", "components"],
    text: (c) => `Item 1A. Risk Factors. ${c} reports dependence on a limited number of suppliers and foundries, and states that supply-chain disruption, export controls and geopolitical events could delay shipments and raise component costs.` },
  { key: "climate", words: ["climate", "transition", "carbon", "emissions", "energy", "policy", "environmental"],
    text: (c) => `Item 1A. Risk Factors. ${c} identifies climate-related transition risks: carbon pricing and emissions regulation, shifting demand toward lower-carbon energy, and the effect of policy changes on long-lived assets and capital allocation.` },
  { key: "cyber", words: ["cybersecurity", "cyber", "incident", "response", "breach", "security", "ransomware"],
    text: (c) => `Item 1C. Cybersecurity. ${c} describes its incident response program, board and management oversight of cybersecurity risk, third-party assessments, and the potential impact of a material incident on operations and customer trust.` },
];
// Short row text for ES|QL tool results, so the results table stays readable.
const SECTIONS = ["Item 1A Risk Factors", "Item 7 MD&A", "Item 1 Business", "Item 7A Market Risk", "Item 1A (continued)"];
const PHRASES = { ai: "AI regulation, model error and data-use risk", cre: "office CRE loans, refinancing and credit-loss allowance",
  supply: "supplier concentration, export controls, component cost", climate: "carbon policy, demand shift, long-lived asset risk",
  cyber: "incident response program and board oversight" };
const topicPhrase = (tp) => PHRASES[tp.key] || "topic-matched passage";
const FALLBACK_TOPIC = (q) => ({ key: "other", words: [],
  text: (c) => `Item 1A. Risk Factors. ${c} discusses ${q.toLowerCase().replace(/[.?!]+$/, "")} among the factors that could affect its business, financial condition and results of operations.` });

export function makeSec(M, { sleep, pace }) {
  const S = M.data.sec;
  const accession = (t) => `acc-stub-${t}`;
  const cik = (t) => String([...t].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 9999991, 7)).padStart(10, "0");

  // Company pool from every mock hit list; sector from the list.
  const companies = new Map();
  Object.values(S.hitSets).forEach((set) => set.forEach(([t, n, s]) => companies.set(t, { ticker: t, company: n, sector: s })));
  const extra = [["AAPL", "Apple", "Information Technology"], ["CAT", "Caterpillar", "Industrials"], ["HON", "Honeywell", "Industrials"],
    ["GE", "GE Aerospace", "Industrials"], ["UPS", "United Parcel Service", "Industrials"], ["PG", "Procter & Gamble", "Consumer Staples"],
    ["KO", "Coca-Cola", "Consumer Staples"], ["AMZN", "Amazon", "Consumer Discretionary"], ["HD", "Home Depot", "Consumer Discretionary"],
    ["PLD", "Prologis", "Real Estate"], ["LIN", "Linde", "Materials"], ["JNJ", "Johnson & Johnson", "Health Care"], ["PFE", "Pfizer", "Health Care"],
    ["MDT", "Medtronic", "Health Care"], ["HCA", "HCA Healthcare", "Health Care"], ["T", "AT&T", "Communication Services"]];
  extra.forEach(([t, n, s]) => { if (!companies.has(t)) companies.set(t, { ticker: t, company: n, sector: s }); });

  function topicFor(q) {
    const words = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    let best = null, bestScore = 0;
    TOPICS.forEach((tp, i) => {
      const sc = words.filter((w) => tp.words.includes(w)).length;
      if (sc > bestScore) { bestScore = sc; best = i; }
    });
    return best == null ? { idx: null, topic: FALLBACK_TOPIC(q) } : { idx: best, topic: TOPICS[best] };
  }

  const sectors = () => S.sectors.map(([name, count]) => ({ name, count }));

  async function search(body) {
    const query = String(body.query || "");
    const size = Math.max(1, Math.min(50, Number(body.size) || 8));
    const secFilter = Array.isArray(body.sectors) && body.sectors.length ? body.sectors : null;
    await sleep((60 + Math.random() * 60) * pace()); // query embed on the kit
    const { idx, topic } = topicFor(query);
    let pool = idx != null && S.hitSets[idx] ? S.hitSets[idx].map(([t]) => companies.get(t)) : [];
    const rest = [...companies.values()].filter((c) => !pool.includes(c));
    pool = pool.concat(rest);
    if (secFilter) pool = pool.filter((c) => secFilter.includes(c.sector));
    const hits = pool.slice(0, size).map((c, i) => {
      const chunk = 40 + ((c.ticker.charCodeAt(0) * 7 + i * 13) % 160);
      const text = topic.text(c.company) + " (Stand-in passage from the dev stub, not filing text.)";
      const base = idx != null ? S.hitScores[i] ?? 0.83 - i * 0.006 : 0.78 - i * 0.008;
      return { id: `${accession(c.ticker)}_${chunk}`, score: Math.round(base * 1000) / 1000, ticker: c.ticker, company: c.company,
        sector: c.sector, cik: cik(c.ticker), accession: accession(c.ticker),
        source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=${c.ticker}&type=10-K`,
        chunk_idx: chunk, text, snippet: text.slice(0, 480) + (text.length > 480 ? "…" : "") };
    });
    const knn = { field: "emb", query_vector: `<${EMBED_DIMS}-d embedding from ${EMBED_NAME}>`, k: size, num_candidates: Math.max(size * 10, 50) };
    if (secFilter) knn.filter = { terms: { sector: secFilter } };
    return {
      took_ms: 6 + Math.floor(Math.random() * 9),
      total: hits.length,
      hits,
      request: { method: "POST", path: `/${S.corpus.index}/_search`, body: {
        knn, _source: ["ticker", "company", "sector", "cik", "accession", "source_url", "chunk_idx", "text"], size } },
      embed_model: EMBED_NAME,
      embed_dims: EMBED_DIMS,
    };
  }

  const state = () => ({
    kibana_url: "http://kibana.ddil:5601", es_url: "http://es.ddil:9200", space: "default",
    agent_id: "finance-analyst", connector_id: "finance-ollama-llm",
    llm_model: LLM_TAG, embed_model: EMBED_NAME, embed_backend: "jina",
    sec_index: S.corpus.index, es_inference: null,
  });

  // ── Agent Builder run ────────────────────────────────────────────────────────
  const ESQL = {
    "finance.company_disclosures": (p) => `FROM sec_10k_2026 METADATA _score | WHERE ticker == "${p.ticker}" AND MATCH(text, "${p.topic}") | SORT _score DESC | KEEP ticker, company, sector, accession, chunk_idx, text, _score | LIMIT ${p.top_n || 3}`,
    "finance.compare_companies": (p) => `FROM sec_10k_2026 METADATA _score | WHERE ticker IN ("${p.t1 || ""}", "${p.t2 || ""}", "${p.t3 || ""}", "${p.t4 || ""}", "${p.t5 || ""}", "${p.t6 || ""}") AND MATCH(text, "${p.topic}") | SORT ticker ASC, _score DESC | KEEP ticker, company, sector, accession, chunk_idx, text, _score | LIMIT 60`,
    "finance.sector_breakdown": (p) => `FROM sec_10k_2026 | WHERE MATCH(text, "${p.topic}") | STATS filings = COUNT_DISTINCT(accession) BY sector | SORT filings DESC`,
  };

  function toolResults(tool, params, rows) {
    if (tool === "platform.core.search") {
      const { idx, topic } = topicFor(String(params.query || ""));
      let pool = idx != null ? S.hitSets[idx].map(([t]) => companies.get(t)) : [...companies.values()];
      const m = /sector:\s*(.+)$/.exec(String(params.filter || ""));
      if (m) {
        const sec = m[1].trim();
        pool = pool.filter((c) => c.sector === sec).concat([...companies.values()].filter((c) => c.sector === sec));
      }
      pool = [...new Set(pool)].slice(0, rows);
      return [{ type: "resource_list", tool_result_id: rid(), data: { resources: pool.map((c) => ({
        reference: { index: "sec_10k_2026", id: `${accession(c.ticker)}_${60 + c.ticker.length * 9}` },
        content: { snippets: [topic.text(c.company)] }, partial: true })) } }];
    }
    const esql = ESQL[tool](params);
    if (tool === "finance.sector_breakdown") {
      const total = S.sectors.reduce((a, s) => a + s[1], 0);
      const share = 0.55 + (String(params.topic).length % 5) * 0.06;
      const values = S.sectors.map(([name, n]) => [Math.round(n * share * (name === "Industrials" ? 1.15 : 1)), name])
        .sort((a, b) => b[0] - a[0]).slice(0, rows);
      return [{ type: "query", data: { esql } },
        { type: "esql_results", tool_result_id: rid(), data: { query: esql, total, columns: [{ name: "filings", type: "long" }, { name: "sector", type: "keyword" }], values } }];
    }
    const tickers = tool === "finance.company_disclosures" ? [params.ticker] : ["t1", "t2", "t3", "t4", "t5", "t6"].map((k) => params[k]).filter(Boolean);
    const topic = topicFor(String(params.topic || "")).topic;
    const values = [];
    const per = Math.max(1, Math.ceil(rows / tickers.length));
    tickers.slice().sort().forEach((t) => {
      const c = companies.get(t) || { ticker: t, company: t, sector: "" };
      for (let i = 0; i < per && values.length < rows; i++) {
        const sect = SECTIONS[i % SECTIONS.length];
        values.push([t, c.company, c.sector, accession(t), 50 + i * 11, `${sect}: ${topicPhrase(topic)} (stand-in)`, Math.round((9.8 - i * 0.6) * 100) / 100]);
      }
    });
    return [{ type: "query", data: { esql } },
      { type: "esql_results", tool_result_id: rid(), data: { query: esql, columns: ["ticker", "company", "sector", "accession", "chunk_idx", "text", "_score"].map((name) => ({ name, type: name === "_score" ? "double" : name === "chunk_idx" ? "integer" : "keyword" })), values } }];
  }
  let ridN = 0;
  const rid = () => `res-${Date.now().toString(36)}-${(ridN++).toString(36)}`;

  const FIXED_ANSWER_TICKERS = { "acc-mock-42": "MDT", "acc-mock-43": "HCA" };
  function rewriteAnswer(a) {
    return a.replace(/\[(\w+) · (acc-mock-\d+)\]/g, (_, t, acc) => {
      const tk = t === "mock" ? FIXED_ANSWER_TICKERS[acc] || "JNJ" : t;
      return `[${tk} · ${accession(tk)}]`;
    });
  }

  function pickRun(input) {
    const q = input.trim().toLowerCase();
    const i = S.exampleAgent.findIndex((e) => e.toLowerCase().slice(0, 40) === q.slice(0, 40));
    if (i >= 0) return S.agentRuns[i];
    const { idx } = topicFor(input);
    const map = { ai: 0, cre: 1, climate: 2, supply: 3 };
    const key = idx != null ? TOPICS[idx].key : null;
    if (key && map[key] != null) return S.agentRuns[map[key]];
    // Generic run: one search, then an answer built from the hits.
    const hitsTop = (idx != null ? S.hitSets[idx] : S.hitSets[0]).slice(0, 3);
    return { tools: [{ reason: "Open question with no named ticker or sector count. Starting with a broad search over the 10-K corpus.",
      tool: "platform.core.search", params: { index: "sec_10k_2026", query: input.slice(0, 120) }, rows: 10 }],
      answer: "### What the filings say\n" + hitsTop.map(([t, n]) => `- **${n}** addresses this in its risk factors. [${t} · acc-mock-00]`).join("\n") +
        "\n### Coverage\n- Results come from a single search over sec_10k_2026; ask a narrower question to compare companies or count by sector." };
  }

  async function agentChat(body, send, isClosed) {
    const input = String(body.input || "");
    const run = pickRun(input);
    const T = S.agentTiming;
    const wait = async (s) => { if (!isClosed()) await sleep(s * 1000 * pace()); };
    const ev = (event, data) => { if (!isClosed()) send(event, { data }); };
    const t0 = Date.now();
    const conv = body.conversation_id || cryptoId();
    ev("conversation_id_set", { conversation_id: conv });
    ev("reasoning", { reasoning: "Reading the question and picking the narrowest tool that answers it.", transient: true });
    await wait(T.firstReason);
    for (let i = 0; i < run.tools.length; i++) {
      const tl = run.tools[i];
      const id = `tooluse_${cryptoId().slice(0, 12)}`;
      ev("reasoning", { reasoning: tl.reason, tool_call_id: id });
      ev("tool_call", { tool_call_id: id, tool_id: tl.tool, params: tl.params });
      await wait(T.perTool * 0.3);
      ev("tool_progress", { tool_call_id: id, message: tl.tool === "platform.core.search" ? "Searching sec_10k_2026 (hybrid)" : "Executing ES|QL query" });
      await wait(T.perTool * 0.7);
      ev("tool_result", { tool_call_id: id, tool_id: tl.tool, results: toolResults(tl.tool, tl.params, tl.rows) });
    }
    ev("reasoning", { reasoning: "I have enough cited passages to answer. Writing the response with ticker and accession citations." });
    await wait(T.answerStart);
    const ttft = Date.now() - t0;
    ev("thinking_complete", { time_to_first_token: ttft });
    const answer = rewriteAnswer(run.answer) + `\n\n_Stand-in answer from the dev stub. On the kit ${LLM_NAME} writes it from the live tool results._`;
    const pieces = answer.match(/\S+\s*/g) || [answer];
    const per = (T.answerDur * 1000 * pace()) / pieces.length;
    for (let i = 0; i < pieces.length && !isClosed(); i += 3) {
      ev("message_chunk", { text_chunk: pieces.slice(i, i + 3).join(""), message_id: conv });
      await sleep(per * 3);
    }
    ev("message_complete", { message_id: conv, message_content: answer });
    const outTok = Math.round(answer.length / 3.8);
    ev("round_complete", { round: {
      id: cryptoId(), input: { message: input },
      response: { message: answer },
      model_usage: { llm_calls: run.tools.length + 1, input_tokens: 9800 + run.tools.length * 21400, output_tokens: outTok + 240 * run.tools.length, model: LLM_TAG },
      time_to_first_token: ttft, time_to_last_token: Date.now() - t0 } });
    ev("conversation_created", { conversation_id: conv, title: input.slice(0, 60) });
  }

  return { sectors, search, state, agentChat };
}

function cryptoId() {
  return globalThis.crypto.randomUUID();
}
