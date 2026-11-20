/* DDIL mock: router, practice bar, coach panel, timers, drills, checklist, keyboard.
   Routes: #/ (chooser)  #vineyard/3  #sec/5  #jina/1
   Optional hash params: ?coach=1|0 &drill=none|llm|search|es &pace=kit|fast
   plus screen params (race=mid|end, run=end, q=<example index>, persona=<id>, block=<id>, mode=<map mode>). */
(function () {
  var M = window.MOCK, U = M.util, esc = U.esc;
  var ADVS = ["vineyard", "sec", "jina"];
  var PROG_KEY = "ddil-mock-progress";

  var A = {
    adv: null, step: 0, params: {},
    coach: U.load("ddil-mock-coach", true),
    drill: "none", pace: U.load("ddil-mock-pace", "kit"),
    advStart: 0, stepStart: 0,
    progress: U.load(PROG_KEY, {}),
    inited: {},
  };

  var app = (M.app = {
    A: A,
    drill: function () { return A.drill; },
    pace: function () { return A.pace; },
    paceFactor: function () { return A.pace === "fast" ? 0.25 : 1; },
    coachOn: function () { return A.coach; },
    go: function (step, extra) { go(A.adv, step, extra); },
    refresh: refreshStage,
    render: renderAll,
    toast: function (msg) {
      var t = document.getElementById("toast");
      if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
      t.textContent = msg; t.className = "show";
      clearTimeout(t._h); t._h = setTimeout(function () { t.className = ""; }, 3200);
    },
  });

  function data() { return M.data[A.adv]; }
  function screen() { return M.screens[A.adv]; }

  // ---------- routing ----------
  function parseHash() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    var qi = h.indexOf("?"), q = qi >= 0 ? h.slice(qi + 1) : "", path = qi >= 0 ? h.slice(0, qi) : h;
    var params = {};
    q.split("&").forEach(function (kv) { if (!kv) return; var p = kv.split("="); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ""); });
    var parts = path.split("/").filter(Boolean);
    var adv = ADVS.indexOf(parts[0]) >= 0 ? parts[0] : null;
    var step = parts[1] != null ? parseInt(parts[1], 10) || 0 : 0;
    return { adv: adv, step: step, params: params };
  }
  function go(adv, step, extra) {
    var h = adv ? "#" + adv + "/" + (step || 0) : "#/";
    if (extra) h += "?" + extra;
    if (location.hash === h) route(); else location.hash = h;
  }

  function route() {
    var r = parseHash();
    var p = r.params;
    if (p.coach === "1") A.coach = true; else if (p.coach === "0") A.coach = false;
    if (p.drill && /^(none|llm|search|es)$/.test(p.drill)) A.drill = p.drill;
    if (p.pace && /^(kit|fast)$/.test(p.pace)) A.pace = p.pace;
    var advChanged = r.adv !== A.adv;
    if (advChanged && A.adv && screen() && screen().leave) screen().leave();
    A.adv = r.adv;
    A.params = p;
    if (!A.adv) { A.step = 0; renderAll(); return; }
    var n = data().steps.length;
    var step = Math.max(0, Math.min(n - 1, r.step));
    if (!A.inited[A.adv]) { screen().init(); A.inited[A.adv] = true; A.advStart = Date.now(); }
    else if (advChanged) A.advStart = Date.now();
    if (advChanged || step !== A.step) A.stepStart = Date.now();
    A.step = step;
    screen().enter(step, p);
    renderAll();
    var st = document.getElementById("stage"); if (st && (advChanged || p.top !== "0")) st.scrollTop = 0;
  }

  function resetAdventure() {
    if (!A.adv) return;
    if (screen().reset) screen().reset();
    A.inited[A.adv] = false;
    A.advStart = Date.now();
    A.stepStart = Date.now();
    go(A.adv, 0);
  }
  app.resetAdventure = resetAdventure;
  app.exit = function () { go(null); };

  // ---------- progress checklist ----------
  function isDone(adv, id) { return !!(A.progress[adv] && A.progress[adv][id]); }
  function toggleDone(adv, id) {
    A.progress[adv] = A.progress[adv] || {};
    A.progress[adv][id] = !A.progress[adv][id];
    U.save(PROG_KEY, A.progress);
  }
  function doneCount(adv) { var d = M.data[adv]; return d.steps.filter(function (s) { return isDone(adv, s.id); }).length; }
  function totalTarget(adv) { return M.data[adv].steps.reduce(function (a, s) { return a + s.target; }, 0); }

  // ---------- rendering ----------
  function renderAll() {
    var root = document.getElementById("app");
    root.className = A.adv ? (A.coach ? "coach-on" : "") : "home";
    document.getElementById("top").innerHTML = renderTop();
    document.getElementById("bot").innerHTML = renderBottom();
    document.getElementById("coach").innerHTML = A.adv ? renderCoach() : "";
    refreshStage(true);
    tickTimers();
  }

  function refreshStage(full) {
    var stage = document.getElementById("stage");
    var y = stage.scrollTop;
    var ae = document.activeElement, focusId = ae && ae.id && stage.contains(ae) ? ae.id : null;
    var sel = focusId && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null;
    var html = A.adv ? drillBanner() + screen().render() : (M.renderChooser ? M.renderChooser() : renderChooser());
    // In-place refreshes (race ticks, agent stream, search) re-render the whole stage.
    // Only elements that are new since the last render may play the fade-in; the rest
    // would replay it on every tick and the screen would flash.
    var prevFades = full ? 0 : stage.querySelectorAll(".fade").length;
    stage.innerHTML = html;
    if (prevFades) {
      var fades = stage.querySelectorAll(".fade");
      for (var i = 0; i < Math.min(prevFades, fades.length); i++) fades[i].style.animation = "none";
    }
    if (!full) stage.scrollTop = y;
    if (focusId) {
      var el = document.getElementById(focusId);
      if (el) { el.focus(); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    }
    if (A.adv && screen().after) screen().after();
  }

  function drillBanner() {
    if (A.drill === "none") return "";
    var d = data().drills[A.drill];
    return '<div class="drillbar"><span class="tag">Failure drill · ' + esc(d.label) + "</span><span>" + esc(d.see) + "</span></div>";
  }

  function renderTop() {
    var h = '<img class="logo" src="brand/logo/logo-elastic-horizontal-white.svg" alt="Elastic" data-act="home" title="Back to chooser (Esc)">';
    h += '<span class="sep"></span>';
    if (!A.adv) {
      h += '<span class="advname">DDIL Demo Kit · Practice mock</span><span class="grow"></span>';
      h += '<span class="mono small muted">No kit needed · nothing here calls a network</span>';
      return h;
    }
    var d = data(), s = d.steps[A.step];
    h += '<span class="advname" style="color:var(--' + d.accent + ')">' + esc(d.title) + "</span>";
    h += '<span class="stepname">Step ' + (A.step + 1) + " of " + d.steps.length + " · " + esc(s.title) + "</span>";
    h += '<span class="grow"></span>';
    h += '<div class="timer" title="Step time vs target"><span>STEP <b id="tm-step">0:00</b></span><span class="dim">target ' + U.clock(s.target) + "</span></div>";
    h += '<div class="timer" title="Total time vs target"><span>TOTAL <b id="tm-total">0:00</b></span><span class="dim">target ' + U.clock(totalTarget(A.adv)) + "</span></div>";
    h += '<select class="tsel" data-ch="pace" title="Model pace for agent streams. Kit = realistic timing.">' +
      opt("kit", "Kit pace", A.pace) + opt("fast", "4x pace", A.pace) + "</select>";
    h += '<select class="tsel" data-ch="drill" title="Failure drill: inject a real kit failure">' +
      opt("none", "No drill", A.drill) + opt("llm", "Drill: LLM", A.drill) + opt("search", "Drill: search", A.drill) + opt("es", "Drill: ES down", A.drill) + "</select>";
    h += '<button class="tbtn' + (A.coach ? " on" : "") + '" data-act="coach" title="Presenter coach (C)"><span class="lbl">Coach</span><kbd>C</kbd></button>';
    h += '<button class="tbtn" data-act="reset" title="Reset this adventure (R)"><span class="lbl">Reset</span><kbd>R</kbd></button>';
    h += '<button class="tbtn" data-act="prev" title="Previous step (Left arrow)" aria-label="Previous step">&larr;</button>';
    h += '<button class="tbtn" data-act="next" title="Next step (Right arrow)" aria-label="Next step">&rarr;</button>';
    h += '<button class="tbtn" data-act="home" title="Back to chooser (Esc)">Esc</button>';
    return h;
  }
  function opt(v, l, cur) { return '<option value="' + v + '"' + (v === cur ? " selected" : "") + ">" + l + "</option>"; }

  function renderBottom() {
    if (!A.adv) return '<span>Arrows: step · Esc: chooser · R: reset · C: coach</span><span class="hint">Progress saves in this browser only</span>';
    var d = data();
    var h = '<div class="segs">';
    d.steps.forEach(function (s, i) {
      h += '<button data-act="step" data-i="' + i + '" class="' + (i === A.step ? "cur " : "") + (isDone(A.adv, s.id) ? "done" : "") + '" title="' + esc(s.title) + '"><i></i></button>';
    });
    h += "</div><span>Step " + (A.step + 1) + " of " + d.steps.length + " · " + esc(d.steps[A.step].title) + "</span>";
    h += '<span class="hint">' + doneCount(A.adv) + "/" + d.steps.length + " rehearsed · &larr; &rarr; step · Esc chooser · R reset · C coach" + (A.adv === "sec" ? " · 0-5 chapter" : "") + "</span>";
    return h;
  }

  function renderCoach() {
    var d = data(), s = d.steps[A.step], c = s.coach;
    var cls = c.status === "LIVE" ? "live" : c.status === "STAGED" ? "staged" : "mixed";
    var h = '<div class="coach">';
    h += '<div class="eyebrow tl">Presenter coach</div>';
    h += '<div class="ttl">' + esc(s.title) + "</div>";
    h += '<div class="row" style="gap:8px;align-items:center;margin-top:6px"><span class="badge ' + cls + '">' + c.status + '</span><span class="tgt">Target ' + U.clock(s.target) + "</span></div>";
    h += '<h3 class="tl">Say this</h3><ul>' + c.say.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    h += '<h3 class="tl">Proof point</h3><div class="proof">' + esc(c.proof) + "</div>";
    h += '<h3 class="yl">' + (c.status === "LIVE" ? "Live, with caveats" : c.status === "STAGED" ? "Staged: honest phrasing" : "Live and staged: honest phrasing") + '</h3><div class="honest">' + esc(c.honest) + "</div>";
    h += "<h3>Likely questions</h3>" + c.questions.map(function (q) { return "<details><summary>" + esc(q.q) + "</summary><p>" + esc(q.a) + "</p></details>"; }).join("");
    h += '<h3 class="pk">If this fails on the kit</h3><div class="fail">' + esc(c.fails) + "</div>";
    if (A.drill !== "none") {
      var dr = d.drills[A.drill];
      h += '<h3 class="pk">Drill: ' + esc(dr.label) + '</h3><div class="fail"><p><b>You see:</b> ' + esc(dr.see) + "</p><p><b>Recover:</b> " + esc(dr.fix) + "</p></div>";
    }
    var done = isDone(A.adv, s.id);
    h += '<button class="chk' + (done ? " done" : "") + '" data-act="mark">' + (done ? "&#10003; Rehearsed" : "&#9633; Mark this step rehearsed") + "</button>";
    return h + "</div>";
  }

  function renderChooser() {
    var cards = [
      { id: "vineyard", color: "teal", icon: "&#9673;", name: "Vineyard Intelligence",
        p: "Step into the shoes of a vineyard owner managing 22 acres of premium wine grapes. Navigate soil sensors, nutrient data, disease imagery, and 8 years of harvest history.",
        li: ["869K sensor records · 6 vineyard blocks", "17K disease images · kNN similarity search", "AI Agronomist · Elastic Agent Builder"],
        covers: "Architecture, race intro, staged GPU vs CPU race, dashboard, map, 5-phase agent, search, crop health, reset." },
      { id: "sec", color: "blue", icon: "&#9638;", name: "SEC Findings",
        p: "Investigate SEC EDGAR filings as a financial analyst. Search through regulatory documents, detect anomalies, and build compliance reports with AI assistance.",
        li: ["EDGAR dataset · 10-K / 10-Q filings", "Semantic search · Document analysis", "AI Compliance Analyst · Agent Builder"],
        covers: "Eight-chapter deck: the kit's two nodes, race, kit economics, live search, Agent Builder chat, workflows, recap." },
      { id: "jina", color: "pink", icon: "&#9672;", name: "Multimodal Intelligence",
        p: "Search images by typing words, then investigate a classified research corpus as four analysts — where document-level security enforces need-to-know on every result.",
        li: ["Jina omni embeddings · text + image, one space", "198 open-access papers · hybrid RRF · figures", "Document-level security · 4 clearance personas"],
        covers: "Search by Image, then Vector Search over 100 real open-access papers as four analysts, a PDF viewer, and a grounded AI Analyst answer." },
    ];
    var h = '<div class="chooser fade">';
    h += '<div class="eyebrow">DDIL Demo Kit · Context Engineering Anywhere</div>';
    h += '<h1 class="h1">Choose Your Adventure</h1>';
    h += '<p class="lede">Practice mock of the kit frontend. Same screens, same order, same controls, canned data, no network. Turn on the coach (C) for talking points, honest phrasing for staged elements and recovery steps.</p>';
    h += '<div class="cards">';
    cards.forEach(function (c) {
      var n = M.data[c.id].steps.length, dn = doneCount(c.id);
      h += '<button class="acard" data-act="choose" data-adv="' + c.id + '" style="color:var(--' + c.color + ')">';
      h += '<div class="ico" style="font-size:22px">' + c.icon + "</div>";
      h += "<h2>" + esc(c.name) + "</h2><p>" + esc(c.p) + "</p><ul>" + c.li.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
      h += '<p class="small" style="color:var(--grey)">Rehearses: ' + esc(c.covers) + "</p>";
      h += '<div class="go"><span>Start demo &rarr;</span><span class="muted">' + dn + "/" + n + " · " + U.clock(totalTarget(c.id)) + "</span></div>";
      h += '<div class="prog"><i style="width:' + Math.round((dn / n) * 100) + '%"></i></div></button>';
    });
    h += "</div>";
    h += '<div class="legend">';
    h += '<div><div class="eyebrow tl">Practice mode</div><p>Step and total timers run against target times. Kit pace replays agent streams at realistic speed; 4x pace compresses them. Mark each step rehearsed in the coach panel.</p></div>';
    h += '<div><div class="eyebrow pk">Failure drills</div><p>Inject an LLM timeout, a silent search fallback, or Elasticsearch down. The screens misbehave the way the kit does and the coach shows the recovery.</p></div>';
    h += '<div><div class="eyebrow yl">Keys</div><p class="keys"><kbd>&larr;</kbd><kbd>&rarr;</kbd>step <kbd>Esc</kbd>chooser <kbd>R</kbd>reset <kbd>C</kbd>coach</p>' +
      '<p class="small"><button class="chip" data-act="clearprog">Clear rehearsal progress</button></p></div>';
    h += "</div>";
    h += '<p class="small muted" style="margin-top:28px">Out of scope for this mock: Edge Federation (CCS) and the satellite demos. Footer on the kit: Elasticsearch 9.5.6 + NVIDIA cuVS · Nemotron 3.5 Lightning and Jina Embeddings v5 Omni on DGX Spark · Fully Airgapped.</p>';
    return h + "</div>";
  }

  // ---------- timers ----------
  function tickTimers() {
    if (!A.adv) return;
    var s = data().steps[A.step];
    var es = (Date.now() - A.stepStart) / 1000, et = (Date.now() - A.advStart) / 1000;
    var a = document.getElementById("tm-step"), b = document.getElementById("tm-total");
    if (a) { a.textContent = U.clock(es); a.className = es > s.target ? "over" : "ok"; }
    if (b) { b.textContent = U.clock(et); b.className = et > totalTarget(A.adv) ? "over" : "ok"; }
  }
  setInterval(tickTimers, 1000);

  // ---------- events ----------
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");
    switch (act) {
      case "home": go(null); return;
      case "choose": go(el.getAttribute("data-adv"), 0); return;
      case "coach": A.coach = !A.coach; U.save("ddil-mock-coach", A.coach); renderAll(); return;
      case "reset": resetAdventure(); return;
      case "prev": stepBy(-1); return;
      case "next": stepBy(1); return;
      case "step": go(A.adv, +el.getAttribute("data-i")); return;
      case "mark": toggleDone(A.adv, data().steps[A.step].id); renderAll(); return;
      case "ccsNotice": app.toast("Edge Federation is not in the trainer. Practise Vineyard, SEC Findings or Multimodal."); return;
      case "clearprog": A.progress = {}; U.save(PROG_KEY, A.progress); renderAll(); return;
    }
    if (A.adv && screen().actions && screen().actions[act]) { e.preventDefault(); screen().actions[act](el, e); }
  });
  document.addEventListener("change", function (e) {
    var el = e.target;
    var ch = el.getAttribute && el.getAttribute("data-ch");
    if (ch === "pace") { A.pace = el.value; U.save("ddil-mock-pace", A.pace); renderAll(); return; }
    if (ch === "drill") { A.drill = el.value; renderAll(); el.blur(); return; }
    if (ch && A.adv && screen().actions && screen().actions[ch]) screen().actions[ch](el, e);
  });
  document.addEventListener("input", function (e) {
    var el = e.target, m = el.getAttribute && el.getAttribute("data-model");
    if (m && A.adv && screen().model) screen().model(m, el.value);
  });
  document.addEventListener("submit", function (e) {
    var f = e.target, act = f.getAttribute("data-submit");
    e.preventDefault();
    if (act && A.adv && screen().actions && screen().actions[act]) screen().actions[act](f, e);
  });

  function stepBy(d) {
    if (!A.adv) return;
    var n = data().steps.length, s = A.step + d;
    if (s < 0 || s >= n) return;
    go(A.adv, s);
  }

  document.addEventListener("keydown", function (e) {
    var t = e.target, tag = t && t.tagName;
    var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable);
    if (e.key === "Escape") {
      if (typing) { t.blur(); return; }
      if (A.adv && screen().onEscape && screen().onEscape()) return;
      go(null); return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) {
      if (A.adv && screen().keys) screen().keys(e, typing);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); stepBy(1); return; }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); stepBy(-1); return; }
    if (e.key === "c" || e.key === "C") { A.coach = !A.coach; U.save("ddil-mock-coach", A.coach); renderAll(); return; }
    if (e.key === "r" || e.key === "R") { resetAdventure(); return; }
    if (A.adv && screen().keys) screen().keys(e, false);
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", route);
})();
