/* SEC Findings deck. Mirrors components/sec/SecDeck.tsx: 8 chapters, chips, arrows, Esc, digits 0-5. */
(function () {
  var M = window.MOCK, U = M.util, esc = U.esc;
  var D = function () { return M.data.sec; };
  var app = function () { return M.app; };
  var V = function () { return M.views; };
  var S = null;

  function init() {
    S = {
      race: new M.Race(function () {
        var m = S.race.metrics();
        if (m.gpu.complete && !S.popupShown) { S.popup = true; S.popupShown = true; }
        if (ch() === 1 || ch() === 2) app().refresh();
      }),
      popup: false, popupShown: false, ptab: "why", tab2: "throughput", assumptions: false,
      s3: { query: "", picked: [], result: null, loading: false, error: null, tab: "curl" },
      s4: { input: "", events: [], status: "idle", q: null, t0: 0 },
      timers: new U.Timers(),
    };
  }
  function ch() { return D().steps[app().A.step].ch; }

  function enter(step, p) {
    var c = D().steps[step].ch;
    if (c === 1 || c === 2) {
      if (p.race === "mid" || p.race === "end") { S.popupShown = p.race === "end"; S.popup = false; S.race.jump(p.race); if (p.race === "mid") { S.popup = true; S.popupShown = true; } }
    }
    if (c === 4 && p.q != null) runSearch(D().exampleSearches[+p.q] || D().exampleSearches[0], p.run === "end");
    if (c === 5 && p.q != null) runAgent(D().exampleAgent[+p.q] || D().exampleAgent[0], p.run === "end");
  }
  function reset() { S.race.reset(true); S.race.timers.cancel(); S.timers.cancel(); }

  // ---------- chapter 03 search ----------
  function runSearch(q, instant) {
    var drill = app().drill();
    S.s3.query = q; S.s3.loading = true; S.s3.error = null;
    var done = function () {
      S.s3.loading = false;
      if (drill === "search") { S.s3.error = "502 · Query embed failed"; S.s3.result = null; }
      else if (drill === "es") { S.s3.error = "500 · Internal Server Error (Elasticsearch unreachable)"; S.s3.result = null; }
      else {
        var idx = D().exampleSearches.indexOf(q); if (idx < 0) idx = Math.abs(hash(q)) % 5;
        var hits = D().hitSets[idx].map(function (h, i) { return { ticker: h[0], company: h[1], sector: h[2], score: D().hitScores[i], fy: 2025, acc: "acc-mock-" + (idx * 10 + i + 1) }; });
        if (S.s3.picked.length) hits = hits.filter(function (h) { return S.s3.picked.indexOf(h.sector) >= 0; });
        S.s3.result = { hits: hits, took: 70 + (Math.abs(hash(q)) % 28) };
      }
      if (ch() === 4) app().refresh();
    };
    if (instant) done(); else { if (ch() === 4) app().refresh(); S.timers.later(450, done); }
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  // ---------- chapter 04 agent ----------
  function runAgent(q, instant) {
    S.timers.cancel();
    var drill = app().drill(), f = app().paceFactor(), T = D().agentTiming;
    var idx = D().exampleAgent.indexOf(q); if (idx < 0) idx = Math.abs(hash(q)) % 5;
    var run = D().agentRuns[idx];
    var a = (S.s4 = { input: "", events: [], status: "running", q: q, t0: Date.now() });
    var evs = []; var t = 0;
    var push = function (dt, e) { t += dt; evs.push([t, e]); };
    if (drill === "llm") {
      // F9: no read timeout. Nothing ever arrives; the spinner runs until someone resets.
    } else {
      push(T.firstReason, { type: "reasoning", text: run.tools[0].reason });
      run.tools.forEach(function (tl, i) {
        if (i > 0) push(T.perTool / 2, { type: "reasoning", text: tl.reason });
        push(2, { type: "tool_call", tool: tl.tool, params: tl.params });
        push(T.perTool / 2, drill === "es" ? { type: "tool_result", error: "search_phase_execution_exception: all shards failed" } : { type: "tool_result", rows: tl.rows, tool: tl.tool });
      });
      if (drill === "es") push(T.answerStart, { type: "answer", text: "### Unable to answer\n- The tools could not reach the sec_10k_2026 index. Please try again later." });
      else push(T.answerStart, { type: "answer", text: run.answer });
      push(T.answerDur, { type: "done" });
    }
    if (instant) { evs.forEach(function (e) { apply(a, e[1]); }); if (!evs.length) a.status = "running"; return; }
    evs.forEach(function (e) { S.timers.later(e[0] * 1000 * f, function () { if (S.s4 === a) { apply(a, e[1]); if (ch() === 5) app().refresh(); } }); });
    var tick = function () { if (S.s4 !== a || a.status !== "running") return; var el = document.getElementById("agent-elapsed"); if (el) el.textContent = Math.round((Date.now() - a.t0) / 1000) + "s"; S.timers.later(1000, tick); };
    S.timers.later(1000, tick);
  }
  function apply(a, e) {
    if (e.type === "done") { a.status = "done"; a.elapsed = Math.round((Date.now() - a.t0) / 1000); return; }
    a.events.push(e);
  }

  // ---------- markdown-lite for canned answers ----------
  function md(s) {
    var out = "", inList = false;
    s.split("\n").forEach(function (line) {
      if (/^### /.test(line)) { if (inList) { out += "</ul>"; inList = false; } out += "<h4>" + esc(line.slice(4)) + "</h4>"; }
      else if (/^- /.test(line)) { if (!inList) { out += "<ul>"; inList = true; } out += "<li>" + esc(line.slice(2)).replace(/\[([^\]]+)\]/g, '<span class="chip" style="min-height:0;padding:1px 6px;font-size:10.5px">$1</span>') + "</li>"; }
      else if (line.trim()) out += "<p>" + esc(line) + "</p>";
    });
    return out + (inList ? "</ul>" : "");
  }

  // ---------- render ----------
  function render() {
    var d = D(), cur = ch();
    var h = '<div class="deck"><div class="chips">';
    d.chapters.forEach(function (c, i) {
      var si = stepForCh(i);
      h += '<button data-act="goch" data-i="' + si + '" class="' + (i === cur ? "on" : "") + '"><b>' + c.number + "</b>" + esc(c.short) + "</button>";
    });
    h += '<span style="flex:1"></span><button data-act="exitDeck" title="Exit (Esc)">&#10005; Exit</button></div><div class="screen fade">';
    h += [ch00, ch01, ch02, ch025, ch03, ch04, ch045, ch05][cur]();
    h += '<div class="row" style="justify-content:space-between;margin-top:26px"><button class="btn sm ghost" data-act="prevch"' + (cur === 0 ? " disabled" : "") + '>&larr; Prev</button><button class="btn sm" data-act="nextch"' + (cur === 7 ? " disabled" : "") + ">Next &rarr;</button></div>";
    h += "</div></div>";
    if (S.popup && (cur === 1)) h += popup();
    return h;
  }
  function stepForCh(c) { var st = D().steps; for (var i = 0; i < st.length; i++) if (st[i].ch === c) return i; return 0; }
  function shell(num, title, sub) {
    return '<div class="eyebrow">Chapter ' + num + '</div><h1 class="h1">' + esc(title) + '</h1><p class="lede">' + esc(sub) + "</p>";
  }

  function ch00() {
    var hw = D().hardware;
    var card = function (k, gpu) {
      var x = hw[k];
      var rows = gpu
        ? [["CPU", "GB10 Arm CPU", "aarch64"], ["Memory", "128 GB", "unified CPU + GPU memory"], ["GPU", "NVIDIA GB10 Blackwell", "cuVS GPU vector indexing"], ["Role", "es-gpu · Ollama · Jina", "Nemotron 3.5 Lightning :11434 · Jina Embeddings v5 Omni :8081"]]
        : [["CPU", "AMD Ryzen AI Max+ 395", "x86_64"], ["Memory", "64 GB", "system memory"], ["GPU", "not used for indexing", "CPU-only baseline"], ["Role", "es-cpu · Kibana 9.5.6", "Agent Builder · backend :8000 · frontend :3000"]];
      var cfg = [["node.name", x.node], ["node.attr.accel", x.accel], ["vectors.indexing.use_gpu", gpu ? "true" : "false"], ["index_options.type", "hnsw"], ["dense_vector.dims", "768"], ["JVM heap", x.heap]];
      var h = '<div class="panel pad ' + (gpu ? "hot" : "cpu") + '"><div class="eyebrow ' + (gpu ? "tl" : "yl") + '">' + (gpu ? "GPU · Accelerated" : "CPU · Baseline") + '</div><div class="h2">' + x.label + '</div><div class="mono tiny muted">' + x.ip + " · " + esc(x.note) + "</div>";
      h += '<table class="t" style="margin-top:10px">' + rows.map(function (r) { return "<tr><th>" + r[0] + "</th><td><b>" + esc(r[1]) + '</b> <span class="muted">' + esc(r[2]) + "</span></td></tr>"; }).join("") + "</table>";
      h += '<div class="eyebrow" style="margin-top:12px">Elasticsearch 9.5.6 config</div><table class="t">' + cfg.map(function (r) { return '<tr><td class="mono">' + r[0] + '</td><td class="mono" style="color:' + (r[0] === "vectors.indexing.use_gpu" ? (gpu ? "var(--teal)" : "var(--yellow)") : "inherit") + '">' + r[1] + "</td></tr>"; }).join("") + "</table></div>";
      return h;
    };
    var h = shell("00", "The Hardware Face-Off", "Two nodes in one airgapped case, one Elasticsearch 9.5.6 cluster, the same index. One node has a GPU, one does not. This is what we're racing.");
    h += '<div class="hw" style="margin-top:20px">' + card("cpu", false) + card("gpu", true) + "</div>";
    h += '<div class="heads" style="margin-top:16px;grid-template-columns:repeat(5,1fr)">' + [["Hardware delta", "+ NVIDIA GB10 GPU", "aarch64 Spark vs x86_64 Framework"], ["Where it runs", "Inside the case", "No cloud account, no internet, no per-hour bill"], ["Config delta", "vectors.indexing.use_gpu", "true vs false: that's it"], ["ES version", "9.5.6 · identical", "One cluster, two data nodes"], ["What we're measuring", "Ingest + force-merge", "Same documents, same mapping, both nodes"]].map(function (x) { return '<div class="panel pad stat"><div class="l">' + esc(x[0]) + '</div><div class="v" style="font-size:15px">' + esc(x[1]) + '</div><div class="tiny muted">' + esc(x[2]) + "</div></div>"; }).join("") + "</div>";
    return h;
  }

  function ch01() {
    var m = S.race.metrics(), running = m.status === "running";
    var h = shell("01", "Indexing Speed", "Watch a live, real-time race between standard CPU-based HNSW indexing and GPU-accelerated CAGRA indexing on identical data sets.");
    h += '<div class="row" style="gap:8px;margin-top:14px;align-items:center">' + V().stagedTag("Staged visualization: same simulator as vineyard") + '<span style="flex:1"></span><button class="btn sm teal" data-act="raceStart"' + (running ? " disabled" : "") + '>&#9654; Start</button><button class="btn sm ghost" data-act="raceReset"' + (running ? " disabled" : "") + ">&#8634; Reset</button></div>";
    h += '<div class="race" style="margin-top:12px">' + V().raceCard(m.cpu, { label: "CPU · HNSW", hw: "Framework Desktop · Ryzen AI Max+ 395 · 192.168.1.10:9200", color: "cpu" }) + V().raceCard(m.gpu, { label: "GPU · cuVS CAGRA", hw: "DGX Spark · NVIDIA GB10 · 192.168.1.20:9200", color: "gpu" }) + "</div>";
    // Presenter panel (WhyItMatters / UseCases / ScaleProjection)
    h += '<div class="panel" style="margin-top:14px"><div class="tabs">' + [["why", "Why it matters"], ["use", "Use cases"], ["scale", "Scale projection"]].map(function (t) { return '<button data-act="ptab" data-t="' + t[0] + '" class="' + (S.ptab === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + '</div><div style="padding:14px">';
    if (S.ptab === "why") h += '<div class="heads">' + [["175 ZB", "global data by 2025", "IDC Global DataSphere Forecast"], ["90%", "of it unstructured", "IDC White Paper"], ["78%", "lower indexing TCO", "Elastic + NVIDIA Webinar 2026"]].map(function (x) { return '<div class="stat"><div class="v">' + x[0] + '</div><div class="small">' + x[1] + '</div><div class="l">' + x[2] + "</div></div>"; }).join("") + '</div><p class="small muted" style="margin:10px 0 0">5-6× price-performance. Agentic pipelines stall waiting for context.</p>';
    else if (S.ptab === "use") h += '<div class="row wrap" style="gap:6px">' + ["Document semantic search · 10-Ks, contracts, knowledge bases", "Image similarity", "Audio fingerprinting", "Molecular search", "Exploratory analysis", "Machine learning"].map(function (x) { return '<span class="chip">' + esc(x) + "</span>"; }).join("") + "</div>";
    else { var t = D().computeTco(m.cpu.throughput || 0.0001, m.gpu.throughput || 0.0001); h += '<p class="small">What does it cost when we scale this up? 10B vectors · 12h SLA.</p>' + (m.status === "complete" ? '<div class="mono small">CPU ' + t.cpuNodes.toFixed(1) + " nodes · GPU " + t.gpuNodes.toFixed(1) + " nodes</div>" : '<div class="small muted">Run the race to project.</div>'); }
    h += "</div></div>";
    if (m.status === "complete") {
      h += '<div class="heads fade" style="margin-top:14px;grid-template-columns:repeat(3,1fr)">';
      [["Ingest speedup", m.ingestSpeedup.toFixed(1) + "×"], ["Force-merge speedup", m.forceMergeSpeedup.toFixed(1) + "×"], ["End-to-end", m.speedup.toFixed(1) + "×"], ["Runs on", "The kit", "both nodes inside the case"], ["Cloud bill · this job", "None", "no per-hour or per-token billing"], ["Recall (GPU / CPU)", m.recallGpu.toFixed(1) + "% / " + m.recallCpu.toFixed(1) + "%"]].forEach(function (x, i) {
        h += '<div class="panel pad stat' + (i === 4 ? " hot" : "") + '"><div class="l">' + esc(x[0]) + '</div><div class="v" style="font-size:22px">' + esc(x[1]) + "</div>" + (x[2] ? '<div class="tiny muted">' + esc(x[2]) + "</div>" : "") + "</div>";
      });
      h += "</div>";
    }
    return h;
  }
  function popup() {
    var m = S.race.metrics();
    var h = '<div class="backdrop" style="position:fixed;inset:0;background:rgba(5,10,30,.6);z-index:30;display:flex;align-items:center;justify-content:center" data-act="closePopup">';
    h += '<div class="panel pad hot" style="max-width:520px;width:90%"><div class="eyebrow tl">GPU finished</div><div class="h2">' + U.fmtDur(m.gpu.elapsedMs) + " for " + U.fmtNum(m.gpu.docsIndexed) + ' vectors</div>';
    h += '<p class="small" style="color:var(--char)">' + (m.cpu.complete ? "CPU finished in " + U.fmtDur(m.cpu.elapsedMs) + "." : (m.cpu.phase === "force_merging" ? "CPU still force-merging on Lucene…" : "CPU still working…") + " " + U.fmtNum(m.cpu.docsIndexed) + " of " + U.fmtNum(m.cpu.totalDocs) + ".") + "</p>";
    h += '<div class="bar cpu"><i style="width:' + (m.cpu.totalDocs ? m.cpu.docsIndexed / m.cpu.totalDocs * 100 : 0) + '%"></i></div>';
    h += '<div style="margin-top:14px;text-align:right"><button class="btn sm teal" data-act="closePopup">Close</button></div></div></div>';
    return h;
  }

  function ch02() {
    var m = S.race.metrics();
    var h = shell("02", "Side-by-Side", "Direct comparison of Elastic accelerated with NVIDIA cuVS versus the baseline. Observe the dramatic difference in force-merge latency and CPU utilization.");
    h += '<div class="panel" style="margin-top:16px"><div class="tabs">' + [["throughput", "Throughput"], ["e2e", "E2e Workflow"], ["arch", "Architecture"]].map(function (x) { return '<button data-act="tab2" data-t="' + x[0] + '" class="' + (S.tab2 === x[0] ? "on" : "") + '">' + x[1] + "</button>"; }).join("") + '</div><div style="padding:16px">';
    if (S.tab2 === "throughput") {
      h += '<div class="eyebrow">Indexing throughput · vectors/sec</div>';
      if (m.gpu.history.length) h += '<div class="spark" style="height:180px;margin:10px 0 8px">' + U.spark([{ pts: m.cpu.history, color: "#FEC514" }, { pts: m.gpu.history, color: "#48EFCF" }], { grid: true, maxX: 55, minY: 0 }) + '</div><div class="mono tiny"><span class="teal">&#9632; GPU · cuVS CAGRA</span> &nbsp; <span class="yellow">&#9632; CPU · HNSW</span> &nbsp; ' + V().stagedTag("From the staged race") + "</div>";
      else h += '<p class="small muted">No race history yet. Run chapter 01 first.</p>';
    } else if (S.tab2 === "e2e") {
      h += '<div class="eyebrow">E2e indexing workflow</div><div class="row wrap" style="gap:8px;margin-top:12px">' + ["Parse + store (CPU)", "CAGRA graph build (GPU)", "Convert to HNSW", "Index merge (GPU)", "Serve search (CPU)"].map(function (x, i) { return (i ? '<span class="muted">&rarr;</span>' : "") + '<span class="chip' + (/GPU/.test(x) ? " on" : "") + '">' + x + "</span>"; }).join("") + '</div><p class="small muted" style="margin-top:10px">Offload graph build + merge to the GPU; segments stay HNSW for CPU-served search.</p>';
    } else {
      h += '<div class="eyebrow">Elastic + NVIDIA cuVS stack</div><p class="small" style="color:var(--char)">cuVS runs the GPU-bound steps (CAGRA build, index merge) through cuvs-java; ES handles parsing, storage, and serving on CPU.</p><ul class="small" style="color:var(--char)"><li><b>Zero-code-change API</b>: <span class="mono">vectors.indexing.use_gpu: true</span> and ES routes graph-build to the GPU.</li><li><b>Plugin architecture</b>: JNI bridge connects ES/Lucene to a C++ backend that calls cuVS.</li><li><b>Interoperable</b>: CAGRA graphs convert to HNSW format so CPU search keeps working without changes.</li></ul><p class="small"><b>Bundled in Elasticsearch 9.5.6 on the kit.</b></p>';
    }
    h += "</div></div>";
    var dur = function (p) { return p.ingestMs || p.forceMergeMs ? ((p.ingestMs + p.forceMergeMs) / 1000).toFixed(1) + "s" : "—"; };
    h += '<div class="panel pad" style="margin-top:16px"><div class="eyebrow tl">Kit economics · everything runs in the case</div>';
    h += '<div class="heads" style="margin-top:12px;grid-template-columns:repeat(2,1fr)">' + [["CPU · Framework Desktop", dur(m.cpu)], ["GPU · DGX Spark", dur(m.gpu)]].map(function (x) { return '<div class="stat"><div class="l">' + x[0] + '</div><div class="v" style="font-size:22px">' + x[1] + '</div><div class="tiny muted">ingest + force-merge, this race</div></div>'; }).join("") + "</div>";
    h += '<div class="heads" style="margin-top:12px">' + [["Inference on the kit", "NVIDIA Nemotron 3.5 Lightning through Ollama on the DGX Spark. Agent Builder reaches it through a Kibana connector."], ["Embeddings on the kit", "Jina Embeddings v5 Omni on the DGX Spark embeds the corpus and every query."], ["Nothing leaves the case", "No cloud account, no per-hour or per-token bill. The filings, vectors and answers stay on the two nodes."]].map(function (x) { return '<div class="panel pad"><div class="h3">' + esc(x[0]) + '</div><p class="small" style="color:var(--char);margin:0">' + esc(x[1]) + "</p></div>"; }).join("") + "</div>";
    return h + "</div>";
  }

  function ch025() {
    var h = shell("—", "Elastic", "From a faster index to a faster business. The GPU shortened the build of the vector layer; now Elastic is the platform that turns it into search, agents, and workflows, all inside the case.");
    h += '<div class="heads" style="margin-top:18px">' + [["Fastest time-to-market for developers", "One API for keyword, semantic, kNN, hybrid retrieval. Standard query DSL, standard clients. No new system to maintain."], ["Speed, scale, efficiency unlock new use-cases", "GPU-built indexes make daily re-ingestion of fresh data practical on the kit itself. Faster graph builds turn 'periodic refresh' into 'always current', with no cloud bill attached."], ["Relevance is the enabler of AI agents", "Agents stall on bad retrieval. Hybrid + reranking + semantic_text via the same platform means agents get the right context, on time, every time."]].map(function (x) { return '<div class="panel pad"><div class="h3">' + esc(x[0]) + '</div><p class="small" style="color:var(--char);margin:0">' + esc(x[1]) + "</p></div>"; }).join("") + "</div>";
    h += '<div class="panel pad" style="margin-top:16px"><div class="eyebrow">One index, four interfaces</div><div class="row wrap" style="gap:8px;margin-top:10px"><span class="chip on">sec_10k_2026</span><span class="muted">&rarr;</span>' + ["Analyst search (03)", "Developer API (03)", "Agent (04)", "Workflows + dashboards (04.5)"].map(function (x) { return '<span class="chip">' + x + "</span>"; }).join("") + "</div></div>";
    h += '<div class="panel pad" style="margin-top:16px"><div class="eyebrow">The dataset behind the next two chapters</div><p class="small" style="color:var(--char)">SEC 10-K corpus · provisioned for this demo: 503 filings, 93,541 chunks, embedded with Jina Embeddings v5 Omni on the DGX Spark and bulk-loaded into the GPU-built index from chapter 01.</p>' + V().stagedTag("Kit: 768-d, not built by the race") + "</div>";
    return h;
  }

  function ch03() {
    var d = D(), s = S.s3, drill = app().drill();
    var h = shell("03", "Data Interface", "The same vectors we just indexed, queried by a developer two ways: directly via the application frontend, or programmatically against the Elasticsearch API.");
    h += '<div class="split" style="margin-top:16px"><div><div class="eyebrow tl">Analyst on the left</div>';
    h += '<form data-submit="search3" class="row" style="gap:8px;margin-top:10px"><input id="s3-input" class="input" data-model="s3" value="' + esc(s.query) + '" placeholder="Search 503 S&amp;P 500 10-K filings semantically…" autocomplete="off"><button class="btn teal" type="submit">Search</button></form>';
    h += '<div class="row wrap" style="gap:6px;margin-top:8px">' + d.exampleSearches.map(function (q, i) { return '<button class="chip" data-act="ex3" data-i="' + i + '">' + esc(q) + "</button>"; }).join("") + "</div>";
    if (drill !== "es") h += '<div class="row wrap" style="gap:4px;margin-top:8px">' + d.sectors.map(function (sc) { var on = s.picked.indexOf(sc[0]) >= 0; return '<button class="chip' + (on ? " on" : "") + '" data-act="sector" data-s="' + esc(sc[0]) + '" style="font-size:10.5px;padding:4px 8px;min-height:30px">' + esc(sc[0]) + " · " + sc[1] + "</button>"; }).join("") + "</div>";
    if (s.loading) h += '<div class="small" style="margin-top:12px"><span class="spin"></span> Searching…</div>';
    if (s.error) h += '<div class="panel pad alert" style="margin-top:12px;color:var(--pink)">' + esc(s.error) + "</div>";
    if (s.result) {
      h += '<div class="mono tiny muted" style="margin-top:12px">' + s.result.hits.length + " hits · took " + s.result.took + " ms · " + d.corpus.index + "</div>";
      h += s.result.hits.map(function (x) { return '<div class="hit fade"><div class="row" style="justify-content:space-between"><span><span class="tk">' + x.ticker + "</span> " + esc(x.company) + '</span><span class="mono small teal">' + x.score.toFixed(3) + '</span></div><div class="mono tiny muted">' + esc(x.sector) + " · 10-K FY" + x.fy + " · Item 1A Risk Factors · " + x.acc + '</div><div class="small" style="color:var(--char);margin-top:4px">Matching passage on "' + esc(s.query) + '". <span class="mockflag">Mock text: the kit shows the filing chunk.</span></div></div>'; }).join("");
    }
    h += '</div><div><div class="eyebrow">Developer on the right</div><div class="panel" style="margin-top:10px"><div class="tabs">' + [["curl", "cURL"], ["py", "Python"], ["dev", "Dev Tools"]].map(function (x) { return '<button data-act="codeTab" data-t="' + x[0] + '" class="' + (s.tab === x[0] ? "on" : "") + '">' + x[1] + "</button>"; }).join("") + "</div>";
    var body = { knn: { field: "emb", query_vector: "<768-d embedding from Jina Embeddings v5 Omni>", k: 8, num_candidates: 80 } };
    if (s.picked.length) body.knn.filter = { terms: { sector: s.picked } };
    body._source = ["ticker", "company", "sector", "fiscal_year", "accession", "text"];
    var js = JSON.stringify(body, null, 2);
    var code = s.tab === "curl" ? "curl -s -X POST \"http://es.ddil:9200/sec_10k_2026/_search\" \\\n  -H 'Content-Type: application/json' \\\n  -d '" + js + "'"
      : s.tab === "py" ? "from elasticsearch import Elasticsearch\nes = Elasticsearch(\"http://es.ddil:9200\")\nresp = es.search(index=\"sec_10k_2026\", body=" + js + ")"
        : "POST sec_10k_2026/_search\n" + js;
    h += '<div style="padding:10px"><pre class="code">' + esc(code) + "</pre></div></div>";
    h += '<div class="row wrap" style="gap:6px;margin-top:10px"><button class="chip" data-act="kibana">Dev Tools</button><button class="chip" data-act="kibana">Discover · sec-10k-data-view</button><button class="chip" data-act="kibana">Dashboard · sec-10k-overview</button></div>';
    h += '<p class="small muted" style="margin-top:10px">The query is embedded on the kit by Jina Embeddings v5 Omni; the kNN executes on the GPU-backed sec_10k_2026 index on the DGX Spark.</p></div></div>';
    return h;
  }

  function ch04() {
    var d = D(), a = S.s4;
    var h = shell("04", "Agentic Action", "The Elastic agent reasons over the freshly-indexed corpus, calls the same search + ES|QL APIs developers use, and streams a cited answer back — autonomous, observable, end-to-end.");
    h += '<div class="grid" style="grid-template-columns:5fr 8fr;margin-top:16px"><div class="panel pad"><div class="eyebrow">Agent configuration</div><table class="t" style="margin-top:8px">';
    [["Agent", "finance-analyst · Financial Filings Analyst"], ["LLM", "Nemotron 3.5 Lightning · Ollama on the DGX Spark · via Kibana connector"], ["Embeddings", "Jina v5 Omni on the DGX Spark · 768-d · corpus + queries"], ["Index", "93,541 chunks · 503 filings"], ["Tools", "finance.company_disclosures, finance.compare_companies, finance.sector_breakdown + 7 platform tools"]].forEach(function (r) { h += "<tr><th>" + r[0] + "</th><td>" + esc(r[1]) + "</td></tr>"; });
    h += '</table><p class="tiny muted" style="margin-top:8px">Index built on the DGX Spark GB10 GPU node.</p>' + V().stagedTag("Card mostly canned") + "</div><div>";
    h += '<form data-submit="ask4"><textarea id="s4-input" class="input" data-model="s4" placeholder="Ask the agent something about the S&amp;P 500 10-K corpus…  (⌘/Ctrl + Enter to send)">' + esc(a.input) + "</textarea>";
    h += '<div class="row" style="gap:8px;margin-top:8px;align-items:center"><button class="btn teal sm" type="submit"' + (a.status === "running" ? " disabled" : "") + '>Send</button><button class="chip" type="button" data-act="reset4">Reset conversation</button><button class="chip" type="button" data-act="kibana">Open in Kibana</button><button class="chip" type="button" data-act="tradeoff">Tradeoffs</button>';
    if (a.status === "running") h += '<span class="mono small" style="margin-left:auto"><span class="spin"></span> <span id="agent-elapsed">' + Math.round((Date.now() - a.t0) / 1000) + "s</span></span>";
    h += "</div></form>";
    if (a.status === "idle") h += '<div style="margin-top:10px">' + d.exampleAgent.map(function (q, i) { return '<button class="qbtn" data-act="ex4" data-i="' + i + '">' + esc(q) + "</button>"; }).join("") + "</div>";
    else {
      h += '<div class="qbubble" style="margin-top:12px">' + esc(a.q) + "</div>";
      if (!a.events.length && a.status === "running") h += '<div class="reason"><span class="spin"></span> Planning my next step</div>';
      a.events.forEach(function (e) {
        if (e.type === "reasoning") h += '<div class="reason fade">' + esc(e.text) + "</div>";
        else if (e.type === "tool_call") h += '<div class="tool fade"><div class="nm">&#9881; ' + esc(e.tool) + '</div><pre class="code" style="margin-top:6px;padding:6px">' + esc(JSON.stringify(e.params)) + "</pre></div>";
        else if (e.type === "tool_result") h += '<div class="tool fade" style="border-left-color:' + (e.error ? "var(--pink)" : "var(--teal)") + '">' + (e.error ? '<span class="pink mono small">' + esc(e.error) + "</span>" : '<span class="mono small teal">&#10003; ' + e.rows + " rows returned</span>") + "</div>";
        else if (e.type === "answer") h += '<div class="answer fade"><div class="mockflag">Mock answer: illustrative wording. On the kit the agent writes this from the tool results.</div>' + md(e.text) + "</div>";
      });
      if (a.status === "done") h += '<div class="mono tiny muted" style="margin-top:6px">complete · ' + a.elapsed + "s · nemotron-3.5-lightning via finance-ollama-llm</div>";
    }
    if (S.tradeoff) h += '<div class="panel pad" style="margin-top:12px"><div class="eyebrow">Tradeoffs</div><p class="small" style="color:var(--char)">This run\'s time to last token, model round-trips and tokens. Cloud spend: none; the answer came from Nemotron 3.5 Lightning on the DGX Spark, inside the case. Fewer tokens means faster answers and more GPU headroom.</p></div>';
    return h + "</div></div>";
  }

  function ch045() {
    var h = shell("—", "Workflows", "Same agent, no human at the keyboard. Workflows put the chapter-04 agent on a schedule, alert trigger, or external event — and the agent can call workflows back, closing the loop.");
    h += '<div class="split" style="margin-top:16px"><div class="panel pad"><div class="h3">Workflows trigger agents</div><p class="small" style="color:var(--char)">Schedule, alert, or external event fires a workflow → the workflow asks the agent → the agent answers → the workflow takes downstream action (Slack, email, write-back).</p></div><div class="panel pad"><div class="h3">Agents call workflows</div><p class="small" style="color:var(--char)">Agent reasons through a question, then invokes a workflow to act — file a case, page a human, append to an index — using the same audit trail as any other workflow run.</p></div></div>';
    h += '<div class="panel pad" style="margin-top:16px"><div class="row" style="justify-content:space-between;align-items:center"><div class="eyebrow tl">Live example · Daily 10-K AI-Risk Digest</div>' + V().stagedTag("Not provisioned on the kit") + '</div><pre class="code" style="margin-top:10px">' + esc(D().workflowYaml) + '</pre><div class="row" style="gap:8px;margin-top:10px"><button class="chip" data-act="wf404">Open in Kibana</button><button class="chip" data-act="wf404">Trigger now</button></div>' + (S.wf404 ? '<div class="small pink" style="margin-top:8px">404 Not Found: /app/workflows/daily-10-k-ai-risk-digest (F13). This is what the kit does today.</div>' : "") + "</div>";
    return h;
  }

  function ch05() {
    var h = shell("05", "The Full Stack", "What we built today, and where it goes next.");
    h += '<div class="heads" style="margin-top:16px">' + [["00 · Two boxes, one knob", "DGX Spark (GB10) vs Framework Desktop (Ryzen AI Max+ 395). Same ES 9.5.6, one cluster. vectors.indexing.use_gpu is the only diff."], ["01 · GPU build vs CPU build", "GPU CAGRA graph build next to CPU HNSW on the same mapping, same Elasticsearch version. The CAGRA graph converts to HNSW, so search runs the same way on both."], ["02 · Throughput · workflow · architecture", "Live charts + the cuVS CAGRA→HNSW pipeline; the JNI bridge that makes Elastic ↔ NVIDIA work."], ["— · From a faster index to a faster business", "Pillars · 4-tier platform stack · same vectors fan out to 4 consumers · SEC-EDGAR data pipeline."], ["03 · One index, two audiences", "Analyst search vs developer API · cURL/Python/Dev Tools · sector chips · kNN over 93K chunks, query embedded by Jina v5 Omni on the kit."], ["04 · Reason · retrieve · synthesise", "finance-analyst agent on NVIDIA Nemotron 3.5 Lightning via Ollama on the DGX Spark, plus custom finance.* ES|QL tools. Every call stays on the kit."], ["— · Agents on autopilot", "Daily 10-K AI-Risk Digest workflow calls the same agent on a schedule, writes back the digest. Two-way bridge."]].map(function (x) { return '<div class="panel pad"><div class="h3">' + esc(x[0]) + '</div><p class="small" style="color:var(--char);margin:0">' + esc(x[1]) + "</p></div>"; }).join("") + "</div>";
    h += '<div class="eyebrow" style="margin-top:18px">Get started with Elastic + NVIDIA cuVS</div><div class="row wrap" style="gap:8px;margin-top:8px"><span class="chip">Read the blog · Search Labs</span><span class="chip">Explore the code · github.com/elastic/elasticsearch</span><span class="chip">Deploy with the blueprint · build.nvidia.com</span></div><p class="tiny muted">Links need internet. On the airgapped kit they fail; share them after the session.</p>';
    return h;
  }

  var actions = {
    goch: function (el) { app().go(+el.getAttribute("data-i")); },
    prevch: function () { var i = app().A.step; if (i > 0) app().go(i - 1); },
    nextch: function () { var i = app().A.step; if (i < D().steps.length - 1) app().go(i + 1); },
    exitDeck: function () { app().exit(); },
    raceStart: function () { S.popupShown = false; S.popup = false; S.race.start(); },
    raceReset: function () { S.popup = false; S.popupShown = false; S.race.reset(); },
    closePopup: function (el, e) { if (el.classList.contains("backdrop") && e.target !== el) return; S.popup = false; app().refresh(); },
    ptab: function (el) { S.ptab = el.getAttribute("data-t"); app().refresh(); },
    tab2: function (el) { S.tab2 = el.getAttribute("data-t"); app().refresh(); },
    assump: function () { S.assumptions = !S.assumptions; app().refresh(); },
    ex3: function (el) { runSearch(D().exampleSearches[+el.getAttribute("data-i")]); },
    search3: function () { if (S.s3.query.trim()) runSearch(S.s3.query); },
    sector: function (el) { var s = el.getAttribute("data-s"), p = S.s3.picked, i = p.indexOf(s); if (i >= 0) p.splice(i, 1); else p.push(s); if (S.s3.result || S.s3.error) runSearch(S.s3.query); else app().refresh(); },
    codeTab: function (el) { S.s3.tab = el.getAttribute("data-t"); app().refresh(); },
    kibana: function () { app().toast("On the kit this opens Kibana at kibana.ddil:5601. The mock has no Kibana."); },
    ex4: function (el) { runAgent(D().exampleAgent[+el.getAttribute("data-i")]); app().refresh(); },
    ask4: function () { var q = (S.s4.input || "").trim(); if (!q || S.s4.status === "running") return; runAgent(q); app().refresh(); },
    reset4: function () { S.timers.cancel(); S.s4 = { input: "", events: [], status: "idle", q: null, t0: 0 }; app().refresh(); },
    tradeoff: function () { S.tradeoff = !S.tradeoff; app().refresh(); },
    wf404: function () { S.wf404 = true; app().refresh(); },
  };
  function model(k, v) { if (k === "s3") S.s3.query = v; if (k === "s4") S.s4.input = v; }
  function keys(e, typing) {
    if (typing) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.target.id === "s4-input") { e.preventDefault(); actions.ask4(); }
      return;
    }
    if (e.key >= "0" && e.key <= "5") {
      var want = "0" + e.key, chs = D().chapters;
      for (var i = 0; i < chs.length; i++) if (chs[i].number === want) { app().go(stepForCh(i)); return; }
    }
  }

  M.screens.sec = { init: init, enter: enter, reset: reset, render: render, actions: actions, model: model, keys: keys };
})();
