/* DDIL kit setup guide: figure viewer, hotspots, checklist, copy buttons.
   Classic script, no modules, works from file://. Data: window.DDIL_HOTSPOTS, window.DDIL_MAP. */
(function () {
  'use strict';
  var HS = window.DDIL_HOTSPOTS || {};
  var MAP = window.DDIL_MAP || { components: {}, steps: {}, hsSteps: {} };
  var VDEF = window.DDIL_VIEWS || [{ key: 'front', tab: 'Front', variant: '' }, { key: 'back', tab: 'Back', variant: '' }, { key: 'side', tab: 'Side', variant: '' }];
  var VIEWS = VDEF.map(function (d) { return d.key; });
  var TAB_OF = {}, VAR_OF = {}, lastOfTab = {};
  VDEF.forEach(function (d) { TAB_OF[d.key] = d.tab.toLowerCase(); VAR_OF[d.key] = d.variant; if (!lastOfTab[d.tab.toLowerCase()]) lastOfTab[d.tab.toLowerCase()] = d.key; });
  var STORE_KEY = 'ddil-setup-guide-v1';
  var byId = {};
  VIEWS.forEach(function (v) { (HS[v] || []).forEach(function (h) { h.view = v; byId[h.id] = h; }); });

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- storage ---------- */
  function load() {
    try { var raw = window.localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }
  function save(state) {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode or blocked storage */ }
  }
  var state = load();
  if (!state.checks) state = { checks: state, fills: {} };
  if (!state.fills) state.fills = {};

  /* ---------- hotspots ---------- */
  var fig = $('#fig');
  var tip = $('#tip');
  var pinned = null;

  function placeHotspots() {
    VIEWS.forEach(function (v) {
      var host = $('.view[data-view="' + v + '"] .stage', fig);
      if (!host) return;
      (HS[v] || []).forEach(function (h) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'hs';
        b.textContent = h.id.replace(/^[A-Z]+/, '');
        b.setAttribute('data-hs', h.id);
        b.setAttribute('aria-label', h.id + ': ' + h.label);
        b.style.left = h.x + '%';
        b.style.top = h.y + '%';
        b.addEventListener('mouseenter', function () { if (!pinned) showTip(h, b); });
        b.addEventListener('mouseleave', function () { if (!pinned) hideTip(); });
        b.addEventListener('focus', function () { if (!pinned) showTip(h, b); });
        b.addEventListener('blur', function () { if (!pinned) hideTip(); });
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (pinned === h.id) { pinned = null; hideTip(); return; }
          pinned = h.id; showTip(h, b);
        });
        host.appendChild(b);
      });
    });
  }

  function showTip(h, btn) {
    var comps = (h.comp || []).map(function (c) { return MAP.components[c]; }).filter(Boolean);
    var steps = MAP.hsSteps[h.id] || [];
    var html = '<button class="x" type="button" aria-label="Close">&times;</button>' +
      '<div class="k">' + esc(h.id) + ' · ' + esc(TAB_OF[h.view]) + ' view · ' + esc(VAR_OF[h.view]) + '</div>';
    comps.forEach(function (c) {
      html += '<h4>' + esc(c.name) + '</h4><div class="ad">' + esc(c.addr) + '</div><div class="rl">' + esc(c.role) + '</div>';
    });
    html += '<div class="lb" style="margin-top:6px">Drawing: ' + esc(h.label) + '. Component map, confirm on your kit.</div>';
    if (steps.length) {
      html += '<div class="k" style="margin-top:8px">Steps that touch it</div><div class="st">' +
        steps.map(function (s) {
          var st = MAP.steps[s];
          return '<a href="#' + esc(s) + '" data-step="' + esc(s) + '" title="' + esc(st ? st.title : s) + '">' + esc(st ? st.num : s) + '</a>';
        }).join('') + '</div>';
    }
    tip.innerHTML = html;
    tip.classList.add('on');
    var fr = fig.getBoundingClientRect(), br = btn.getBoundingClientRect();
    var w = Math.min(280, fr.width - 16);
    tip.style.width = w + 'px';
    var left = br.left - fr.left + br.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, fr.width - w - 8));
    tip.style.left = left + 'px';
    var below = br.bottom - fr.top + 8;
    tip.style.top = below + 'px';
    var th = tip.offsetHeight;
    if (below + th > fr.height - 4) { tip.style.top = Math.max(4, br.top - fr.top - th - 8) + 'px'; }
    $('.x', tip).addEventListener('click', function (ev) { ev.stopPropagation(); pinned = null; hideTip(); });
    $all('.st a', tip).forEach(function (a) {
      a.addEventListener('click', function () { focusStep(a.getAttribute('data-step'), false); pinned = null; hideTip(); });
    });
  }
  function hideTip() { tip.classList.remove('on'); }
  document.addEventListener('click', function (ev) {
    if (pinned && !tip.contains(ev.target)) { pinned = null; hideTip(); }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { pinned = null; hideTip(); } });

  /* ---------- tabs ---------- */
  function setView(v) {
    if (TAB_OF[v] === undefined) v = VIEWS[0];
    var tab = TAB_OF[v]; lastOfTab[tab] = v;
    $all('.tabs button').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === tab ? 'true' : 'false'); });
    $all('.variants').forEach(function (bar) { bar.classList.toggle('on', bar.getAttribute('data-tab') === tab && bar.children.length > 1); });
    $all('.variants button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === v ? 'true' : 'false'); });
    var fc = $('#figcap'); if (fc) fc.textContent = /photo$/.test(v) ? 'Photo of the kit, 13 Nov 2026' : 'Illustration. Not to scale.';
    $all('.view', fig).forEach(function (el) { el.classList.toggle('on', el.getAttribute('data-view') === v); });
    $all('.legend').forEach(function (ul) { ul.style.display = ul.getAttribute('data-view') === v ? '' : 'none'; });
    var cap = $('#figname'); if (cap) cap.textContent = tab.charAt(0).toUpperCase() + tab.slice(1) + ' view · ' + VAR_OF[v];
    pinned = null; hideTip();
  }
  $all('.tabs button').forEach(function (b) { b.addEventListener('click', function () { setView(lastOfTab[b.getAttribute('data-tab')]); }); });
  $all('.variants button').forEach(function (b) { b.addEventListener('click', function () { setView(b.getAttribute('data-view')); }); });
  $all('.legend li').forEach(function (li) {
    li.addEventListener('click', function () {
      var b = $('.hs[data-hs="' + li.getAttribute('data-hs') + '"]', fig);
      if (b) { pinned = li.getAttribute('data-hs'); showTip(byId[pinned], b); }
    });
  });

  /* ---------- step to hotspot highlight ---------- */
  function clearCallouts() { $all('.callout', fig).forEach(function (c) { c.parentNode.removeChild(c); }); }
  function addCallouts(labels) {
    clearCallouts();
    Object.keys(labels || {}).forEach(function (id) {
      var h = byId[id]; if (!h) return;
      var host = $('.view[data-view="' + h.view + '"] .stage', fig); if (!host) return;
      /* labels run right unless near the right edge or another lit spot sits just to the right */
      var crowd = Object.keys(labels).some(function (o) {
        var q = byId[o]; return q && q !== h && q.view === h.view && q.x > h.x && q.x - h.x < 30 && Math.abs(q.y - h.y) < 7;
      });
      var left = h.x > 58 || crowd;
      var c = document.createElement('div');
      c.className = 'callout' + (left ? ' l' : '');
      c.style.top = h.y + '%';
      if (left) { c.style.right = (100 - h.x) + '%'; c.style.marginRight = '14px'; }
      else { c.style.left = h.x + '%'; c.style.marginLeft = '14px'; }
      c.innerHTML = '<span class="ln"></span><span class="lb">' + esc(labels[id]) + '</span>';
      host.appendChild(c);
    });
  }
  function highlight(ids, labels) {
    var set = {}; ids.forEach(function (i) { set[i] = true; });
    addCallouts(labels || {});
    var any = ids.length > 0;
    $all('.hs', fig).forEach(function (b) {
      var on = !!set[b.getAttribute('data-hs')];
      b.classList.toggle('lit', on);
      b.classList.toggle('dim', any && !on);
    });
    var per = {};
    VIEWS.forEach(function (v) {
      var n = (HS[v] || []).filter(function (h) { return set[h.id]; }).length;
      per[TAB_OF[v]] = (per[TAB_OF[v]] || 0) + n;
      var vb = $('.variants button[data-view="' + v + '"] .vb');
      if (vb) { vb.textContent = n ? n : ''; vb.classList.toggle('on', n > 0); }
    });
    $all('.tabs button').forEach(function (b) {
      var n = per[b.getAttribute('data-tab')] || 0, badge = $('.badge', b);
      if (badge) { badge.textContent = n; badge.classList.toggle('on', n > 0); }
    });
    var clr = $('#clearhl'); if (clr) clr.style.visibility = any ? 'visible' : 'hidden';
  }
  function focusStep(id, scrollViewer) {
    var st = MAP.steps[id];
    $all('.step.focus').forEach(function (el) { el.classList.remove('focus'); });
    var el = document.getElementById(id);
    if (el) el.classList.add('focus');
    if (!st) return;
    highlight(st.hs, st.callouts);
    /* the first hotspot of a step names its primary view */
    if (st.hs.length && byId[st.hs[0]]) setView(byId[st.hs[0]].view);
    if (scrollViewer && window.matchMedia && window.matchMedia('(max-width:1180px)').matches) {
      var vw = $('.viewer'); if (vw) vw.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  $all('.step .show').forEach(function (b) {
    b.addEventListener('click', function (ev) { ev.stopPropagation(); focusStep(b.getAttribute('data-step'), true); });
  });
  $all('.step header').forEach(function (hd) {
    hd.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t.closest('label') || t.closest('button') || t.tagName === 'INPUT') return;
      var art = hd.closest('.step'); if (art) focusStep(art.id, true);
    });
  });
  $all('.hsref').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-hs'); var h = byId[id]; if (!h) return;
      setView(h.view); var lab = {}; lab[id] = h.id; highlight([id], lab);
      if (window.matchMedia && window.matchMedia('(max-width:1180px)').matches) {
        var vw = $('.viewer'); if (vw) vw.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
  var clr = $('#clearhl');
  if (clr) clr.addEventListener('click', function () { highlight([], {}); $all('.step.focus').forEach(function (el) { el.classList.remove('focus'); }); });

  /* ---------- checklist ---------- */
  var boxes = $all('input[type=checkbox][data-step]');
  function refresh() {
    var total = boxes.length, done = 0;
    boxes.forEach(function (b) {
      var on = !!state.checks[b.getAttribute('data-step')];
      b.checked = on; if (on) done++;
      var art = b.closest('.step'); if (art && b.closest('.ck')) art.classList.toggle('done', on);
    });
    var pct = total ? Math.round(done * 100 / total) : 0;
    var p = $('#prog'); if (p) p.textContent = done + ' / ' + total;
    var bar = $('#bar'); if (bar) bar.style.width = pct + '%';
    var tot = $('#railtot'); if (tot) tot.textContent = pct + '%';
    $all('.rail li a').forEach(function (a) {
      var sec = a.getAttribute('data-sec');
      var mine = boxes.filter(function (b) { return b.getAttribute('data-sec') === sec; });
      var d = mine.filter(function (b) { return b.checked; }).length;
      var c = $('.c', a); if (c) c.textContent = d + '/' + mine.length;
      a.classList.toggle('done', mine.length > 0 && d === mine.length);
    });
  }
  boxes.forEach(function (b) {
    b.addEventListener('change', function () {
      var id = b.getAttribute('data-step');
      if (b.checked) state.checks[id] = 1; else delete state.checks[id];
      save(state); refresh();
    });
  });
  $all('[data-action="reset"]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!window.confirm('Clear every checkbox in this guide? Filled-in blanks are kept.')) return;
      state.checks = {}; save(state); refresh();
    });
  });
  $all('[data-action="print"]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });

  /* ---------- fill-in blanks (same id stays in sync everywhere) ---------- */
  var fills = $all('input.fill');
  function paintFills() {
    fills.forEach(function (f) {
      var v = state.fills[f.getAttribute('data-fill')] || '';
      if (f !== document.activeElement) f.value = v;
      f.classList.toggle('set', !!v);
    });
  }
  fills.forEach(function (f) {
    f.addEventListener('input', function () {
      var id = f.getAttribute('data-fill');
      state.fills[id] = f.value; if (!f.value) delete state.fills[id];
      fills.forEach(function (o) { if (o !== f && o.getAttribute('data-fill') === id) o.value = f.value; });
      save(state); paintFills();
    });
  });

  /* ---------- copy buttons ---------- */
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta); return ok;
  }
  $all('.cmd button').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = $('code', b.parentNode).textContent;
      function done(ok) {
        b.textContent = ok ? 'Copied' : 'Select';
        b.classList.toggle('ok', ok);
        setTimeout(function () { b.textContent = 'Copy'; b.classList.remove('ok'); }, 1600);
      }
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
        } else { done(fallbackCopy(text)); }
      } catch (e) { done(fallbackCopy(text)); }
    });
  });

  /* ---------- rail: active section ---------- */
  var links = $all('.rail li a');
  if ('IntersectionObserver' in window && links.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var id = en.target.id;
          links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-sec') === id); });
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    $all('section.sec').forEach(function (s) { io.observe(s); });
  }

  placeHotspots();
  setView('front');
  highlight([]);
  refresh();
  paintFills();
  if (location.hash) {
    var id = location.hash.slice(1);
    if (MAP.steps[id]) {
      focusStep(id, false);
      var tgt = document.getElementById(id);
      if (tgt) { document.documentElement.style.scrollBehavior = 'auto'; tgt.scrollIntoView({ block: 'start' }); window.scrollBy(0, -72); document.documentElement.style.scrollBehavior = ''; }
    }
  }
  /* deep links for QA and for sharing a part: ?view=back&tip=B4 */
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('view')) setView(q.get('view'));
    var t = q.get('tip');
    if (t && byId[t]) {
      setView(byId[t].view);
      var tb = $('.hs[data-hs="' + t + '"]', fig);
      if (tb) { pinned = t; showTip(byId[t], tb); }
    }
  } catch (e) { /* URLSearchParams unavailable */ }
})();
