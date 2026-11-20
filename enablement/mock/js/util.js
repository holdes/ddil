/* Shared helpers for the DDIL mock. Classic script: everything hangs off window.MOCK. */
(function () {
  var M = (window.MOCK = window.MOCK || { data: {}, screens: {} });

  // Seeded PRNG (mulberry32) so every replay is identical.
  function rng(seed) {
    var a = seed >>> 0;
    var r = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // Python random.gauss(mu, sigma) equivalent shape (Box-Muller).
    r.gauss = function (mu, sigma) {
      var u = 1 - r(), v = r();
      return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return r;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // Same as frontend lib/utils.ts
  function fmtNum(n) { return new Intl.NumberFormat("en-US").format(n); }
  function fmtDur(ms) {
    ms = Math.round(ms);
    if (ms < 1000) return ms + "ms";
    var s = ms / 1000;
    if (s < 60) return s.toFixed(1) + "s";
    var m = Math.floor(s / 60);
    return m + "m " + (s % 60).toFixed(0) + "s";
  }
  // Same as sec/lib/pricing.ts fmtUsd
  function fmtUsd(n) {
    if (n === 0) return "$0";
    var a = Math.abs(n);
    if (a < 0.01) return "$" + n.toFixed(4);
    if (a < 10) return "$" + n.toFixed(3);
    if (a < 1000) return "$" + n.toFixed(2);
    if (a < 1e6) return "$" + (n / 1000).toFixed(1) + "k";
    return "$" + (n / 1e6).toFixed(2) + "M";
  }
  function clock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  // Storage, always wrapped: private mode, file:// quirks and previews can throw.
  function load(key, dflt) {
    try { var raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : dflt; }
    catch (e) { return dflt; }
  }
  function save(key, val) {
    try { window.localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
  function remove(key) { try { window.localStorage.removeItem(key); } catch (e) {} }

  // A cancellable bag of timers. Each simulation owns one so Reset can kill it cleanly.
  function Timers() { this.ids = []; }
  Timers.prototype.later = function (ms, fn) {
    var self = this;
    var id = setTimeout(function () { self.ids = self.ids.filter(function (x) { return x !== id; }); fn(); }, Math.max(0, ms));
    this.ids.push(id);
    return id;
  };
  Timers.prototype.cancel = function () { this.ids.forEach(clearTimeout); this.ids = []; };

  // Tiny inline sparkline (SVG polyline) for race history.
  function spark(series, opts) {
    opts = opts || {};
    var w = 300, h = 64;
    var all = [];
    series.forEach(function (s) { s.pts.forEach(function (p) { all.push(p); }); });
    if (!all.length) return '<svg viewBox="0 0 ' + w + " " + h + '"></svg>';
    var maxX = opts.maxX || Math.max.apply(null, all.map(function (p) { return p.time; })) || 1;
    var ys = all.map(function (p) { return p.throughput; });
    var maxY = opts.maxY || Math.max.apply(null, ys) || 1;
    var minY = opts.minY != null ? opts.minY : Math.min.apply(null, ys);
    if (maxY === minY) { maxY += 1; minY -= 1; }
    var out = '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none">';
    if (opts.grid) {
      for (var g = 1; g < 4; g++) out += '<line x1="0" x2="' + w + '" y1="' + (h * g / 4) + '" y2="' + (h * g / 4) + '" stroke="#24345F" stroke-width="1"/>';
    }
    series.forEach(function (s) {
      var d = s.pts.map(function (p) {
        var x = (p.time / maxX) * (w - 4) + 2;
        var y = h - 3 - ((p.throughput - minY) / (maxY - minY)) * (h - 6);
        return x.toFixed(1) + "," + y.toFixed(1);
      }).join(" ");
      out += '<polyline fill="none" stroke="' + s.color + '" stroke-width="2" vector-effect="non-scaling-stroke" points="' + d + '"/>';
    });
    return out + "</svg>";
  }

  M.util = { rng: rng, esc: esc, fmtNum: fmtNum, fmtDur: fmtDur, fmtUsd: fmtUsd, clock: clock, load: load, save: save, remove: remove, Timers: Timers, spark: spark };
})();
