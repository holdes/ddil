/* Vineyard Intelligence screens. Mirrors App.tsx flow: Architecture -> RaceIntro -> RaceDashboard(autoStart)
   -> main app with sidebar (Dashboard, Vineyard, AI Agronomist, Search, Crop Health, Indexing Race, System). */
(function () {
  var M = window.MOCK, U = M.util, esc = U.esc;
  var D = function () { return M.data.vineyard; };
  var app = function () { return M.app; };
  var S = null; // adventure state
  var CONV_KEY = "ddil-mock-vineyard-conversations";

  var COLORS = { alert: "#F04E98", watch: "#FEC514", healthy: "#48EFCF", blue: "#5B9BFF" };

  // ---------- shared views (also used by the SEC deck) ----------
  var V = (M.views = M.views || {});

  V.raceCard = function (path, opt) {
    var pct = path.totalDocs > 0 ? (path.docsIndexed / path.totalDocs) * 100 : 0;
    var isGpu = opt.color === "gpu";
    var col = isGpu ? "var(--teal)" : "var(--yellow)";
    var util = path.gpuPercent != null ? path.gpuPercent : path.cpuPercent != null ? path.cpuPercent : 0;
    var h = '<div class="panel rcard ' + (isGpu ? "hot" : "cpu") + '">';
    h += '<div class="hd" style="color:' + col + '"><span class="dot" style="background:' + col + '"></span>' + esc(opt.label);
    if (path.complete) h += '<span class="badge live" style="margin-left:auto">Complete</span>';
    h += "</div>";
    if (opt.hw) h += '<div class="mono tiny muted" style="margin:-6px 0 10px">' + esc(opt.hw) + "</div>";
    h += '<div class="bar ' + (isGpu ? "gpu" : "cpu") + '"><i style="width:' + Math.min(pct, 100).toFixed(2) + '%"></i></div>';
    h += '<div class="mono tiny muted" style="margin-top:6px;display:flex;justify-content:space-between"><span>' + U.fmtNum(path.docsIndexed) + " / " + U.fmtNum(path.totalDocs) + " vectors</span><span>" + pct.toFixed(1) + "%</span></div>";
    h += '<div class="mets">';
    h += '<div><div class="l">Throughput</div><div class="v">' + U.fmtNum(Math.round(path.throughput)) + ' <span class="tiny muted">v/s</span></div></div>';
    h += '<div><div class="l">Merge Time</div><div class="v">' + path.mergeTimeMs.toFixed(0) + ' <span class="tiny muted">ms</span></div></div>';
    // RaceDashboard.tsx: label is "GPU Util" whenever gpuPercent !== undefined (null counts), so both cards read GPU Util.
    h += '<div><div class="l">GPU Util</div><div class="v">' + util.toFixed(0) + "%</div></div>";
    h += '<div><div class="l">Elapsed</div><div class="v">' + U.fmtDur(path.elapsedMs) + "</div></div>";
    h += "</div>";
    h += '<div class="spark">' + U.spark([{ pts: path.history, color: isGpu ? "#48EFCF" : "#FEC514" }]) + "</div>";
    return h + "</div>";
  };

  V.stagedTag = function (text) {
    return app().coachOn() ? '<span class="badge staged">' + esc(text || "Staged visualization") + "</span>" : "";
  };

  // ---------- state ----------
  function init() {
    S = {
      race: new M.Race(function () { if (onRaceScreen()) app().refresh(); }),
      override: null, selected: null, mapMode: "health",
      chat: idleChat(), viewing: null, input: "",
      search: { query: "", mode: "hybrid", results: null, latency: null, loading: false },
      scan: { result: null, loading: false, name: null },
      timers: new U.Timers(),
    };
  }
  function idleChat() { return { status: "idle", phases: [], query: "", blockId: null, elapsed: 0, results: null, closed: false }; }
  function onRaceScreen() { var s = curStep(); return s && (s.screen === "race" || S.override === "race"); }
  function curStep() { return D().steps[app().A.step]; }

  function enter(step, p) {
    var s = D().steps[step];
    S.override = null;
    if (s.screen === "race") {
      if (p.race === "mid" || p.race === "end") S.race.jump(p.race);
      else if (S.race.status === "idle") S.race.start(); // autoStart on mount
    }
    if (s.screen === "map") {
      if (p.mode) S.mapMode = p.mode;
      if (p.block) S.selected = p.block;
    }
    if (s.screen === "chat") {
      if (p.q != null || p.block) {
        var q = p.q != null ? (D().chips[+p.q] || D().quickInvestigate[0]) : "Analyze the current status of block " + p.block + " and recommend actions";
        startChat(q, p.block || null, p.run === "end");
      }
    }
    if (s.screen === "search" && p.run === "end") doSearch(D().searchFallbackQuery || "blocks showing drought stress similar to 2012 conditions", true);
    if (s.screen === "scanner" && p.run === "end") { S.scan = { result: D().leaf, loading: false, name: "sample-leaf.jpg" }; }
  }

  function reset() {
    S.race.reset(true); S.race.timers.cancel(); S.timers.cancel(); S.chat = idleChat();
    U.remove(CONV_KEY); // Reset Demo clears vineyard-conversations
  }
  function leave() { /* engines keep running in the background while you visit another adventure */ }

  // ---------- agent pipeline (chat.py replay) ----------
  var PHASES = [
    { id: "sensors", name: "Sensor Snapshot", ic: "00" },
    { id: "historical", name: "Historical Context", ic: "01" },
    { id: "risk", name: "Risk Analysis", ic: "02" },
    { id: "recommendation", name: "Crop Recommendation", ic: "03" },
    { id: "action_plan", name: "Action Plan", ic: "04" },
  ];
  var HB_RISK = ["Evaluating disease pressure from 17K imagery records...", "Analyzing moisture stress against historical thresholds...", "Checking nutrient deficiency indicators..."];
  var HB_REC = ["Consulting harvest quality trends for this block...", "Prioritizing actions by urgency..."];

  function startChat(query, blockId, instant) {
    S.timers.cancel();
    S.viewing = null;
    var d = D(), drill = app().drill(), f = app().paceFactor(), T = d.pipelineTiming;
    var esDown = drill === "es" || drill === "search";
    var c = (S.chat = { status: "running", phases: PHASES.map(function (p) { return { id: p.id, name: p.name, ic: p.ic, status: "pending", messages: [], data: null, pct: 0 }; }),
      query: query, blockId: blockId, elapsed: 0, results: null, closed: false, t0: Date.now() });
    var key = d.pickResponse(query, blockId), R = d.responses[key];
    var bid = esDown ? (blockId || "BLK-C") : (blockId || d.latestBlock);
    var sm = d.summaries[bid];
    var sensor = esDown ? { block_id: bid, moisture: 46.2, temperature: 17.8, nitrogen: 52, phosphorus: 33, potassium: 50, ph: 6.8, health: "alert" }
      : { block_id: bid, moisture: sm.soil.m, temperature: sm.soil.t6, nitrogen: sm.npk.n, phosphorus: sm.npk.p, potassium: sm.npk.k, ph: sm.npk.ph, health: sm.health };
    var matches = esDown ? d.mockHistorical : R.matches;
    var variety = (d.blocks.filter(function (b) { return b.id === sensor.block_id; })[0] || {}).variety || "Cabernet Sauvignon";
    var ph = function (id) { return c.phases.filter(function (p) { return p.id === id; })[0]; };

    var events = []; var t = 0;
    var ev = function (dt, fn) { t += dt; events.push([t, fn]); };
    ev(0, function () { var p = ph("sensors"); p.status = "running"; p.pct = 5; p.messages.push("Querying soil + NPK indices..."); });
    ev(T.sensors, function () {
      var p = ph("sensors"); p.messages.push("Block " + sensor.block_id + ": moisture " + sensor.moisture + "%, K:" + sensor.potassium.toFixed(1) + " mg/kg");
      p.status = "complete"; p.data = sensor; p.pct = 20;
      var h = ph("historical"); h.status = "running"; h.pct = 20; h.messages.push("kNN vector search against 841K soil records...");
    });
    if (drill === "llm") {
      // F6: Phase 1 LLM call exceeds 120 s; the generator raises, the stream closes without job_complete. UI stays "running".
      ev(T.llmTimeout, function () { c.closed = true; });
    } else {
      ev(T.historical, function () {
        var h = ph("historical"); h.messages.push("Found " + matches.length + " similar conditions across 8 years");
        h.status = "complete"; h.pct = 40; h.data = { pattern_summary: R.pattern, matches: matches, years_of_data: 8 };
        ["risk", "recommendation", "action_plan"].forEach(function (id) { var x = ph(id); x.status = "running"; x.pct = 40; });
        ph("risk").messages.push("Running risk, recommendation, and action plan in parallel via Nemotron 3.5 Lightning...");
      });
      HB_RISK.forEach(function (m) { ev(3, function () { ph("risk").messages.push(m); }); });
      ev(T.risk - 9, function () { var r = ph("risk"); r.status = "complete"; r.pct = 60; r.data = { overall_risk: R.overall, risks: R.risks };
        ph("recommendation").messages.push("Generating " + variety + "-specific management recommendations..."); });
      HB_REC.forEach(function (m) { ev(3, function () { ph("recommendation").messages.push(m); }); });
      ev(T.recommendation - 6, function () { var r = ph("recommendation"); r.status = "complete"; r.pct = 80; r.data = { recommendations: R.recs };
        ph("action_plan").messages.push("Building concrete task assignments and timeline..."); });
      var n = Math.floor(T.action_plan / 3);
      for (var i = 0; i < n; i++) ev(3, function () { ph("action_plan").messages.push("Finalizing action plan..."); });
      ev(T.action_plan - n * 3, function () {
        var r = ph("action_plan"); r.status = "complete"; r.pct = 100; r.data = { actions: R.actions, estimated_cost: R.cost };
        c.results = { summary: R.summary, model: "nemotron-3.5-lightning", phases_completed: 5 };
        c.status = "done";
        c.elapsed = instant ? Math.round(t) : Math.round((Date.now() - c.t0) / 1000);
        saveConv(c);
      });
    }
    if (instant) {
      events.forEach(function (e) { e[1](); });
      if (c.status === "running") c.elapsed = Math.round(t);
      return;
    }
    events.forEach(function (e) {
      S.timers.later(e[0] * 1000 * f, function () { e[1](); if (onChat()) app().refresh(); });
    });
    var tick = function () {
      if (S.chat !== c || c.status !== "running") return;
      c.elapsed = Math.round((Date.now() - c.t0) / 1000);
      var el = document.getElementById("chat-elapsed"); if (el) el.textContent = c.elapsed + "s";
      S.timers.later(1000, tick);
    };
    S.timers.later(1000, tick);
  }
  function onChat() { var s = curStep(); return s && s.screen === "chat" && !S.override; }
  function loadConvs() { return U.load(CONV_KEY, []); }
  function saveConv(c) {
    var list = [{ query: c.query, blockId: c.blockId, phases: c.phases, results: c.results, elapsed: c.elapsed, timestamp: Date.now() }].concat(loadConvs()).slice(0, 20);
    U.save(CONV_KEY, list);
  }

  function investigateBlock(id, q) {
    S.selected = id;
    var query = q || "Analyze the current status of block " + id + " and recommend actions";
    goScene("chat");
    startChat(query, id);
    app().refresh();
  }
  function investigate(q) { goScene("chat"); startChat(q, null); app().refresh(); }

  var SCENES = [
    { id: "dashboard", label: "Dashboard" }, { id: "map", label: "Vineyard" }, { id: "chat", label: "AI Agronomist" },
    { id: "search", label: "Search" }, { id: "scanner", label: "Crop Health" }, { id: "race", label: "Indexing Race" }, { id: "overview", label: "System" },
  ];
  function stepIndexFor(scene) { var st = D().steps; for (var i = 0; i < st.length; i++) if (st[i].screen === scene) return i; return -1; }
  function goScene(scene) {
    if (scene === "race") { S.override = "race"; app().refresh(); return; }
    var i = stepIndexFor(scene);
    if (i !== app().A.step) { app().go(i); } else { S.override = null; }
  }

  function doSearch(q, instant) {
    S.search.query = q;
    S.search.loading = true;
    var done = function () {
      S.search.loading = false;
      S.search.results = D().searchFallback;
      S.search.latency = { embed: 12, search: 28, total: 47 };
      if (curStep().screen === "search") app().refresh();
    };
    if (instant) done(); else { app().refresh(); S.timers.later(350, done); }
  }

  // ---------- screens ----------
  function render() {
    var s = curStep();
    if (s.screen === "arch") return renderArch();
    if (s.screen === "intro") return renderIntro();
    if (s.screen === "race") return '<div class="screen full">' + renderRace(true) + "</div>";
    return renderShell(S.override || s.screen);
  }

  function renderArch() {
    var node = function (title, sub, color, specs, svcs) {
      var h = '<div class="panel pad" style="flex:1;border-color:' + color + '">';
      h += '<div class="eyebrow" style="color:' + color + '">' + esc(sub) + "</div><div class=\"h3\" style=\"font-size:20px;margin-top:6px\">" + esc(title) + "</div>";
      h += '<ul class="small" style="margin:6px 0 12px;padding-left:16px;color:var(--char)">' + specs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
      h += '<div style="border-top:1px solid var(--line);padding-top:10px">' + svcs.map(function (x) {
        return '<div class="small" style="display:flex;justify-content:space-between;gap:8px;margin:4px 0"><span><span class="dot pulse" style="background:' + color + ';margin-right:8px"></span>' + esc(x[0]) + '</span><span class="mono tiny muted">' + esc(x[1]) + "</span></div>";
      }).join("") + "</div></div>";
      return h;
    };
    var h = '<div class="screen fade">';
    h += '<div class="eyebrow">DDIL Demo Kit</div><h1 class="h1">System Architecture</h1>';
    h += '<p class="lede">Two compute nodes in a Pelican case — fully airgapped, GPU-accelerated AI search and inference.</p>';
    h += '<div class="row" style="margin-top:22px">';
    h += node("NVIDIA DGX Spark", "192.168.1.20 — AI/ML Powerhouse", "var(--teal)",
      ["Grace Blackwell GB10 — 1 PFLOP AI", "128 GB Unified Memory", "aarch64 Architecture", "NVIDIA cuVS Library (HNSW acceleration)"],
      [["Elasticsearch (GPU)", "9.5.6 + cuVS JAR"], ["Ollama — Nemotron 3.5 Lightning", "NVIDIA NeMo LLM"], ["Jina Embeddings v5 Omni", "Text + image embeddings"], ["Inference Endpoint", "ES → Jina (jina-omni-text)"]]);
    h += node("Framework Desktop", "192.168.1.10 — Presentation Layer", "var(--blue)",
      ["Ryzen AI Max+ 395 — 64 GB RAM", "x86_64 Architecture", "Demo App Frontend + Backend", "CPU HNSW (race comparison node)"],
      [["Elasticsearch (CPU)", "9.5.6 stock"], ["Kibana", "Agent Builder + Workflows"], ["React Frontend", "Vite + Tailwind"], ["FastAPI Backend", "Python 3.12"]]);
    h += "</div>";
    h += '<div class="panel pad" style="margin-top:16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">';
    h += '<div><b>UniFi Express 7</b><div class="tiny muted">Gateway + Wi-Fi 7 AP · 192.168.1.1</div></div><span class="grow" style="flex:1"></span>';
    h += '<span class="chip">Switch Flex Mini · 5-port GbE</span><span class="chip">1 Gbps Cat6a</span><span class="chip" style="color:var(--yellow)">&lt; 1.2ms latency</span>';
    h += '<span class="small"><span class="dot" style="background:var(--pink)"></span> Airgapped</span></div>';
    h += '<div class="panel pad" style="margin-top:16px"><div class="eyebrow tl">Elastic AI Stack — Data Flow</div><div class="row" style="margin-top:12px;align-items:stretch;gap:8px">';
    [["User Query", "\"Why is Block C failing?\"", "var(--char)"], ["Agent Builder", "Tool selection + orchestration", "var(--blue)"], ["ES|QL + kNN", "841K vectors searched", "var(--pink)"], ["Nemotron 3.5 Lightning", "On-device inference", "var(--teal)"], ["Actionable Insights", "Risk + Recommendations", "var(--yellow)"]].forEach(function (b, i) {
      if (i) h += '<span style="align-self:center;color:var(--grey)">&rarr;</span>';
      h += '<div style="flex:1;border:1px solid var(--line);padding:10px;text-align:center"><div style="color:' + b[2] + ';font-weight:600;font-size:13px">' + esc(b[0]) + '</div><div class="tiny muted">' + esc(b[1]) + "</div></div>";
    });
    h += "</div></div>";
    h += '<div class="grid" style="grid-template-columns:repeat(5,1fr);margin-top:16px">';
    [["869K", "Documents Indexed"], ["2 nodes", "Mixed Arch Cluster"], ["Nemotron", "3.5 Lightning on the Spark"], ["12x", "GPU Index Speedup"], ["<50 lbs", "Pelican Air 1615"]].forEach(function (s) {
      h += '<div class="panel pad stat center"><div class="v">' + esc(s[0]) + '</div><div class="l">' + esc(s[1]) + "</div></div>";
    });
    h += "</div>";
    h += '<div class="center" style="margin-top:24px">' + V.stagedTag("Static diagram") + ' <button class="btn teal" data-act="toIntro">Continue &rarr;</button></div>';
    return h + "</div>";
  }

  function renderIntro() {
    var h = '<div class="screen fade" style="max-width:900px">';
    h += '<div class="center"><span class="chip">Domaine de la Côte Cachée</span><h1 class="h1">Ingesting Vineyard Data</h1>';
    h += '<p class="lede" style="margin:0 auto">Before we can analyze your vineyard, we need to index 869,000 sensor records, nutrient profiles, harvest data, and disease imagery into Elasticsearch.</p></div>';
    h += '<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:24px">';
    [["Soil Sensor Readings", "841,536", "8-dim vectors"], ["Disease Imagery", "17K", "2048-dim embeddings"], ["NPK Nutrient Profiles", "10K", "7-dim vectors"], ["Harvest & Wine Quality", "281", "structured"]].forEach(function (d) {
      h += '<div class="panel pad"><b>' + esc(d[0]) + '</b><div class="mono tiny muted" style="margin-top:4px">' + esc(d[1]) + " records · " + esc(d[2]) + "</div></div>";
    });
    h += "</div>";
    h += '<div class="panel pad hot" style="margin-top:22px"><div class="row" style="align-items:center">';
    h += '<div style="flex:1" class="center"><div class="eyebrow tl" style="justify-content:center">NVIDIA cuVS</div><div class="tiny muted">GPU-Accelerated HNSW</div><div class="mono" style="font-size:34px;font-weight:700;margin-top:6px">~28,500</div><div class="tiny muted">vectors/second</div></div>';
    h += '<div class="center"><div class="tiny muted">vs</div><span class="badge live" style="margin-top:6px">12x faster</span></div>';
    h += '<div style="flex:1" class="center"><div class="eyebrow yl" style="justify-content:center">Standard CPU</div><div class="tiny muted">Traditional HNSW</div><div class="mono" style="font-size:34px;font-weight:700;margin-top:6px">~2,400</div><div class="tiny muted">vectors/second</div></div>';
    h += '</div><p class="small center" style="color:var(--char);border-top:1px solid var(--line);padding-top:12px;margin-top:14px">The NVIDIA DGX Spark\'s Blackwell GPU accelerates vector index construction using cuVS — building HNSW graphs up to 12x faster with identical recall quality. Same data, same search results, dramatically faster time-to-insight.</p></div>';
    h += '<p class="mono tiny muted center" style="margin-top:16px">DGX Spark · GB10 Blackwell · 1 PFLOP · Framework Desktop · Ryzen AI Max+ 395 · Elasticsearch 9.5.6</p>';
    h += '<div class="center" style="margin-top:18px">' + V.stagedTag("Hardcoded numbers") + ' <button class="btn teal" data-act="toRace">Start the Race &rarr;</button><div class="tiny muted" style="margin-top:8px">Watch GPU vs CPU index the same vectors side-by-side</div></div>';
    return h + "</div>";
  }

  function renderRace(withContinue) {
    var m = S.race.metrics();
    var h = '<div class="fade">';
    h += '<div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px"><div><div class="h2">Indexing Race</div><div class="small muted">DGX Spark · Blackwell GPU · 1 PFLOP · GPU HNSW vs CPU HNSW</div></div>';
    h += '<div class="row" style="gap:8px;align-items:center">' + V.stagedTag();
    h += '<button class="btn sm teal" data-act="raceStart"' + (m.status === "running" ? " disabled" : "") + ">&#9654; Start Race</button>";
    h += '<button class="btn sm ghost" data-act="raceReset"' + (m.status === "running" ? " disabled" : "") + ">&#8634; Reset</button>";
    if (withContinue) h += '<button class="btn sm" data-act="raceContinue">' + (m.status === "complete" ? "Continue to Demo →" : "Skip →") + "</button>";
    h += "</div></div>";
    h += '<div class="race" style="margin-top:16px">' + V.raceCard(m.cpu, { label: "CPU HNSW (Port 9201)", color: "cpu" }) + V.raceCard(m.gpu, { label: "GPU HNSW — cuVS (Port 9200)", color: "gpu" }) + "</div>";
    if (m.gpu.complete && !m.cpu.complete) {
      h += '<div class="panel pad hot fade" style="margin-top:16px"><div class="h3 teal" style="font-size:17px">GPU finished — CPU still working</div>';
      h += '<p class="small" style="color:var(--char)">The NVIDIA Blackwell GPU completed indexing ' + U.fmtNum(m.gpu.docsIndexed) + " vectors in <b class=\"teal\">" + U.fmtDur(m.gpu.elapsedMs) + "</b> while the CPU has only processed " + U.fmtNum(m.cpu.docsIndexed) + " of " + U.fmtNum(m.cpu.totalDocs) + ".</p>";
      h += '<div class="h3">What\'s being accelerated?</div><ul class="small" style="color:var(--char);margin:0;padding-left:16px">';
      h += "<li><b>HNSW Graph Construction</b> — When vectors are indexed, Elasticsearch builds a Hierarchical Navigable Small World graph for approximate nearest-neighbor search. This graph construction is compute-intensive and happens during segment merges.</li>";
      h += "<li><b>NVIDIA cuVS</b> — The CUDA Vector Similarities library offloads graph construction to the GPU. The Blackwell architecture processes thousands of distance calculations in parallel, building the same HNSW graph 12x faster.</li>";
      h += "<li><b>Same recall quality</b> — The GPU produces an identical HNSW graph. Search results are the same (98.9% recall). Only the build time changes — critical for large-scale ingestion where millions of vectors need indexing quickly.</li></ul>";
      h += '<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:10px;font-size:12px"><div><b class="teal">Ideal for:</b><ul style="margin:4px 0;padding-left:16px;color:var(--char)"><li>Large-scale initial data loads (millions of vectors)</li><li>Time-sensitive reindexing operations</li><li>High-dimensional embeddings (768+ dims)</li><li>Airgapped / edge deployments with limited time windows</li></ul></div>';
      h += '<div><b class="muted">Less impactful for:</b><ul style="margin:4px 0;padding-left:16px;color:var(--char)"><li>Small incremental updates (&lt;1K docs)</li><li>Search/query performance (already fast on CPU)</li><li>Low-dimensional vectors (&lt;32 dims)</li><li>Indices that rarely rebuild</li></ul></div></div></div>';
    }
    if (m.status === "complete") {
      h += '<div class="panel pad hot fade" style="margin-top:16px"><div class="ribbon">';
      h += '<div class="stat"><div class="v teal">' + m.speedup.toFixed(1) + 'x</div><div class="l">Speedup</div></div>';
      h += '<div class="stat"><div class="v teal">' + U.fmtDur(m.timeSaved) + '</div><div class="l">Time Saved</div></div>';
      h += '<div class="stat"><div class="v">' + m.recallGpu.toFixed(1) + '%</div><div class="l">Recall — identical quality</div></div>';
      h += '<div class="stat"><div class="v">' + U.fmtNum(m.gpu.docsIndexed + m.cpu.docsIndexed) + '</div><div class="l">Total Vectors Indexed</div></div></div>';
      h += '<p class="small center" style="color:var(--char);margin:12px 0 0">Both paths produced identical search indices. The GPU-accelerated node finished in <b class="teal">' + U.fmtDur(m.gpu.elapsedMs) + '</b> vs <b class="yellow">' + U.fmtDur(m.cpu.elapsedMs) + "</b> on CPU — a <b>" + m.speedup.toFixed(1) + "x improvement</b> powered by NVIDIA cuVS on the Blackwell architecture.</p></div>";
    }
    return h + "</div>";
  }

  function renderShell(scene) {
    var h = '<div class="vapp"><aside class="side"><div class="brand"><b>Côte Cachée</b><span>Vineyard Intelligence</span></div><nav>';
    SCENES.forEach(function (sc, i) {
      h += '<button data-act="scene" data-scene="' + sc.id + '" class="' + (sc.id === scene ? "on" : "") + '"><span class="n">0' + (i + 1) + "</span>" + esc(sc.label) + "</button>";
    });
    h += '</nav><div class="foot"><div><span class="dot pulse" style="background:var(--teal);margin-right:8px"></span>Airgapped · DDIL Kit</div>';
    if (S.selected) h += '<button class="chip" data-act="invBlock" data-block="' + S.selected + '">Investigate ' + S.selected + " &rarr;</button>";
    h += '<button class="chip" data-act="resetDemo" style="justify-content:center">&#8634; Reset Demo</button></div></aside>';
    h += '<main class="vmain">';
    if (scene === "dashboard") h += renderDashboard();
    else if (scene === "map") h += renderMap();
    else if (scene === "chat") h += renderChat();
    else if (scene === "search") h += renderSearch();
    else if (scene === "scanner") h += renderScanner();
    else if (scene === "race") h += '<div class="screen full">' + renderRace(false) + "</div>";
    else if (scene === "overview") h += renderOverview();
    return h + "</main></div>";
  }

  function blockStatus(m) { return m > 45 || m < 25 ? "alert" : m > 40 || m < 30 ? "watch" : "healthy"; }

  function miniMap(onclickAct, colorFn, opts) {
    opts = opts || {};
    var d = D(), lat0 = 46.0119, lat1 = 46.0189, lon0 = -118.3842, lon1 = -118.3745;
    var k = Math.cos(46.015 * Math.PI / 180);
    var W = 600, H = Math.round(W * (lat1 - lat0) / ((lon1 - lon0) * k));
    var px = function (lat, lon) { return [((lon - lon0) / (lon1 - lon0)) * W, H - ((lat - lat0) / (lat1 - lat0)) * H]; };
    var h = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Estate map">';
    for (var gx = 0; gx <= W; gx += 40) h += '<line x1="' + gx + '" x2="' + gx + '" y1="0" y2="' + H + '" stroke="#12204A" stroke-width="1"/>';
    for (var gy = 0; gy <= H; gy += 40) h += '<line y1="' + gy + '" y2="' + gy + '" x1="0" x2="' + W + '" stroke="#12204A" stroke-width="1"/>';
    h += '<path d="M0 ' + (H * 0.86) + " C " + W * 0.3 + " " + H * 0.78 + ", " + W * 0.55 + " " + H * 0.98 + ", " + W + " " + H * 0.9 + '" stroke="#1C3A7A" stroke-width="10" fill="none"/>';
    d.blocks.forEach(function (b) {
      var c = colorFn(b);
      var pts = b.poly.map(function (p) { return px(p[0], p[1]).map(function (v) { return v.toFixed(1); }).join(","); }).join(" ");
      var cx = 0, cy = 0; b.poly.forEach(function (p) { var q = px(p[0], p[1]); cx += q[0] / 4; cy += q[1] / 4; });
      var sel = S.selected === b.id && opts.showSel;
      h += '<g class="blk" data-act="' + onclickAct + '" data-block="' + b.id + '"><polygon points="' + pts + '" fill="' + c.fill + '" fill-opacity="' + c.op + '" stroke="' + c.stroke + '" stroke-width="' + (sel ? 4 : 2) + '"/>';
      h += '<text x="' + cx.toFixed(0) + '" y="' + (cy - 4).toFixed(0) + '" fill="#F5F7FA" font-family="IBM Plex Mono" font-size="13" font-weight="600" text-anchor="middle">' + b.id + "</text>";
      h += '<text x="' + cx.toFixed(0) + '" y="' + (cy + 12).toFixed(0) + '" fill="#C9D3E3" font-family="Inter" font-size="11" text-anchor="middle">' + esc(b.name) + "</text></g>";
    });
    return h + "</svg>";
  }

  function renderDashboard() {
    var d = D(), e = d.estate, alerts = d.alerts;
    var h = '<div class="screen fade">';
    h += '<div class="h2">' + esc(e.name) + '</div><div class="small muted">Walla Walla AVA · 6 blocks · ' + U.fmtNum(e.totalDocs) + " indexed documents</div>";
    h += '<div class="kpis" style="margin-top:16px">';
    var kpi = function (l, v, u, s) { return '<div class="panel kpi"><div class="l">' + l + '</div><div class="v">' + v + (u ? '<span class="small muted"> ' + u + "</span>" : "") + '</div><div class="s">' + s + "</div></div>"; };
    h += kpi("Avg Moisture", e.avgMoisture, "%", "Across all blocks") + kpi("Avg Soil Temp", e.avgTemp, "°C", "6-inch depth") + kpi("Total Records", U.fmtNum(e.totalDocs), "", "5 indices");
    h += kpi("Active Alerts", alerts.filter(function (a) { return a.severity !== "info"; }).length, "", alerts.filter(function (a) { return a.severity === "critical"; }).length + " critical");
    h += "</div>";
    h += '<div class="grid" style="grid-template-columns:5fr 7fr;margin-top:16px">';
    h += '<div class="panel pad"><div class="eyebrow">Estate Overview</div><div class="map" style="margin-top:10px">' + miniMap("invBlock", function (b) {
      var st = blockStatus(d.summaries[b.id].soil.m); return { fill: COLORS[st], stroke: COLORS[st], op: 0.4 };
    }) + '</div><button class="chip" data-act="scene" data-scene="map" style="margin-top:8px">Open Vineyard map &rarr;</button></div>';
    h += '<div><div class="eyebrow">Block Status</div><div class="blocks" style="margin-top:10px">';
    d.blocks.forEach(function (b) {
      var sm = d.summaries[b.id], st = blockStatus(sm.soil.m);
      h += '<button class="bcard ' + (st === "healthy" ? "" : st) + '" data-act="invBlock" data-block="' + b.id + '">';
      h += '<div class="top"><span>' + b.id + '</span><span class="dot' + (st === "alert" ? " pulse" : "") + '" style="background:' + COLORS[st] + '"></span></div>';
      h += '<div class="nm">' + esc(b.name) + '</div><div class="vr">' + esc(b.short) + "</div>";
      h += '<div class="m"><div><small>MOIST</small><span style="color:' + (sm.soil.m < 25 ? COLORS.alert : sm.soil.m > 45 ? COLORS.blue : COLORS.healthy) + '">' + sm.soil.m.toFixed(1) + "%</span></div><div><small>TEMP</small>" + sm.soil.t6.toFixed(1) + '°</div><div><small>EC</small><span style="color:' + (sm.soil.ec > 0.6 ? COLORS.watch : "inherit") + '">' + sm.soil.ec.toFixed(2) + "</span></div></div></button>";
    });
    h += "</div></div></div>";
    h += '<div class="grid" style="grid-template-columns:7fr 5fr;margin-top:16px"><div><div class="row" style="justify-content:space-between;align-items:center"><div class="eyebrow pk">Alerts &amp; Anomalies</div>' + V.stagedTag("Alerts hardcoded") + '</div><div style="margin-top:10px">';
    alerts.forEach(function (a, i) {
      h += '<button class="alertrow ' + a.severity + '" data-act="invAlert" data-i="' + i + '"><div class="t"><span>' + esc(a.title) + '</span><span class="badge ' + (a.severity === "critical" ? "crit" : a.severity === "warning" ? "warn" : "info") + '">' + a.severity.toUpperCase() + '</span></div><div class="m">' + esc(a.message) + '</div><div class="tiny muted" style="margin-top:4px">' + a.block + " · " + a.time + "</div></button>";
    });
    h += '</div></div><div><div class="eyebrow tl">Quick Investigate</div><div style="margin-top:10px">';
    d.quickInvestigate.forEach(function (q, i) { h += '<button class="qbtn" data-act="quick" data-i="' + i + '">' + esc(q) + "</button>"; });
    h += "</div></div></div>";
    return h + "</div>";
  }

  function mapColor(b) {
    var s = D().summaries[b.id], m = s.soil.m, t = s.soil.t6, k = s.npk.k, hl = s.health;
    var hs = COLORS[hl];
    switch (S.mapMode) {
      case "moisture": return m < 25 ? { fill: COLORS.alert, op: 0.45, stroke: hs } : m < 32 ? { fill: COLORS.watch, op: 0.35, stroke: hs } : m < 42 ? { fill: COLORS.healthy, op: 0.35, stroke: hs } : { fill: COLORS.blue, op: 0.35, stroke: hs };
      case "temperature": return t < 14 ? { fill: COLORS.blue, op: 0.35, stroke: hs } : t < 18 ? { fill: COLORS.healthy, op: 0.35, stroke: hs } : t < 22 ? { fill: COLORS.watch, op: 0.35, stroke: hs } : { fill: COLORS.alert, op: 0.35, stroke: hs };
      case "potassium": return k < 100 ? { fill: COLORS.alert, op: 0.45, stroke: COLORS.alert } : k < 150 ? { fill: COLORS.watch, op: 0.35, stroke: COLORS.watch } : { fill: COLORS.healthy, op: 0.35, stroke: hs };
      default: return { fill: hs, op: hl === "healthy" ? 0.25 : hl === "watch" ? 0.3 : 0.4, stroke: hs };
    }
  }

  function renderMap() {
    var d = D();
    var h = '<div class="screen fade"><div class="row" style="justify-content:space-between;align-items:flex-end;flex-wrap:wrap"><div><div class="h2">Vineyard Map</div><div class="small muted">' + esc(d.estate.name) + " · offline tiles</div></div>";
    h += '<div class="modes">' + [["health", "Health"], ["moisture", "Moisture"], ["temperature", "Temp"], ["potassium", "K Level"]].map(function (m) {
      return '<button class="chip' + (S.mapMode === m[0] ? " on" : "") + '" data-act="mapMode" data-mode="' + m[0] + '">' + m[1] + "</button>";
    }).join("") + "</div></div>";
    h += '<div class="mapwrap" style="margin-top:14px"><div class="panel map">' + miniMap("selBlock", mapColor, { showSel: true }) + '<div class="mono tiny muted" style="padding:6px 10px">Mock map: polygons from routers/vineyard.py, no tiles. Kit: Leaflet + CartoDB Dark Matter tiles.</div></div>';
    h += '<div class="panel pad">';
    if (!S.selected) h += '<div class="eyebrow">Block detail</div><p class="small muted" style="margin-top:10px">Click a block to see soil, NPK, harvest and its story.</p>';
    else {
      var b = d.blocks.filter(function (x) { return x.id === S.selected; })[0], s = d.summaries[b.id];
      h += '<div class="eyebrow" style="color:' + COLORS[s.health] + '">' + b.id + " · " + s.health + '</div><div class="h3" style="font-size:19px;margin-top:6px">' + esc(b.name) + '</div><div class="small muted">' + esc(b.variety) + " · " + b.acres + " ac · " + b.elev + " m · " + b.aspect + " · " + esc(b.soil) + "</div>";
      h += '<div class="eyebrow" style="margin-top:14px">Soil</div><dl class="kv" style="margin-top:6px"><dt>Moisture</dt><dd>' + s.soil.m + "%</dd><dt>Temp 6in</dt><dd>" + s.soil.t6 + "°C</dd><dt>Temp 12in</dt><dd>" + s.soil.t12 + "°C</dd><dt>EC</dt><dd>" + s.soil.ec + " dS/m</dd></dl>";
      h += '<div class="eyebrow" style="margin-top:12px">NPK</div><dl class="kv" style="margin-top:6px"><dt>N</dt><dd>' + s.npk.n + " mg/kg</dd><dt>P</dt><dd>" + s.npk.p + ' mg/kg</dd><dt>K</dt><dd style="color:' + (s.npk.k < 100 ? COLORS.alert : "inherit") + '">' + s.npk.k + " mg/kg</dd><dt>pH</dt><dd>" + s.npk.ph + "</dd></dl>";
      h += '<div class="eyebrow" style="margin-top:12px">Latest harvest</div><div class="small" style="margin-top:6px">' + s.harvest.year + " · " + U.fmtNum(s.harvest.kg) + " kg · " + s.harvest.brix + " brix · quality " + s.harvest.q + "</div>";
      if (s.alerts.length) h += '<div style="margin-top:10px">' + s.alerts.map(function (a) { return '<div class="small" style="color:var(--pink)">&#9888; ' + esc(a) + "</div>"; }).join("") + "</div>";
      h += '<p class="small" style="color:var(--char);margin-top:10px">' + esc(b.story) + "</p>";
      h += '<button class="btn teal" data-act="invBlock" data-block="' + b.id + '" style="width:100%;justify-content:center;margin-top:8px">Investigate with AI</button>';
    }
    return h + "</div></div></div>";
  }

  function phaseDetail(p) {
    var x = p.data, h = '<div class="det">';
    if (p.id === "sensors") {
      h += '<div class="sens">' + [["Moisture", x.moisture + "%"], ["Temp", x.temperature + "°C"], ["N", x.nitrogen], ["P", x.phosphorus], ["K", x.potassium], ["pH", x.ph]].map(function (m) { return "<div><small>" + m[0] + "</small>" + m[1] + "</div>"; }).join("") + "</div>";
    } else if (p.id === "historical") {
      h += x.matches.slice(0, 3).map(function (m) { return '<div class="small" style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--line);padding:4px 0"><span>' + esc(m.title) + '</span><span class="mono teal">' + m.similarity.toFixed(2) + "</span></div>"; }).join("");
      h += '<p class="small" style="margin:6px 0 0">' + esc(x.pattern_summary) + "</p>";
    } else if (p.id === "risk") {
      h += '<div class="small">Overall risk <span class="badge ' + (x.overall_risk === "low" ? "live" : x.overall_risk === "medium" ? "warn" : "crit") + '">' + x.overall_risk.toUpperCase() + "</span></div>";
      h += x.risks.map(function (r) { return '<div class="risk small"><span class="badge ' + (r.severity === "critical" || r.severity === "high" ? "crit" : r.severity === "medium" ? "warn" : "live") + '">' + r.severity.toUpperCase() + "</span><span>" + esc(r.description) + "</span></div>"; }).join("");
    } else if (p.id === "recommendation") {
      h += x.recommendations.map(function (r) { return '<div class="small" style="margin:5px 0"><b>' + esc(r.action) + '</b> <span class="mono tiny ' + (r.priority === "urgent" ? "pink" : r.priority === "high" ? "yellow" : "blue") + '">[' + r.priority.toUpperCase() + ']</span><div class="muted">' + esc(r.rationale) + "</div></div>"; }).join("");
    } else if (p.id === "action_plan") {
      h += x.actions.map(function (a, i) { return '<div class="small" style="margin:5px 0;display:flex;gap:8px"><span class="mono teal">' + (i + 1) + ".</span><div><b>" + esc(a.task) + '</b><div class="muted">' + esc(a.assignee) + " · " + esc(a.deadline) + (a.equipment ? " · " + esc(a.equipment) : "") + "</div></div></div>"; }).join("");
      if (x.estimated_cost) h += '<div class="small muted">Estimated cost: ' + esc(x.estimated_cost) + "</div>";
    }
    return h + "</div>";
  }
  function phaseCard(p) {
    var badge = p.status === "running" ? '<span class="spin"></span>' : p.status === "complete" ? '<span class="badge live">Done</span>' : '<span class="badge" style="color:var(--grey-l)">Pending</span>';
    var h = '<div class="phase ' + p.status + '"><div class="ic">' + p.ic + '</div><div><div class="hd">' + esc(p.name) + " " + badge + "</div>";
    if (p.status === "running" && p.messages.length) h += '<div class="msg">' + esc(p.messages[p.messages.length - 1]) + "</div>";
    if (p.status === "complete" && p.data) h += phaseDetail(p);
    return h + "</div></div>";
  }

  function renderChat() {
    var d = D(), c = S.chat, v = S.viewing;
    var h = '<div class="screen fade" style="max-width:980px"><div class="row" style="justify-content:space-between;align-items:center"><div><div class="h2">AI Agronomist</div><div class="small muted">Multi-phase agentic advisor · Elastic + LLM pipeline</div></div><div class="row" style="gap:8px;align-items:center">';
    if (c.status === "running") h += '<span class="mono small"><span class="spin"></span> <span id="chat-elapsed">' + c.elapsed + "s</span></span>";
    if (c.status === "done" || v) h += '<button class="btn sm ghost" data-act="newQuery">New Query</button>';
    h += "</div></div>";
    if (c.status === "running") {
      var pct = c.phases.reduce(function (a, p) { return Math.max(a, p.pct); }, 0);
      h += '<div class="progline" style="margin-top:12px"><i style="width:' + pct + '%"></i></div>';
    } else h += '<div style="height:15px"></div>';

    if (v) {
      h += '<div class="qbubble">' + esc(v.query) + "</div>" + v.phases.map(phaseCard).join("");
      h += '<div class="summary"><div class="mono small teal">&#10003; Analysis Complete · ' + v.elapsed + 's</div><p class="small" style="margin:6px 0 0">' + esc(v.results.summary) + "</p></div>";
      h += '<button class="chip" data-act="rerun" style="margin-top:10px">Re-run this investigation</button>';
    } else if (c.status === "idle") {
      h += '<div class="center" style="margin:18px 0"><div class="h3" style="font-size:18px">Ask about your vineyard</div><p class="small muted">5-phase agentic pipeline: sensor data, historical context, risk analysis, recommendations, and action plan.</p></div>';
      h += '<div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">' + d.chips.map(function (q, i) { return '<button class="qbtn" data-act="chip" data-i="' + i + '">' + esc(q) + "</button>"; }).join("") + "</div>";
      var hist = loadConvs();
      if (hist.length) {
        h += '<div class="eyebrow" style="margin-top:18px">Recent Investigations</div><div style="margin-top:8px">';
        hist.slice(0, 8).forEach(function (cv, i) { h += '<button class="qbtn" data-act="viewConv" data-i="' + i + '"><div>' + esc(cv.query) + '</div><div class="mono tiny muted">' + cv.elapsed + "s · " + new Date(cv.timestamp).toLocaleDateString() + "</div></button>"; });
        h += "</div>";
      }
    } else {
      h += '<div class="qbubble">' + esc(c.query) + "</div>" + c.phases.map(phaseCard).join("");
      if (c.results) h += '<div class="summary fade"><div class="mono small teal">&#10003; Analysis Complete · ' + c.elapsed + 's</div><p class="small" style="margin:6px 0 0">' + esc(c.results.summary) + "</p></div>";
      if (c.closed && app().coachOn()) h += '<div class="small" style="margin-top:8px;color:var(--pink)">[coach view] Stream closed without job_complete after the 120 s LLM timeout. The kit UI shows nothing more; it stays "running".</div>';
    }
    h += '<form data-submit="ask" class="row" style="margin-top:16px;gap:8px"><input id="chat-input" class="input" data-model="chatInput" value="' + esc(S.input) + '" placeholder="Ask about soil, irrigation, disease risk, crop management..." autocomplete="off"><button class="btn teal" type="submit"' + (c.status === "running" ? " disabled" : "") + ">Send</button></form>";
    if (app().coachOn() && c.status !== "idle" && !v) h += '<p class="tiny muted" style="margin-top:8px">Mock: ' + (c.blockId ? "block " + c.blockId + " passed to Phase 0." : "no block_id sent, so Phase 0 used the latest block (" + (app().drill() === "none" || app().drill() === "llm" ? d.latestBlock : "BLK-C mock") + ").") + " Pace: " + (app().pace() === "fast" ? "4x pace" : "Kit") + ".</p>";
    return h + "</div>";
  }

  function renderSearch() {
    var s = S.search;
    var h = '<div class="screen fade" style="max-width:960px"><div class="row" style="justify-content:space-between;align-items:center"><div class="h2">Search Playground</div>' + V.stagedTag("Always canned fallback") + '</div><p class="small muted">Hybrid retrieval across all vineyard indices · 615K+ vectors</p>';
    h += '<form data-submit="search" class="row" style="gap:8px;margin-top:12px"><input id="search-input" class="input" data-model="searchInput" value="' + esc(s.query) + '" placeholder="blocks showing drought stress similar to 2012 conditions" autocomplete="off"><button class="btn teal" type="submit">' + (s.loading ? "Searching..." : "Search") + "</button></form>";
    h += '<div class="row" style="gap:6px;margin-top:10px">' + [["bm25", "BM25"], ["semantic", "Semantic"], ["hybrid", "Hybrid (RRF)"]].map(function (m) { return '<button class="chip' + (s.mode === m[0] ? " on" : "") + '" data-act="searchMode" data-mode="' + m[0] + '">' + m[1] + "</button>"; }).join("") + "</div>";
    if (s.latency) h += '<div class="mono tiny muted" style="margin-top:10px">embed ' + s.latency.embed + "ms · search " + s.latency.search + "ms · total " + s.latency.total + "ms</div>";
    if (s.results) h += '<div style="margin-top:10px">' + s.results.map(function (r, i) { return '<div class="hit fade"><div class="row" style="justify-content:space-between"><b>' + (i + 1) + ". " + esc(r.title) + '</b><span class="mono teal small">' + r.score.toFixed(3) + '</span></div><div class="small" style="color:var(--char);margin-top:4px">' + esc(r.snippet) + '</div><div class="mono tiny muted" style="margin-top:4px">' + r.index + " · " + r.source + "</div></div>"; }).join("") + "</div>";
    return h + "</div>";
  }

  function renderScanner() {
    var s = S.scan, L = D().leaf;
    var h = '<div class="screen fade" style="max-width:960px"><div class="row" style="justify-content:space-between;align-items:center"><div class="h2">Crop Health Scanner</div>' + V.stagedTag("100% canned") + '</div><p class="small muted">Image similarity search · 15K+ grape disease embeddings · kNN on CLIP vectors</p>';
    h += '<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:14px"><div class="panel pad center" style="min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px">';
    h += s.name ? '<svg viewBox="0 0 120 120" width="120" height="120"><path d="M60 10 C 100 30, 105 85, 60 110 C 15 85, 20 30, 60 10 Z" fill="#2E7D4F"/><path d="M60 14 L60 106" stroke="#1B4D30" stroke-width="2"/><circle cx="45" cy="55" r="7" fill="#5A2E1A"/><circle cx="72" cy="70" r="5" fill="#5A2E1A"/><circle cx="66" cy="40" r="4" fill="#5A2E1A"/></svg><div class="mono tiny muted">' + esc(s.name) + "</div>" : '<div class="small muted">Upload a leaf photo</div>';
    h += '<label class="btn sm ghost" style="cursor:pointer">Upload image<input type="file" accept="image/*" data-ch="leafFile" style="display:none"></label><button class="chip" data-act="sampleLeaf">Use sample leaf</button></div><div>';
    if (s.loading) h += '<div class="panel pad small"><span class="spin"></span> Analyzing image...</div>';
    else if (s.result) {
      h += '<div class="panel pad alert fade"><div class="h3" style="font-size:22px;color:var(--pink)">' + L.classification + '</div><div class="small muted">' + (L.confidence * 100).toFixed(1) + "% confidence · " + L.similarCount + " similar cases</div>";
      h += '<div class="eyebrow" style="margin-top:12px">Affected Blocks</div><div class="row" style="gap:6px;margin-top:6px">' + L.affectedBlocks.map(function (b) { return '<span class="chip">' + b + "</span>"; }).join("") + "</div>";
      h += '<div class="eyebrow" style="margin-top:12px">Recommendation</div><p class="small" style="color:var(--char)">' + esc(L.recommendation) + "</p>";
      h += '<div class="eyebrow" style="margin-top:8px">Similar Images (kNN)</div><div class="row" style="gap:6px;margin-top:6px">' + L.similar.map(function (sc) { return '<div style="flex:1;border:1px solid var(--line);height:52px;display:flex;align-items:flex-end;justify-content:center;background:#132a1e" class="mono tiny">' + sc.toFixed(2) + "</div>"; }).join("") + "</div></div>";
    }
    return h + "</div></div></div>";
  }

  function renderOverview() {
    var h = '<div class="screen fade"><div class="row" style="justify-content:space-between;align-items:center"><div class="h2">System Overview</div>' + (app().coachOn() ? '<span class="badge crit">Stale: do not present</span>' : "") + '</div><p class="small muted">Everything you just saw is running from a Pelican case</p>';
    h += '<div class="kpis" style="margin-top:14px">' + [["AI Compute", "1 PFLOP", "Blackwell GPU"], ["Vectors Indexed", "615K+", "GPU: ~22s / CPU: ~150s"], ["Search Latency", "<50ms", "Hybrid RRF (BM25 + kNN)"], ["Connectivity", "Zero", "Fully airgapped"]].map(function (s) {
      return '<div class="panel kpi"><div class="l">' + s[0] + '</div><div class="v">' + esc(s[1]) + '</div><div class="s">' + esc(s[2]) + "</div></div>";
    }).join("") + "</div>";
    h += '<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:14px">';
    h += '<div class="panel pad"><b>Framework Desktop</b> <span class="mono tiny muted">192.168.1.10</span><ul class="small" style="color:var(--char)"><li>FastAPI Backend (:8000)</li><li>React Frontend (:3000)</li><li>Sensor Data Ingestion (RS485)</li></ul></div>';
    h += '<div class="panel pad"><b>NVIDIA DGX Spark</b> <span class="mono tiny muted">192.168.1.20</span><ul class="small" style="color:var(--char)"><li>Elasticsearch GPU (:9200) — cuVS</li><li>Elasticsearch CPU (:9201)</li><li>Ollama — Nemotron 3.5 Lightning (:11434)</li><li>Jina Embeddings v5 Omni (:8081)</li><li>128GB Unified Memory</li></ul></div></div>';
    h += '<div class="center" style="margin-top:22px"><button class="btn ghost" data-act="resetDemo">&#8634; Reset Demo</button></div>';
    return h + "</div>";
  }

  // ---------- actions ----------
  var actions = {
    toIntro: function () { app().go(1); },
    toRace: function () { app().go(2); },
    raceStart: function () { S.race.start(); },
    raceReset: function () { S.race.reset(); },
    raceContinue: function () { app().go(3); },
    scene: function (el) { goScene(el.getAttribute("data-scene")); },
    invBlock: function (el) { investigateBlock(el.getAttribute("data-block")); },
    selBlock: function (el) { S.selected = el.getAttribute("data-block"); app().refresh(); },
    invAlert: function (el) { var a = D().alerts[+el.getAttribute("data-i")]; investigateBlock(a.block, a.title + " — " + a.message); },
    quick: function (el) { investigate(D().quickInvestigate[+el.getAttribute("data-i")]); },
    chip: function (el) { if (S.chat.status === "running") return; startChat(D().chips[+el.getAttribute("data-i")], null); app().refresh(); },
    ask: function () { var q = (S.input || "").trim(); if (!q || S.chat.status === "running") return; S.input = ""; startChat(q, null); app().refresh(); },
    newQuery: function () { S.timers.cancel(); S.chat = idleChat(); S.viewing = null; app().refresh(); },
    viewConv: function (el) { S.viewing = loadConvs()[+el.getAttribute("data-i")]; app().refresh(); },
    rerun: function () { var v = S.viewing; S.viewing = null; startChat(v.query, v.blockId); app().refresh(); },
    mapMode: function (el) { S.mapMode = el.getAttribute("data-mode"); app().refresh(); },
    search: function () { if (S.search.query.trim()) doSearch(S.search.query); },
    searchMode: function (el) { S.search.mode = el.getAttribute("data-mode"); app().refresh(); },
    sampleLeaf: function () { runScan("sample-leaf.jpg"); },
    leafFile: function (el) { if (el.files && el.files[0]) runScan(el.files[0].name); },
    resetDemo: function () { app().resetAdventure(); app().exit(); },
  };
  function runScan(name) { S.scan = { result: null, loading: true, name: name }; app().refresh(); S.timers.later(1200, function () { S.scan.loading = false; S.scan.result = D().leaf; if (curStep().screen === "scanner") app().refresh(); }); }
  function model(k, v) { if (k === "chatInput") S.input = v; if (k === "searchInput") S.search.query = v; }

  M.screens.vineyard = { init: init, enter: enter, reset: reset, leave: leave, render: render, actions: actions, model: model };
})();
