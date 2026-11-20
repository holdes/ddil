// Staged GPU vs CPU race: a line-for-line port of demo/backend/app/services/indexer.py + metrics.py.
// GPU 28,500 v/s target, 48 ms merge, 15 s; CPU 4,200 v/s target, 340 ms merge, 55 s; 841,536 docs; 500 ms ticks.
const TOTAL_DOCS = 841536;

function gauss(mu, sigma) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function newPath() {
  return { docs_indexed: 0, total_docs: 0, throughput: 0, merge_time_ms: 0, cpu_percent: null, gpu_percent: null,
    memory_used_gb: null, history: [], complete: false, start_time: 0, elapsed_ms: 0, merge_phase: false };
}
function newRace(status = "idle") { return { gpu: newPath(), cpu: newPath(), status }; }

const r1 = (x) => Math.round(x * 10) / 10;

function pathDict(p) {
  const phase = p.complete ? "complete" : p.merge_phase ? "force_merging" : p.start_time ? "ingesting" : "idle";
  return {
    docsIndexed: p.docs_indexed, totalDocs: p.total_docs, throughput: r1(p.throughput), phase,
    ingestMs: Math.round(p.elapsed_ms), forceMergeMs: r1(p.merge_time_ms), mergeTimeMs: r1(p.merge_time_ms),
    cpuPercent: p.cpu_percent, gpuPercent: p.gpu_percent, memoryUsedGb: p.memory_used_gb,
    history: p.history, complete: p.complete, elapsedMs: Math.round(p.elapsed_ms),
  };
}

export function makeRace() {
  let race = newRace();
  let gen = 0; // bumps on start/reset so stale timers stop

  function toDict() {
    const g = race.gpu, c = race.cpu;
    const ge = g.elapsed_ms ? g.elapsed_ms / 1000 : 1;
    const ce = c.elapsed_ms ? c.elapsed_ms / 1000 : 1;
    const gm = g.merge_time_ms || 1, cm = c.merge_time_ms || 1;
    return {
      gpu: pathDict(g), cpu: pathDict(c),
      speedup: r1(ce / ge), ingestSpeedup: r1(ce / ge), forceMergeSpeedup: r1(cm / gm),
      timeSaved: Math.round(Math.max(0, ce - ge) * 1000),
      recallGpu: 98.9, recallCpu: 98.7, status: race.status,
    };
  }

  function simulate(p, label, target, mergeMs, totalSec, myGen, done) {
    p.start_time = Date.now();
    p.total_docs = TOTAL_DOCS;
    const steps = Math.floor(totalSec / 0.5);
    const perStep = TOTAL_DOCS / steps;
    let i = 0;
    const tick = () => {
      if (myGen !== gen) return;
      const progress = (i + 1) / steps;
      const ramp = Math.min(1, progress * 3);
      const tp = target * ramp * gauss(1, 0.05);
      p.docs_indexed = Math.min(TOTAL_DOCS, Math.floor(perStep * (i + 1)));
      p.elapsed_ms = Date.now() - p.start_time;
      p.throughput = tp;
      p.merge_time_ms = mergeMs * (0.8 + Math.random() * 0.4);
      if (label === "gpu") {
        p.gpu_percent = 65 + gauss(0, 8); p.cpu_percent = 25 + gauss(0, 5); p.memory_used_gb = 12.4 + gauss(0, 0.3);
      } else {
        p.cpu_percent = 85 + gauss(0, 6); p.gpu_percent = 0; p.memory_used_gb = 6.2 + gauss(0, 0.2);
      }
      p.history.push({ time: r1(p.elapsed_ms / 1000), throughput: Math.round(tp) });
      if (p.history.length > 120) p.history = p.history.slice(-120);
      i += 1;
      if (i < steps) { setTimeout(tick, 500); return; }
      p.merge_phase = true;
      p.merge_time_ms = mergeMs;
      p.docs_indexed = TOTAL_DOCS;
      p.elapsed_ms = Date.now() - p.start_time;
      p.throughput = TOTAL_DOCS / (p.elapsed_ms / 1000);
      p.complete = true;
      done();
    };
    setTimeout(tick, 500);
  }

  function start() {
    gen += 1;
    const myGen = gen;
    race = newRace("running");
    let left = 2;
    const done = () => { if (myGen === gen && --left === 0) race.status = "complete"; };
    simulate(race.gpu, "gpu", 28500, 48, 15, myGen, done);
    simulate(race.cpu, "cpu", 4200, 340, 55, myGen, done);
  }
  function reset() { gen += 1; race = newRace(); }

  return { start, reset, toDict, status: () => race.status };
}
