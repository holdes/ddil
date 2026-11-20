/* Multimodal + Need-to-Know. Scenes follow the kit's newer local work (Search by Image, Vector Search,
   AI Analyst); the Vector Search layout mirrors the original Jina "Need-to-Know Hybrid Search" UI:
   analyst bar, search + chips, accessible meter, live ES query panel + facets, figure strip, result cards,
   slide-over PDF viewer. Retrieval is js/corpus-search.js over the real corpus subset. */
(function () {
  var M = window.MOCK, U = M.util, esc = U.esc;
  var D = function () { return M.data.jina; };
  var CS = function () { return M.corpusSearch; };
  var app = function () { return M.app; };
  var S = null;

  function init() {
    S = { persona: "public", media: null,
      img: { query: "", space: "image", result: null, loading: false, error: null },
      vs: { query: "", res: null, error: null },
      an: { query: "", res: null, answering: false, error: null, t0: 0, tok: null },
      viewer: null, timers: new U.Timers() };
    checkMedia();
  }
  function checkMedia() {
    var C = M.corpus; if (!C) { S.media = false; return; }
    var p = C.papers.filter(function (x) { return x.figs.length; })[0];
    var im = new Image();
    im.onload = function () { S.media = true; if (M.app.A.adv === "jina") app().refresh(); };
    im.onerror = function () { S.media = false; if (M.app.A.adv === "jina") app().refresh(); };
    im.src = figSrc(p.id, p.figs[0][0]);
  }
  function figSrc(id, f) { return "data/figs/" + id + "/" + f; }
  function step() { return D().steps[app().A.step]; }

  function enter(i, p) {
    var s = D().steps[i];
    if (p.persona && CS().PERSONAS[p.persona]) S.persona = p.persona;
    else if (s.persona) S.persona = s.persona;
    S.viewer = null;
    if (s.scene === "image" && p.q != null) imageSearch(D().imageExamples[+p.q] || D().imageExamples[0], p.space || S.img.space, true);
    if (s.scene === "vector") {
      if (p.q != null) S.vs.query = D().searchChips[+p.q] || p.q;
      runSearch();
      if (p.open != null && S.vs.res && S.vs.res.hits[+p.open]) openHit(S.vs.res.hits[+p.open]);
    }
    if (s.scene === "analyst" && p.q != null) ask(D().analystQuestions[+p.q] || D().analystQuestions[0], p.run === "end");
  }
  function reset() { S.timers.cancel(); }
  function onEscape() { if (S && S.viewer) { S.viewer = null; app().refresh(); return true; } return false; }

  // ---------- Search by Image (unchanged synthetic track) ----------
  var COLORS = { red: "#E5484D", blue: "#3B82F6", green: "#22A06B", yellow: "#F5C518", orange: "#F97316", black: "#1D1E24" };
  function jitter(id, salt) { var h = 0, s = id + salt; for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) % 9973; return (h % 400) / 10000; }
  function scoreImage(q, im, space) {
    q = q.toLowerCase();
    var colorHit = new RegExp("\\b" + im.color + "\\b").test(q) || (im.color === "black" && /stripe/.test(q));
    var shapeWords = { square: /square|box/, circle: /circle|round|disc|dot/, triangle: /triangle/, star: /star/, hstripes: /stripe/, vstripes: /stripe/ };
    var orient = (im.shape === "hstripes" && /horizontal/.test(q)) || (im.shape === "vstripes" && /vertical/.test(q)) ? 0.05 : 0;
    return (space === "image" ? 0.55 : 0.5) + (colorHit ? 0.15 : 0) + (shapeWords[im.shape].test(q) ? 0.19 : 0) + orient + jitter(im.id, space);
  }
  function imageSearch(q, space, instant) {
    var drill = app().drill();
    S.img.query = q; S.img.space = space; S.img.loading = true; S.img.error = null;
    var done = function () {
      S.img.loading = false;
      if (drill === "search") { S.img.error = "Search failed: inference endpoint jina-omni-text could not reach the Jina server (connection refused, :8081)"; S.img.result = null; }
      else if (drill === "es") { S.img.error = "Search failed: 500 Elasticsearch unreachable"; S.img.result = null; }
      else {
        var hits = D().images.map(function (im) { return { im: im, score: scoreImage(q, im, space) }; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 6);
        S.img.result = { hits: hits, took: 28 + Math.round(jitter(q, space) * 900) };
      }
      if (step().scene === "image") app().refresh();
    };
    if (instant) done(); else { app().refresh(); S.timers.later(D().timing.imageSearch * 1000, done); }
  }
  function shapeSvg(im) {
    var c = COLORS[im.color] || "#888", s = "";
    if (im.shape === "square") s = '<rect x="30" y="30" width="60" height="60" fill="' + c + '"/>';
    else if (im.shape === "circle") s = '<circle cx="60" cy="60" r="32" fill="' + c + '"/>';
    else if (im.shape === "triangle") s = '<polygon points="60,24 96,92 24,92" fill="' + c + '"/>';
    else if (im.shape === "star") s = '<polygon points="60,18 70,48 102,48 76,66 86,98 60,78 34,98 44,66 18,48 50,48" fill="' + c + '"/>';
    else if (im.shape === "hstripes") for (var i = 0; i < 6; i++) s += '<rect x="0" y="' + (i * 20) + '" width="120" height="10" fill="' + c + '"/>';
    else for (var j = 0; j < 6; j++) s += '<rect y="0" x="' + (j * 20) + '" height="120" width="10" fill="' + c + '"/>';
    return '<svg viewBox="0 0 120 120">' + s + "</svg>";
  }

  // ---------- Vector Search ----------
  function drillError() {
    var d = app().drill();
    return d === "search" ? "Search failed: query embed failed (Jina server unreachable at jina.ddil:8081). The hybrid query needs the query vector."
      : d === "es" ? "Search failed: 500 Elasticsearch unreachable" : null;
  }
  function runSearch() {
    S.vs.error = drillError();
    S.vs.res = S.vs.error ? null : CS().search(S.vs.query, S.persona);
  }
  function openHit(h) { S.viewer = { p: h.p, page: h.page || 1, section: h.section || "" }; }
  function findPaper(id) { return M.corpus.papers.filter(function (p) { return p.id === id; })[0]; }

  // ---------- AI Analyst ----------
  function ask(q, instant) {
    S.timers.cancel();
    var drill = app().drill(), f = app().paceFactor(), T = D().timing, tok = {};
    S.an = { query: q, res: null, answering: true, error: null, t0: Date.now(), tok: tok };
    var finish = function () {
      if (S.an.tok !== tok) return;
      S.an.answering = false;
      var de = drillError();
      if (de) S.an.error = de.replace("Search failed", "Analyst answer failed");
      else if (drill === "llm") S.an.error = "Analyst answer failed: LLM request timed out after 120 s";
      else S.an.res = CS().answer(q, S.persona);
      if (step().scene === "analyst") app().refresh();
    };
    if (instant) { finish(); return; }
    app().refresh();
    var delay = drill === "llm" ? T.llmTimeout * f : drill === "none" ? T.answer * f : 1.2;
    S.timers.later(delay * 1000, finish);
    var tick = function () { if (S.an.tok !== tok || !S.an.answering) return; var el = document.getElementById("ans-elapsed"); if (el) el.textContent = Math.round((Date.now() - S.an.t0) / 1000) + "s"; S.timers.later(1000, tick); };
    S.timers.later(1000, tick);
  }

  // ---------- render helpers ----------
  function badges(p) {
    var s = '<span class="cls ' + p.cls + '">' + p.cls + "</span>";
    p.comps.forEach(function (c) { s += ' <span class="mk comp">' + c + "</span>"; });
    p.cav.forEach(function (c) { s += ' <span class="mk cav">' + (c === "NOFORN" ? "NF" : c) + "</span>"; });
    s += ' <span class="mk src">' + p.src + "</span>";
    return s;
  }
  function hlRegex(terms) {
    var t = terms.filter(function (x) { return x.length > 1; }).map(function (x) { return x.replace(/[^a-z0-9]/g, ""); });
    return t.length ? new RegExp("\\b(" + t.join("|") + ")(s|es)?\\b", "gi") : null;
  }
  function snippet(text, terms) {
    var re = hlRegex(terms), start = 0;
    if (re) { var m = re.exec(text); if (m) start = Math.max(0, m.index - 90); re.lastIndex = 0; }
    var s = text.slice(start, start + 300);
    var h = esc(s);
    if (re) h = h.replace(re, "<mark>$&</mark>");
    return (start > 0 ? "…" : "") + h + (start + 300 < text.length ? "…" : "");
  }
  function jsonHl(obj) {
    return esc(JSON.stringify(obj, null, 1))
      .replace(/&quot;(classification|compartments|caveats|terms_set|must_not|filter|compartments_count)&quot;/g, '&quot;<span class="qd">$1</span>&quot;')
      .replace(/&quot;([a-z_]+)&quot;:/g, '&quot;<span class="qk">$1</span>&quot;:');
  }
  function figBox(id, file, page, title, p) {
    if (S.media === null) return '<div class="fignone">loading…</div>';
    if (S.media === false) return '<div class="fignone">Media not packed<br><span class="mono tiny">run python3 -I tools/pack_corpus.py</span></div>';
    return '<img loading="lazy" src="' + figSrc(id, file) + '" alt="Figure from ' + esc(title) + ' page ' + page + '">';
  }

  function personaBar() {
    var P = CS().PERSONAS;
    var h = '<div class="abar"><span class="lbl">Signed in as</span>';
    CS().ORDER.forEach(function (id) { var a = P[id]; h += '<button class="abtn' + (id === S.persona ? " on" : "") + '" data-act="persona" data-p="' + id + '"><span class="cls ' + a.clearance + '">' + a.clearance + '</span><span class="nm">' + esc(a.name) + '</span><span class="cl">' + esc(a.label) + "</span></button>"; });
    return h + "</div>";
  }
  function meter(acc, total) {
    var pct = Math.round(acc.papers / total.papers * 100);
    var kit = D().kitCounts.persona[S.persona];
    return '<div class="meter"><span>accessible corpus <b>' + acc.papers + "</b> / " + total.papers + ' papers</span><span class="mbar"><i style="width:' + pct + '%"></i></span><span>' + pct + "% · " + U.fmtNum(acc.chunks) + " chunks · " + acc.figures + ' figures · DLS enforced</span>' +
      (app().coachOn() ? '<span class="badge mixed" style="margin-left:auto">Kit: ' + kit + " / 198 papers</span>" : "") + "</div>";
  }

  // ---------- render ----------
  function render() {
    var sc = step().scene;
    var h = '<div class="japp"><aside class="side"><div class="brand"><b style="color:var(--pink)">Multimodal Intelligence</b><span>Jina omni · on-box</span></div><nav>';
    [["image", "Search by Image", "one vector space"], ["vector", "Vector Search", "retrieval by meaning"], ["analyst", "AI Analyst", "grounded answers"]].forEach(function (x, i) {
      h += '<button data-act="jscene" data-scene="' + x[0] + '" class="' + (sc === x[0] ? "on" : "") + '"><span class="n">0' + (i + 1) + '</span><span>' + x[1] + '<br><span class="tiny muted">' + x[2] + "</span></span></button>";
    });
    h += '</nav><div class="foot"><div class="tiny">All markings are FICTIONAL. Open-access papers (CC BY / CC0).</div><button class="chip" data-act="jexit" style="justify-content:center">Exit to chooser</button></div></aside><main class="vmain">';
    if (!M.corpus && sc !== "image") h += '<div class="screen"><div class="panel pad alert">js/data-corpus.js is missing. Run <span class="mono">python3 -I tools/pack_corpus.py</span> in mock/.</div></div>';
    else h += sc === "image" ? renderImage() : sc === "vector" ? renderVector() : renderAnalyst();
    h += "</main></div>";
    if (S.viewer) h += renderViewer();
    return h;
  }

  function renderImage() {
    var s = S.img, d = D();
    var h = '<div class="screen fade" style="max-width:1000px"><div class="eyebrow pk">Track 1 · One vector space</div><h1 class="h1">Search images by typing words</h1>';
    h += '<p class="lede">Text and images are embedded by the local Jina omni model into the <em>same</em> vector space — so a typed query retrieves pictures directly. One native Elasticsearch kNN; the cluster embeds your query through the on-box inference endpoint. Fully air-gapped.</p>';
    h += '<div class="row wrap" style="gap:8px;margin-top:16px"><form data-submit="imgSearch" class="row" style="gap:8px;flex:1;min-width:320px"><input id="img-input" class="input" data-model="img" value="' + esc(s.query) + '" placeholder="Describe an image…" autocomplete="off"><button class="btn pinkb" type="submit">Search</button></form>';
    h += '<div class="row" style="gap:6px"><button class="chip' + (s.space === "image" ? " on" : "") + '" data-act="space" data-s="image">Image vectors</button><button class="chip' + (s.space === "caption" ? " on" : "") + '" data-act="space" data-s="caption">Caption vectors</button></div></div>';
    if (!s.result) h += '<div class="row wrap" style="gap:6px;margin-top:12px">' + d.imageExamples.map(function (q, i) { return '<button class="chip" data-act="imgEx" data-i="' + i + '">' + esc(q) + "</button>"; }).join("") + "</div>";
    if (s.loading) h += '<div class="small" style="margin-top:12px"><span class="spin"></span> Searching…</div>';
    if (s.error) h += '<div class="panel pad alert" style="margin-top:12px;color:var(--pink)">' + esc(s.error) + "</div>";
    if (s.result) {
      h += '<div class="mono tiny muted" style="margin-top:12px">' + s.result.took + " ms · " + s.result.hits.length + " images · " + (s.space === "image" ? "image_vector" : "caption_vector") + " · jina-multimodal</div>";
      h += '<div class="imgs" style="margin-top:10px">' + s.result.hits.map(function (x) { return '<div class="imgcard fade">' + shapeSvg(x.im) + '<div class="cap">' + esc(x.im.caption) + '<div class="meta"><span>' + x.im.id + "</span><span>score " + x.score.toFixed(3) + "</span></div></div></div>"; }).join("") + "</div>";
      h += '<p class="tiny muted" style="margin-top:8px"><span class="mockflag">Mock images.</span> The kit indexes 10 synthetic PNGs; these SVG shapes stand in for them.</p>';
    }
    return h + "</div>";
  }

  function renderVector() {
    var d = D(), v = S.vs, r = v.res;
    var h = '<div class="screen fade full" style="padding-top:22px"><div class="eyebrow pk">Vector Search · Hybrid + Need-to-Know</div>';
    h += '<h1 class="h1" style="font-size:32px">One query. <span style="color:var(--pink)">Only what you\'re cleared to see.</span></h1>';
    h += '<p class="lede">Hybrid retrieval over open-access research papers, text and figures. The security pre-filter runs <em>before</em> scoring, so over-clearance results never enter the response, the counts or the facets.</p>';
    h += personaBar();
    h += '<form data-submit="vsSearch" class="row" style="gap:8px;margin-top:12px"><input id="vs-input" class="input" data-model="vs" value="' + esc(v.query) + '" placeholder="Search the corpus as ' + esc(CS().PERSONAS[S.persona].name) + '…" autocomplete="off"><button class="btn pinkb" type="submit">Search</button></form>';
    h += '<div class="row wrap" style="gap:6px;margin-top:8px">' + d.searchChips.map(function (q, i) { return '<button class="chip' + (v.query === q ? " on" : "") + '" data-act="vsChip" data-i="' + i + '">' + esc(q) + "</button>"; }).join("") + "</div>";
    h += '<p class="mono tiny" style="color:var(--yellow);margin:8px 0 0">' + esc(d.bm25Note) + "</p>";
    if (v.error) return h + '<div class="panel pad alert" style="margin-top:12px;color:var(--pink)">' + esc(v.error) + "</div></div>";
    if (!r) return h + "</div>";
    h += meter(r.accessible, r.total);
    h += '<div class="vlayout"><div class="leftcol">';
    h += '<div class="qpanel"><div class="eyebrow">Elasticsearch query <span class="mono tiny muted" style="text-transform:none">GET pmc-unstructured/_search</span></div><pre class="code q">' + jsonHl(r.body) + '</pre><div class="tiny muted">Highlighted: the DLS clauses for ' + esc(r.analyst.name) + ". Same body the kit backend sends; the mock runs only the BM25 leg.</div></div>";
    h += '<div class="facets"><div class="eyebrow" style="margin-bottom:6px">Facets <span class="mono tiny muted" style="text-transform:none">over ' + esc(r.facetScope) + "</span></div>";
    [["classification", "Classification"], ["compartments", "Compartments"], ["source_type", "Source type"], ["journal", "Journal"], ["year", "Year"]].forEach(function (f) {
      var items = r.facets[f[0]]; if (!items || !items.length) return;
      h += '<div class="facet"><h4>' + f[1] + "</h4>" + items.map(function (b) { return '<div class="frow"><span>' + (f[0] === "classification" ? '<span class="cls ' + b[0] + '">' + b[0] + "</span>" : esc(b[0])) + '</span><span class="n">' + b[1] + "</span></div>"; }).join("") + "</div>";
    });
    h += "</div></div><div class=\"midcol\">";
    if (!v.query.trim()) h += '<div class="panel pad small muted">Type a query or pick a chip. The meter and facets above already reflect what ' + esc(r.analyst.name) + " may see.</div>";
    else {
      h += '<div class="mono tiny muted" style="margin-bottom:8px">' + r.hits.length + " of " + r.matching + " matching accessible papers · collapsed on parent_id · " + r.tookMs.toFixed(1) + " ms in browser</div>";
      if (r.figures.length) {
        h += '<div class="figstrip"><div class="eyebrow tl">Figures from the top accessible papers</div><div class="figrow">';
        r.figures.forEach(function (f, i) { h += '<button class="figcell" data-act="openFig" data-i="' + i + '">' + figBox(f.p.id, f.file, f.page, f.p.t, f.p) + '<div class="fc"><span class="cls ' + f.p.cls + '">' + f.p.cls + "</span> p." + f.page + " · " + esc(f.p.t.slice(0, 30)) + "</div></button>"; });
        h += "</div></div>";
      }
      if (!r.hits.length) h += '<div class="panel pad small">No accessible documents match. Another clearance level may see relevant material.</div>';
      r.hits.forEach(function (x, i) {
        var f = x.p.figs.length ? x.p.figs.slice().sort(function (a, b) { return Math.abs(a[1] - x.page) - Math.abs(b[1] - x.page); })[0] : null;
        h += '<button class="rescard fade" data-act="openHit" data-i="' + i + '"><div class="top"><span class="ti">' + esc(x.p.t) + '</span><span class="bd">' + badges(x.p) + "</span></div>";
        h += '<div class="meta">' + esc(x.p.j) + " · " + x.p.y + " · " + x.p.id + " · " + x.p.lic + ' <span class="open">open document &rarr;</span></div>';
        h += '<div class="snipwrap">' + (f ? '<div class="thumb">' + figBox(x.p.id, f[0], f[1], x.p.t) + "</div>" : "") + '<div class="snip"><span class="sec">' + esc(x.section || "Text") + " · p." + x.page + "</span> " + snippet(x.text, r.terms) + "</div></div></button>";
      });
    }
    return h + "</div></div></div>";
  }

  function renderAnalyst() {
    var d = D(), a = S.an, cur = CS().PERSONAS[S.persona];
    var acc = CS().search("", S.persona);
    var h = '<div class="screen fade" style="max-width:1100px;padding-top:22px"><div class="eyebrow pk">AI Analyst</div><h1 class="h1" style="font-size:32px">Answers grounded only in what you\'re cleared to read</h1>';
    h += '<p class="lede">The agent retrieves under the same security filter, then answers from those passages alone. Ask the same question as two personas and compare.</p>';
    h += personaBar() + meter(acc.accessible, acc.total);
    h += '<form data-submit="anAsk" class="row" style="gap:8px;margin-top:12px"><input id="an-input" class="input" data-model="an" value="' + esc(a.query) + '" placeholder="Ask the corpus as ' + esc(cur.name) + '…" autocomplete="off"><button class="btn pinkb" type="submit"' + (a.answering ? " disabled" : "") + ">Ask</button></form>";
    h += '<div class="row wrap" style="gap:6px;margin-top:8px">' + d.analystQuestions.map(function (q, i) { return '<button class="chip" data-act="anEx" data-i="' + i + '">' + esc(q) + "</button>"; }).join("") + "</div>";
    if (a.answering) h += '<div class="panel pad small" style="margin-top:14px"><span class="spin"></span> Reasoning over the documents ' + esc(cur.name) + ' is cleared to see… <span class="mono muted" id="ans-elapsed">' + Math.round((Date.now() - a.t0) / 1000) + "s</span></div>";
    if (a.error) h += '<div class="panel pad alert small" style="margin-top:14px;color:var(--pink)">' + esc(a.error) + "</div>";
    if (a.res) {
      var res = a.res;
      h += '<div class="answer fade" style="margin-top:14px"><div class="row" style="justify-content:space-between;align-items:center"><span class="eyebrow pk">Research Paper Analyst</span><span class="mono tiny muted">answer scoped to ' + res.analyst.clearance + " clearance · " + esc(res.analyst.name) + "</span></div>";
      if (!res.sentences.length) h += '<p class="small"><em>' + esc(d.noAnswer) + "</em></p>";
      else h += '<ul class="ans">' + res.sentences.map(function (s) { return "<li>" + esc(s.text) + ' <button class="cite" data-act="cite" data-id="' + s.p.id + '" data-page="' + s.page + '">[' + s.p.id + "]</button></li>"; }).join("") + "</ul>";
      h += '<div class="mockflag" style="margin-top:8px">Mock: extractive. On the kit Nemotron 3.5 Lightning writes the answer from these same DLS-visible passages.</div></div>';
      if (res.sources.length) {
        h += '<div class="eyebrow" style="margin-top:14px">Passages retrieved for ' + esc(res.analyst.name) + " · top " + res.sources.length + "</div>";
        h += res.sources.map(function (s) { return '<button class="rescard" data-act="cite" data-id="' + s.p.id + '" data-page="' + s.page + '"><div class="top"><span class="ti">' + esc(s.p.t) + '</span><span class="bd">' + badges(s.p) + '</span></div><div class="meta">' + esc(s.p.j) + " · " + s.p.y + " · " + s.p.id + " · p." + s.page + "</div></button>"; }).join("");
      }
    }
    return h + "</div>";
  }

  function renderViewer() {
    var v = S.viewer, p = v.p;
    var h = '<div class="vbackdrop" data-act="closeViewer"></div><aside class="viewer" role="dialog" aria-label="Document viewer">';
    h += '<div class="vhead"><button class="tbtn" data-act="closeViewer" aria-label="Close viewer">&#10005;</button><div><div class="vt">' + esc(p.t) + '</div><div class="mono tiny muted">' + esc(p.j) + " · " + p.y + " · " + p.id + ' · <span class="teal">jumped to p.' + v.page + (v.section ? " · " + esc(v.section) : "") + "</span></div></div></div>";
    h += '<div class="vbadges">' + badges(p) + '<span class="tiny muted" style="margin-left:auto">Licence ' + esc(p.lic) + " · " + esc(p.j) + " " + p.y + " · PubMed Central " + p.id + " · markings fictional</span></div>";
    if (S.media !== true) h += '<div class="vmissing"><div><b>PDF not packed.</b><br>Run <span class="mono">python3 -I tools/pack_corpus.py</span> in mock/ to copy the 100 source PDFs, or use the ddil-mock.zip build.</div></div>';
    else h += '<iframe title="Source PDF" src="data/pdfs/' + p.id + ".pdf#page=" + v.page + '"></iframe>';
    return h + "</aside>";
  }

  var actions = {
    jscene: function (el) { var sc = el.getAttribute("data-scene"); if (sc === step().scene) return; app().go(sc === "image" ? 0 : sc === "vector" ? 1 : 4); },
    jexit: function () { app().exit(); },
    imgEx: function (el) { imageSearch(D().imageExamples[+el.getAttribute("data-i")], S.img.space); },
    imgSearch: function () { if (S.img.query.trim()) imageSearch(S.img.query, S.img.space); },
    space: function (el) { S.img.space = el.getAttribute("data-s"); if (S.img.query.trim()) imageSearch(S.img.query, S.img.space); else app().refresh(); },
    persona: function (el) {
      S.persona = el.getAttribute("data-p");
      if (step().scene === "vector") runSearch();
      if (step().scene === "analyst") { if (S.an.query && (S.an.res || S.an.answering || S.an.error)) ask(S.an.query); }
      app().refresh();
    },
    vsChip: function (el) { S.vs.query = D().searchChips[+el.getAttribute("data-i")]; runSearch(); app().refresh(); },
    vsSearch: function () { runSearch(); app().refresh(); },
    openHit: function (el) { openHit(S.vs.res.hits[+el.getAttribute("data-i")]); app().refresh(); },
    openFig: function (el) { var f = S.vs.res.figures[+el.getAttribute("data-i")]; S.viewer = { p: f.p, page: f.page, section: "Figure" }; app().refresh(); },
    cite: function (el) { S.viewer = { p: findPaper(el.getAttribute("data-id")), page: +el.getAttribute("data-page") || 1, section: "" }; app().refresh(); },
    closeViewer: function () { S.viewer = null; app().refresh(); },
    anEx: function (el) { ask(D().analystQuestions[+el.getAttribute("data-i")]); },
    anAsk: function () { if (S.an.query.trim()) ask(S.an.query); },
  };
  function model(k, v) { if (k === "img") S.img.query = v; if (k === "vs") S.vs.query = v; if (k === "an") S.an.query = v; }

  M.screens.jina = { init: init, enter: enter, reset: reset, render: render, actions: actions, model: model, onEscape: onEscape };
})();
