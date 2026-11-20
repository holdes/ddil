/* In-browser practice retrieval over the real corpus subset (js/data-corpus.js).
   Keyword BM25 (k1 1.2, b 0.75) over text chunks, DLS pre-filter applied before scoring,
   collapse to the best chunk per paper (the kit collapses on parent_id), top 8.
   Differences from the kit, stated in the UI and coach: no Jina kNN leg and no RRF fusion;
   a small English stopword list and plural folding stand in for the semantic leg's recall.
   Persona rules are ported exactly from demo/backend/app/services/jina_dls.py. */
(function () {
  var M = window.MOCK;
  var CLS_HIER = ["U", "CUI", "C", "S", "TS"];
  var PERSONAS = {
    public: { id: "public", name: "Public User", clearance: "U", compartments: [], noforn: false, label: "U · no compartments · foreign" },
    secret_si: { id: "secret_si", name: "Analyst A", clearance: "S", compartments: ["SI"], noforn: true, label: "SECRET · SI · US" },
    ts_hcs: { id: "ts_hcs", name: "Analyst B", clearance: "TS", compartments: ["SCI", "HCS", "SI"], noforn: true, label: "TS/SCI · HCS · SI · US" },
    ts_all: { id: "ts_all", name: "Senior Analyst", clearance: "TS", compartments: ["SCI", "HCS", "TK", "SI"], noforn: true, label: "TS/SCI · HCS · TK · SI · US" },
  };
  var ORDER = ["public", "secret_si", "ts_hcs", "ts_all"];

  function allowedLevels(cl) { return CLS_HIER.slice(0, CLS_HIER.indexOf(cl) + 1); }
  // jina_dls.dls_filter: level allowed AND (no compartments OR holds all of them) AND NOT (NOFORN unless cleared)
  function canSee(a, p) {
    if (allowedLevels(a.clearance).indexOf(p.cls) < 0) return false;
    for (var i = 0; i < p.comps.length; i++) if (a.compartments.indexOf(p.comps[i]) < 0) return false;
    if (!a.noforn && p.cav.indexOf("NOFORN") >= 0) return false;
    return true;
  }
  // The exact bool the backend sends (dls_bool)
  function dlsBool(a) {
    return { bool: {
      filter: [
        { terms: { classification: allowedLevels(a.clearance) } },
        { bool: { minimum_should_match: 1, should: [
          { bool: { must_not: { exists: { field: "compartments" } } } },
          { terms_set: { compartments: { terms: a.compartments.length ? a.compartments : ["__none__"], minimum_should_match_field: "compartments_count" } } },
        ] } },
      ],
      must_not: a.noforn ? [] : [{ term: { caveats: "NOFORN" } }],
    } };
  }
  function requestBody(q, a) {
    var dls = dlsBool(a);
    return { retriever: { rrf: { filter: dls, retrievers: [
        { standard: { query: { match: { content: q } } } },
        { knn: { field: "embedding", k: 50, num_candidates: 200, query_vector: "[1024-d Jina query vector · embedded on the kit]" } },
      ] } },
      collapse: { field: "parent_id", inner_hits: { name: "p", size: 1, _source: ["content", "section", "chunk_type", "page", "media_path"] } },
      size: 8,
      _source: ["parent_id", "doc_title", "journal", "year", "classification", "compartments", "caveats", "source_type"] };
  }

  var SW = {};
  "a an and are as at be by for from has have in into is it its of on or that the their this to was were with what which how do does these those about than then also can our we not no".split(" ").forEach(function (w) { SW[w] = 1; });
  function fold(w) { return w.length > 4 && w.charAt(w.length - 1) === "s" && w.charAt(w.length - 2) !== "s" ? w.slice(0, -1) : w; }
  function tokens(text) {
    var out = [], m, re = /[a-z0-9]+/g, t = text.toLowerCase();
    while ((m = re.exec(t))) if (!SW[m[0]]) out.push(fold(m[0]));
    return out;
  }

  var IX = null;
  function build() {
    if (IX) return IX;
    var C = M.corpus, t0 = performance.now();
    var post = Object.create(null), lens = new Float32Array(C.chunks.length), total = 0;
    C.chunks.forEach(function (c, i) {
      var tk = tokens(c[3]), tf = Object.create(null);
      lens[i] = tk.length; total += tk.length;
      for (var k = 0; k < tk.length; k++) tf[tk[k]] = (tf[tk[k]] || 0) + 1;
      for (var term in tf) (post[term] || (post[term] = [])).push(i, tf[term]);
    });
    IX = { post: post, lens: lens, avg: total / C.chunks.length, N: C.chunks.length, buildMs: performance.now() - t0 };
    return IX;
  }

  function visibleSet(a) {
    return M.corpus.papers.map(function (p) { return canSee(a, p); });
  }

  function facetCounts(paperIdx) {
    var P = M.corpus.papers, f = { classification: {}, compartments: {}, source_type: {}, journal: {}, year: {} };
    paperIdx.forEach(function (i) {
      var p = P[i];
      f.classification[p.cls] = (f.classification[p.cls] || 0) + 1;
      p.comps.forEach(function (c) { f.compartments[c] = (f.compartments[c] || 0) + 1; });
      if (!p.comps.length) f.compartments["(none)"] = (f.compartments["(none)"] || 0) + 1;
      f.source_type[p.src] = (f.source_type[p.src] || 0) + 1;
      f.journal[p.j] = (f.journal[p.j] || 0) + 1;
      f.year[p.y] = (f.year[p.y] || 0) + 1;
    });
    var out = {};
    Object.keys(f).forEach(function (k) {
      var arr = Object.keys(f[k]).map(function (key) { return [key, f[k][key]]; });
      if (k === "classification") arr.sort(function (x, y) { return CLS_HIER.indexOf(x[0]) - CLS_HIER.indexOf(y[0]); });
      else arr.sort(function (x, y) { return y[1] - x[1] || (x[0] < y[0] ? -1 : 1); });
      out[k] = arr.slice(0, 6);
    });
    return out;
  }

  // Score chunks, DLS pre-filter first, collapse to best chunk per paper.
  function scoreAll(q, a) {
    var ix = build(), C = M.corpus, vis = visibleSet(a);
    var qt = tokens(q).filter(function (t, i, arr) { return arr.indexOf(t) === i; });
    var best = Object.create(null), k1 = 1.2, b = 0.75;
    qt.forEach(function (t) {
      var pl = ix.post[t]; if (!pl) return;
      var df = pl.length / 2, idf = Math.log(1 + (ix.N - df + 0.5) / (df + 0.5));
      for (var j = 0; j < pl.length; j += 2) {
        var ci = pl[j], tf = pl[j + 1], pi = C.chunks[ci][0];
        if (!vis[pi]) continue; // pre-filter: hidden chunks never score
        var s = idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * ix.lens[ci] / ix.avg));
        var cur = best[ci]; best[ci] = (cur || 0) + s;
      }
    });
    var perPaper = Object.create(null);
    for (var ci in best) {
      var pi = C.chunks[ci][0], s = best[ci];
      if (!perPaper[pi] || s > perPaper[pi].score) perPaper[pi] = { paper: +pi, chunk: +ci, score: s };
    }
    var ranked = Object.keys(perPaper).map(function (k) { return perPaper[k]; }).sort(function (x, y) { return y.score - x.score; });
    return { ranked: ranked, terms: qt, vis: vis };
  }

  function search(q, personaId) {
    build(); // one-off index build (~200 ms on first use) is not counted as query time
    var t0 = performance.now(), a = PERSONAS[personaId] || PERSONAS.public, C = M.corpus;
    var vis = visibleSet(a), accIdx = [], accChunks = 0;
    vis.forEach(function (v, i) { if (v) { accIdx.push(i); accChunks += C.papers[i].nchunks; } });
    var out = { analyst: a, accessible: { papers: accIdx.length, chunks: accChunks, figures: accIdx.reduce(function (s, i) { return s + C.papers[i].figs.length; }, 0) },
      total: { papers: C.papers.length, chunks: C.chunks.length }, hits: [], figures: [], terms: [], matching: 0, body: requestBody(q || "", a) };
    if (!q || !q.trim()) { out.facets = facetCounts(accIdx); out.facetScope = "accessible corpus"; out.tookMs = performance.now() - t0; return out; }
    var r = scoreAll(q, a);
    out.terms = r.terms;
    out.matching = r.ranked.length;
    out.facets = facetCounts(r.ranked.map(function (h) { return h.paper; }));
    out.facetScope = r.ranked.length + " matching accessible papers";
    out.hits = r.ranked.slice(0, 8).map(function (h) {
      var p = C.papers[h.paper], c = C.chunks[h.chunk];
      return { p: p, paperIdx: h.paper, score: h.score, page: c[1], section: c[2], text: c[3] };
    });
    // Figure strip: figures of the top accessible papers, nearest the matching page first.
    out.hits.forEach(function (h) {
      if (out.figures.length >= 6 || !h.p.figs.length) return;
      var f = h.p.figs.slice().sort(function (x, y) { return Math.abs(x[1] - h.page) - Math.abs(y[1] - h.page); })[0];
      out.figures.push({ p: h.p, file: f[0], page: f[1] });
    });
    out.tookMs = performance.now() - t0;
    return out;
  }

  // Extractive "AI Analyst". Retrieval is the same DLS-filtered search. A sentence qualifies only if it
  // contains the query's most specific term (highest corpus-wide IDF, independent of persona) and is not a
  // reference-list line. If no visible passage qualifies, the honest no-answer is returned, as the kit's
  // prompt instructs the model to do.
  var QWORDS = { paper: 1, papers: 1, study: 1, studie: 1, say: 1, known: 1, cause: 1, caus: 1, effect: 1, finding: 1, report: 1, show: 1 };
  function answer(q, personaId) {
    var a = PERSONAS[personaId] || PERSONAS.public, C = M.corpus;
    var r = scoreAll(q, a), ix = build();
    var idf = {}, anchor = null;
    r.terms.forEach(function (t) {
      var pl = ix.post[t], df = pl ? pl.length / 2 : 0;
      idf[t] = df ? Math.log(1 + (ix.N - df + 0.5) / (df + 0.5)) : 0;
      if (!QWORDS[t] && df && (!anchor || idf[t] > idf[anchor])) anchor = t;
    });
    var sentences = [];
    r.ranked.slice(0, 8).forEach(function (h) {
      if (sentences.length >= 4) return;
      var p = C.papers[h.paper], text = C.chunks[h.chunk][3];
      var parts = text.replace(/([.!?])\s+(?=[A-Z])/g, "$1\u0001").split("\u0001");
      var bestS = null, bestScore = 0;
      parts.forEach(function (s) {
        if (s.length < 50 || s.length > 420 || /doi|et al\.|https?:|\d{4};/i.test(s)) return;
        var tk = tokens(s);
        if (!anchor || tk.indexOf(anchor) < 0) return;
        var seen = {}, sc = 0;
        tk.forEach(function (t) { if (idf[t] && !seen[t]) { seen[t] = 1; sc += idf[t]; } });
        if (sc > bestScore) { bestScore = sc; bestS = s; }
      });
      if (bestS) sentences.push({ text: bestS.trim(), p: p, page: C.chunks[h.chunk][1] });
    });
    return { analyst: a, anchor: anchor, sentences: sentences, sources: r.ranked.slice(0, 6).map(function (h) { return { p: C.papers[h.paper], page: C.chunks[h.chunk][1] }; }), terms: r.terms };
  }

  M.corpusSearch = { PERSONAS: PERSONAS, ORDER: ORDER, canSee: canSee, dlsBool: dlsBool, requestBody: requestBody, search: search, answer: answer, build: build, tokens: tokens };
})();
