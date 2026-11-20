// Multimodal endpoints: /api/jina/{analysts,state,multimodal/search,search,analyst/answer,figimg,pdf,image}.
// Shapes follow demo/backend/app/routers/jina.py.
// Corpus: enablement/mock/js/data-corpus.js (100 CC BY / CC0 PMC open-access papers, real chunk text and figures).
// Markings: recomputed here with the md5 logic of demo/scripts/jina/markings.py and checked against the corpus file.
// Clearance filter: the rules of demo/backend/app/services/jina_dls.py (via mock/js/corpus-search.js, a faithful port).
// Retrieval: keyword BM25 stand-in for the kit's BM25 + Jina kNN RRF.
import crypto from "node:crypto";
import { LLM_NAME } from "./vineyard.mjs";

const CLS_HIER = ["U", "CUI", "C", "S", "TS"];
const COMPARTMENTS = ["SCI", "HCS", "SI", "TK"];
const SRC_TYPES = ["OSINT", "IMINT", "HUMINT", "SIGINT"];
export const OMNI_MODEL = "jina-embeddings-v5-omni-small";

// Port of demo/scripts/jina/markings.py assign_markings (md5 of "salt:parent_id" as a 128-bit int).
const h = (pid, salt) => BigInt("0x" + crypto.createHash("md5").update(`${salt}:${pid}`).digest("hex"));
export function assignMarkings(pid) {
  const r = Number(h(pid, "cls") % 100n);
  const cls = r < 40 ? "U" : r < 65 ? "CUI" : r < 80 ? "C" : r < 93 ? "S" : "TS";
  let comps = [];
  if (cls === "S" || cls === "TS") {
    const bits = h(pid, "comp");
    let chosen = COMPARTMENTS.filter((_, i) => (bits >> BigInt(i)) & 1n);
    if (!chosen.length) chosen = [COMPARTMENTS[Number(bits % 4n)]];
    comps = chosen.slice(0, cls === "S" ? 2 : 3);
  }
  const caveats = [];
  if (["C", "S", "TS"].includes(cls) && h(pid, "noforn") % 100n < 45n) caveats.push("NOFORN");
  if (cls === "TS" && h(pid, "orcon") % 100n < 25n) caveats.push("ORCON");
  const rel = caveats.includes("NOFORN") ? ["USA"] : h(pid, "rel") % 100n < 40n ? ["USA", "FVEY"] : ["USA"];
  const src = SRC_TYPES[Number(h(pid, "src") % 4n)];
  return { classification: cls, compartments: comps, compartments_count: comps.length, caveats, releasability: rel, source_type: src };
}

// Search by Image: the ten synthetic shapes of the mock (the kit's ten PNGs differ), drawn as SVG.
const SYN = {
  round: ["circle", "disc", "dot"], circle: ["circle", "disc", "dot"], disc: ["circle", "disc", "dot"], dot: ["circle", "disc", "dot"],
  square: ["square"], box: ["square"], triangle: ["triangle"], star: ["star"], stripes: ["hstripes", "vstripes"],
  horizontal: ["hstripes"], vertical: ["vstripes"], striped: ["hstripes", "vstripes"],
};
const COLORS = { red: "#e5484d", blue: "#3b82f6", green: "#22c55e", yellow: "#facc15", orange: "#f97316", black: "#111827" };

function svgFor(img) {
  const c = COLORS[img.color] || "#888";
  let shape = "";
  switch (img.shape) {
    case "square": shape = `<rect x="70" y="20" width="160" height="160" fill="${c}"/>`; break;
    case "circle": shape = `<circle cx="150" cy="100" r="80" fill="${c}"/>`; break;
    case "triangle": shape = `<polygon points="150,15 240,185 60,185" fill="${c}"/>`; break;
    case "star": shape = `<polygon fill="${c}" points="150,12 172,75 238,75 185,114 205,178 150,139 95,178 115,114 62,75 128,75"/>`; break;
    case "hstripes": for (let i = 0; i < 8; i++) shape += `<rect x="0" y="${i * 25}" width="300" height="12.5" fill="${c}"/>`; break;
    case "vstripes": for (let i = 0; i < 12; i++) shape += `<rect x="${i * 25}" y="0" width="12.5" height="200" fill="${c}"/>`; break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="#ffffff"/>${shape}</svg>`;
}

export function makeJina(M, { sleep, pace }) {
  const C = M.corpus, CS = M.corpusSearch, J = M.data.jina;

  // Apply markings.py to every paper and report any drift from the packed corpus.
  let drift = 0;
  for (const p of C.papers) {
    const m = assignMarkings(p.id);
    if (m.classification !== p.cls || m.compartments.join() !== p.comps.join() || m.caveats.join() !== p.cav.join()) drift++;
    p.cls = m.classification; p.comps = m.compartments; p.cav = m.caveats; p.rel = m.releasability; p.src = m.source_type;
  }
  const markingDrift = drift;

  // Reference-list chunks ("31. Mu J, Guo X ... 2023;15:16.") match many queries under keyword scoring and make poor
  // passages. Blank them before the BM25 index is built so retrieval lands on body text.
  const isRefs = (t, sec) => /^references?$|bibliograph/i.test(sec || "") ||
    ((t.match(/et al\.?/g) || []).length + (t.match(/\b(19|20)\d{2};\s?\d+/g) || []).length + (t.match(/doi[:.]/gi) || []).length) >= 4;
  let refChunks = 0;
  for (const c of C.chunks) if (isRefs(c[3], c[2])) { c[3] = ""; refChunks++; }
  CS.build();

  const analysts = () => CS.ORDER.map((id) => ({ ...CS.PERSONAS[id] }));
  const persona = (id) => CS.PERSONAS[id] || CS.PERSONAS.public;
  const pick = (a, keys) => Object.fromEntries(keys.map((k) => [k, a[k]]));

  function accessible(a) {
    const vis = C.papers.filter((p) => CS.canSee(a, p));
    const agg = { classification: {}, journal: {}, source_type: {}, year: {} };
    let chunks = 0;
    for (const p of vis) {
      const n = p.nchunks + p.figs.length; // text chunks + figure docs, as in pmc-unstructured
      chunks += n;
      agg.classification[p.cls] = (agg.classification[p.cls] || 0) + n;
      agg.journal[p.j] = (agg.journal[p.j] || 0) + n;
      agg.source_type[p.src] = (agg.source_type[p.src] || 0) + n;
      agg.year[p.y] = (agg.year[p.y] || 0) + n;
    }
    const buckets = (o, size, num) => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, size)
      .map(([key, count]) => ({ key: num ? Number(key) : key, count }));
    return { docs: vis.length, chunks, classification: buckets(agg.classification, 5), journal: buckets(agg.journal, 6),
      source_type: buckets(agg.source_type, 5), year: buckets(agg.year, 6, true) };
  }

  async function search(q, analystId) {
    const a = persona(analystId);
    const out = { analyst: pick(a, ["id", "name", "clearance", "compartments", "noforn", "label"]), hits: [], figures: [], accessible: accessible(a) };
    if (!q.trim()) return out;
    const t0 = Date.now();
    await sleep((40 + Math.random() * 50) * pace()); // query embed on the Jina server
    const r = CS.search(q, a.id);
    out.took_ms = 9 + Math.round(r.tookMs) + Math.floor(Math.random() * 8);
    out.hits = r.hits.map((hh, i) => ({
      parent_id: hh.p.id, doc_title: hh.p.t, journal: hh.p.j, year: hh.p.y, classification: hh.p.cls,
      compartments: hh.p.comps, caveats: hh.p.cav, source_type: hh.p.src,
      score: Math.round((1 / (61 + i) + 1 / (61 + i + (i % 3))) * 10000) / 10000,
      passage: hh.text, section: hh.section || "",
    }));
    out.figures = r.figures.map((f, i) => ({
      parent_id: f.p.id, doc_title: f.p.t, media_path: `${f.p.id}/${f.file}`, page: f.page,
      classification: f.p.cls, compartments: f.p.comps, caveats: f.p.cav, source_type: f.p.src,
      score: Math.round((0.47 - i * 0.021) * 1000) / 1000,
    }));
    void t0;
    return out;
  }

  const NO_ANSWER = "_No documents in your accessible corpus match this question. Another clearance level may see relevant material._";

  async function answer(q, analystId) {
    const a = persona(analystId);
    const res = CS.answer(q, a.id);
    const head = pick(a, ["id", "name", "clearance", "label"]);
    await sleep((6000 + Math.random() * 4000) * pace()); // one LLM call on the kit
    const sources = res.sources.map((s) => ({ parent_id: s.p.id, doc_title: s.p.t, classification: s.p.cls, compartments: s.p.comps,
      caveats: s.p.cav, journal: s.p.j, year: s.p.y }));
    if (!sources.length) return { analyst: head, answer: NO_ANSWER, sources: [] };
    let md;
    if (!res.sentences.length) {
      md = `The passages you are cleared to see do not answer this question directly. The closest material is ${sources.slice(0, 2).map((s) => `*${s.doc_title}* [${s.parent_id}]`).join(" and ")}.`;
    } else {
      md = `**From the ${sources.length} papers visible at ${a.clearance} clearance:**\n\n` +
        res.sentences.map((s) => `- ${s.text.replace(/\s+/g, " ")} [${s.p.id}]`).join("\n") +
        `\n\n_Extractive stand-in from the dev stub: quoted sentences, keyword retrieval. On the kit ${LLM_NAME} writes the answer from the same filtered passages._`;
    }
    return { analyst: head, answer: md, sources };
  }

  async function multimodal(q, space, k) {
    await sleep((80 + Math.random() * 60) * pace());
    const words = q.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const hits = J.images.map((img) => {
      let s = 0.18;
      for (const w of words) {
        if (COLORS[w] && img.color === w) s += 0.22;
        if (SYN[w] && SYN[w].includes(img.shape)) s += 0.26;
        if (space === "caption" && img.caption.includes(w)) s += 0.05;
      }
      s += (img.id.charCodeAt(4) % 7) * 0.004;
      return { id: img.id, score: Math.round(Math.min(0.92, s) * 1000) / 1000, doc_id: img.id, caption: img.caption, file: `${img.id}.svg` };
    }).sort((x, y) => y.score - x.score).slice(0, k);
    return { took_ms: 14 + Math.floor(Math.random() * 10), space, hits };
  }

  const imageSvg = (file) => {
    const img = J.images.find((i) => `${i.id}.svg` === file);
    return img ? svgFor(img) : null;
  };

  const state = () => ({ omni_url: "http://jina.ddil:8081", omni_model: OMNI_MODEL, es_url: "http://es.ddil:9200",
    mm_index: "jina-multimodal", mm_dims: 768, dls_index: "pmc-unstructured", dls_dims: 1024 });

  return { analysts, state, search, answer, multimodal, imageSvg, markingDrift, refChunks, stats: () => ({ papers: C.papers.length, chunks: C.chunks.length }) };
}
