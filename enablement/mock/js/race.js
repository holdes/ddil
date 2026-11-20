/* Staged race replay. Mirrors demo/backend/app/services/indexer.py + metrics.py exactly:
   GPU target 28,500 v/s, merge 48 ms, 15 s. CPU 4,200 v/s, merge 340 ms, 55 s. 841,536 docs.
   Ticks every 500 ms. Displayed throughput = target x ramp x gauss(1, 0.05). Progress is linear.
   Final throughput = TOTAL_DOCS / elapsed. Recall is hardcoded 98.9 / 98.7.
   The only change from the backend: a seeded PRNG so every rehearsal looks the same. */
(function () {
  var M = window.MOCK, U = M.util;
  var TOTAL_DOCS = 841536;
  var PATHS = {
    gpu: { target: 28500, merge: 48, seconds: 15, seed: 42 },
    cpu: { target: 4200, merge: 340, seconds: 55, seed: 7 },
  };

  function emptyPath() {
    return { docsIndexed: 0, totalDocs: 0, throughput: 0, mergeTimeMs: 0, cpuPercent: null, gpuPercent: null,
      memoryUsedGb: null, history: [], complete: false, elapsedMs: 0, mergePhase: false, started: false };
  }

  function Race(onUpdate) {
    this.onUpdate = onUpdate || function () {};
    this.timers = new U.Timers();
    this.reset(true);
  }

  Race.prototype.reset = function (silent) {
    this.timers.cancel();
    this.gpu = emptyPath();
    this.cpu = emptyPath();
    this.status = "idle";
    this.tick = 0;
    this.rngs = { gpu: U.rng(PATHS.gpu.seed), cpu: U.rng(PATHS.cpu.seed) };
    if (!silent) this.onUpdate();
  };

  // One 500 ms step for one path (indexer.py _simulate_path loop body).
  Race.prototype._step = function (label, i) {
    var cfg = PATHS[label], p = this[label], r = this.rngs[label];
    var steps = Math.floor(cfg.seconds / 0.5);
    if (p.complete) return;
    if (i < steps) {
      var docsPerStep = TOTAL_DOCS / steps;
      var progress = (i + 1) / steps;
      var ramp = Math.min(1.0, progress * 3);
      var noise = r.gauss(1.0, 0.05);
      var tp = cfg.target * ramp * noise;
      p.started = true;
      p.totalDocs = TOTAL_DOCS;
      p.docsIndexed = Math.min(TOTAL_DOCS, Math.floor(docsPerStep * (i + 1)));
      p.elapsedMs = (i + 1) * 500;
      p.throughput = tp;
      p.mergeTimeMs = cfg.merge * (0.8 + r() * 0.4);
      if (label === "gpu") {
        p.gpuPercent = 65 + r.gauss(0, 8);
        p.cpuPercent = 25 + r.gauss(0, 5);
        p.memoryUsedGb = 12.4 + r.gauss(0, 0.3);
      } else {
        p.cpuPercent = 85 + r.gauss(0, 6);
        p.gpuPercent = 0; // backend sets 0, so the CPU card reads "GPU Util 0%"
        p.memoryUsedGb = 6.2 + r.gauss(0, 0.2);
      }
      p.history.push({ time: Math.round(p.elapsedMs / 100) / 10, throughput: Math.round(tp) });
      if (p.history.length > 120) p.history = p.history.slice(-120);
      if (i === steps - 1) {
        // Final merge + completion (same tick in the backend: no extra sleep)
        p.mergePhase = true;
        p.mergeTimeMs = cfg.merge;
        p.docsIndexed = TOTAL_DOCS;
        p.throughput = TOTAL_DOCS / (p.elapsedMs / 1000);
        p.complete = true;
      }
    }
  };

  Race.prototype._advance = function () {
    this._step("gpu", this.tick);
    this._step("cpu", this.tick);
    this.tick++;
    if (this.gpu.complete && this.cpu.complete) this.status = "complete";
  };

  Race.prototype.start = function () {
    if (this.status === "running") return;
    this.reset(true);
    this.status = "running";
    this.onUpdate();
    var self = this;
    var loop = function () {
      self._advance();
      self.onUpdate();
      if (self.status === "running") self.timers.later(500, loop);
    };
    this.timers.later(500, loop);
  };

  // Jump straight to a state for screenshots / rehearsal: "mid" = GPU done, CPU running; "end" = both done.
  Race.prototype.jump = function (where) {
    this.reset(true);
    this.status = "running";
    var stopAt = where === "mid" ? 34 : 110;
    while (this.tick < stopAt) this._advance();
    if (this.status === "running" && where === "mid") {
      var self = this;
      var loop = function () { self._advance(); self.onUpdate(); if (self.status === "running") self.timers.later(500, loop); };
      this.timers.later(500, loop);
    }
    this.onUpdate();
  };

  function phaseOf(p) { return p.complete ? "complete" : p.mergePhase ? "force_merging" : p.started ? "ingesting" : "idle"; }

  // metrics.py RaceMetrics.to_dict()
  Race.prototype.metrics = function () {
    var ge = this.gpu.elapsedMs ? this.gpu.elapsedMs / 1000 : 1;
    var ce = this.cpu.elapsedMs ? this.cpu.elapsedMs / 1000 : 1;
    var gm = this.gpu.mergeTimeMs || 1, cm = this.cpu.mergeTimeMs || 1;
    var r1 = function (x) { return Math.round(x * 10) / 10; };
    var path = function (p) {
      return { docsIndexed: p.docsIndexed, totalDocs: p.totalDocs, throughput: r1(p.throughput), phase: phaseOf(p),
        ingestMs: Math.round(p.elapsedMs), forceMergeMs: r1(p.mergeTimeMs), mergeTimeMs: r1(p.mergeTimeMs),
        cpuPercent: p.cpuPercent, gpuPercent: p.gpuPercent, memoryUsedGb: p.memoryUsedGb, history: p.history,
        complete: p.complete, elapsedMs: Math.round(p.elapsedMs) };
    };
    return {
      gpu: path(this.gpu), cpu: path(this.cpu),
      speedup: r1(ce / ge), ingestSpeedup: r1(ce / ge), forceMergeSpeedup: r1(cm / gm),
      timeSaved: Math.round(Math.max(0, ce - ge) * 1000), recallGpu: 98.9, recallCpu: 98.7, status: this.status,
    };
  };

  Race.TOTAL_DOCS = TOTAL_DOCS;
  M.Race = Race;
})();
