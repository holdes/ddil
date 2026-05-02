// Health probes for the Sovereign AI stack.
// In dev / on a Mac with no backend, set MOCK = true (default).
// On the Framework with backend running, flip MOCK = false (or remove the flag)
// and these will hit the real endpoints.

export type ServiceId =
  | 'es-gpu'
  | 'es-cpu'
  | 'ollama-llm'
  | 'ollama-embed'
  | 'sensors'
  | 'backend'

export interface ServiceCheck {
  id: ServiceId
  label: string
  endpoint: string
  detail?: string
}

export interface ServiceResult {
  id: ServiceId
  ok: boolean
  latencyMs: number
  message: string
}

export const SERVICES: ServiceCheck[] = [
  { id: 'es-gpu',      label: 'Elasticsearch (GPU)',  endpoint: 'http://192.168.1.20:9200/_cluster/health',  detail: 'cuVS HNSW · DGX Spark' },
  { id: 'es-cpu',      label: 'Elasticsearch (CPU)',  endpoint: 'http://192.168.1.20:9201/_cluster/health',  detail: 'Standard HNSW · DGX Spark' },
  { id: 'ollama-llm',  label: 'Ollama LLM',           endpoint: 'http://192.168.1.20:11434/api/tags',         detail: 'llama3.1:70b · DGX Spark' },
  { id: 'ollama-embed',label: 'Ollama Embeddings',    endpoint: 'http://192.168.1.10:11434/api/tags',         detail: 'nomic-embed-text · Framework' },
  { id: 'backend',     label: 'Demo Backend',         endpoint: '/api/health',                                detail: 'FastAPI · Framework' },
  { id: 'sensors',     label: 'Field Sensor Bus',     endpoint: '/api/sensors/status',                        detail: 'RS485 Modbus · Telemetry' },
]

const MOCK = true

function rand(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min))
}

async function realCheck(svc: ServiceCheck): Promise<ServiceResult> {
  const t0 = performance.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(svc.endpoint, { signal: ctrl.signal })
    clearTimeout(timer)
    const ms = Math.round(performance.now() - t0)
    if (!res.ok) return { id: svc.id, ok: false, latencyMs: ms, message: `HTTP ${res.status}` }
    return { id: svc.id, ok: true, latencyMs: ms, message: 'OK' }
  } catch (err) {
    const ms = Math.round(performance.now() - t0)
    const msg = err instanceof Error ? err.message : 'unreachable'
    return { id: svc.id, ok: false, latencyMs: ms, message: msg }
  }
}

async function mockCheck(svc: ServiceCheck): Promise<ServiceResult> {
  // Simulate variable latency. CPU ES is the slow kid in class; GPU is faster.
  const base: Record<ServiceId, [number, number]> = {
    'es-gpu':       [120, 280],
    'es-cpu':       [240, 520],
    'ollama-llm':   [180, 360],
    'ollama-embed': [80, 160],
    'backend':      [40, 90],
    'sensors':      [60, 140],
  }
  const [lo, hi] = base[svc.id]
  const delay = rand(lo, hi)
  await new Promise(r => setTimeout(r, delay))
  // ~95% success rate per service so the "all green" feels earned
  const ok = Math.random() > 0.05
  return {
    id: svc.id,
    ok,
    latencyMs: delay,
    message: ok ? 'OK' : 'timeout',
  }
}

export async function checkService(svc: ServiceCheck): Promise<ServiceResult> {
  return MOCK ? mockCheck(svc) : realCheck(svc)
}

export const ASCII_BANNER = String.raw`
   ____                              _              _    ___
  / ___|  _____   _____ _ __ ___  __ _ _ __        / \  |_ _|
  \___ \ / _ \ \ / / _ \ '__/ _ \/ _' | '_ \      / _ \  | |
   ___) | (_) \ V /  __/ | |  __/ (_| | | | |    / ___ \ | |
  |____/ \___/ \_/ \___|_|  \___|\__, |_| |_|   /_/   \_\___|
                                 |___/
              Context Engineering Anywhere · v0.1
`
