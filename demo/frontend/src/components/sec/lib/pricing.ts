/**
 * Enterprise TCO model only (mirrors "Cost Model for Elasticsearch GPUs.xlsx").
 * Annual hardware + system SW + Elasticsearch SW + NVAIE, sized by the number
 * of nodes needed to hit an indexing SLA. Used by the presenter ScaleProjection.
 *
 * The SEC demo runs on the airgapped DDIL kit: inference and embeddings run on
 * the DGX Spark, so there is no per-hour or per-token cloud bill to price here.
 */

/* ─────────────── Enterprise TCO model ─────────────── */
/**
 * Annual per-node cost components — matches the "Assumptions" tab of
 * Cost Model for Elasticsearch GPUs.xlsx.
 */
export const ANNUAL_NODE_USD = {
  cpu: {
    physical: 15_760,
    systemSw: 4_957,
    elasticSw: 114_900,
    nvaie: 0,
    get total() { return this.physical + this.systemSw + this.elasticSw + this.nvaie; },  // 135,617
  },
  gpu: {
    physical: 19_600,    // includes 2× L4 @ $3,850 in the spreadsheet model
    systemSw: 4_957,
    elasticSw: 114_900,
    nvaie: 8_960,
    get total() { return this.physical + this.systemSw + this.elasticSw + this.nvaie; },  // 148,417
  },
} as const;

/** Defaults from the spreadsheet's Assumptions tab. */
export const TCO_DEFAULTS = {
  totalVectors: 10_000_000_000,   // 10 billion
  vectorDim: 1024,
  slaHours: 12,
  /** Per-node measured throughputs from the spreadsheet (Cost Model row 2/3). */
  benchmarkVps: { cpu: 17_919, gpu: 185_600 },
} as const;

export interface TcoResult {
  cpuHoursTotal: number;
  gpuHoursTotal: number;
  cpuNodes: number;
  gpuNodes: number;
  cpuAnnualUsd: number;
  gpuAnnualUsd: number;
  savingsUsd: number;
  savingsPct: number;
  speedupHours: number;       // how much faster GPU indexes on a single node
}

/**
 * Compute the enterprise TCO comparison.
 *   nodes_needed = (vectors / vps / 3600) / slaHours
 *   annual_cost  = nodes_needed × per_node_annual
 *   savings_pct  = 1 - gpu_total / cpu_total
 *
 * Pass measured throughputs from a live race to get "what we just measured
 * projected to enterprise scale". Pass undefined to use spreadsheet baselines.
 */
export function computeTco(opts?: Partial<{
  totalVectors: number;
  slaHours: number;
  cpuVps: number;
  gpuVps: number;
}>): TcoResult {
  const totalVectors = opts?.totalVectors ?? TCO_DEFAULTS.totalVectors;
  const slaHours = opts?.slaHours ?? TCO_DEFAULTS.slaHours;
  const cpuVps = opts?.cpuVps && opts.cpuVps > 0 ? opts.cpuVps : TCO_DEFAULTS.benchmarkVps.cpu;
  const gpuVps = opts?.gpuVps && opts.gpuVps > 0 ? opts.gpuVps : TCO_DEFAULTS.benchmarkVps.gpu;

  const cpuHoursTotal = totalVectors / cpuVps / 3600;
  const gpuHoursTotal = totalVectors / gpuVps / 3600;
  const cpuNodes = cpuHoursTotal / slaHours;
  const gpuNodes = gpuHoursTotal / slaHours;
  const cpuAnnualUsd = cpuNodes * ANNUAL_NODE_USD.cpu.total;
  const gpuAnnualUsd = gpuNodes * ANNUAL_NODE_USD.gpu.total;
  const savingsUsd = cpuAnnualUsd - gpuAnnualUsd;
  return {
    cpuHoursTotal, gpuHoursTotal,
    cpuNodes, gpuNodes,
    cpuAnnualUsd, gpuAnnualUsd,
    savingsUsd,
    savingsPct: cpuAnnualUsd > 0 ? (savingsUsd / cpuAnnualUsd) * 100 : 0,
    speedupHours: cpuHoursTotal - gpuHoursTotal,
  };
}

/* ─────────────── Formatters ─────────────── */
export function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs < 0.01)  return `$${n.toFixed(4)}`;
  if (abs < 10)    return `$${n.toFixed(3)}`;
  if (abs < 1000)  return `$${n.toFixed(2)}`;
  if (abs < 1_000_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${(n / 1_000_000).toFixed(2)}M`;
}

export function fmtVectors(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000)          return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}
