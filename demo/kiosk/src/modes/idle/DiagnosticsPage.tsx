import { useEffect, useState } from 'react'
import { ElasticLogo } from '../../components/ElasticLogo'
import { NvidiaLogo } from '../../components/NvidiaLogo'

interface NodeTelemetry {
  cpuPct: number
  gpuPct: number
  ramUsedGb: number
  ramTotalGb: number
  vramUsedGb: number
  vramTotalGb: number
  tempC: number
  uptime: string
}

function rollFramework(): NodeTelemetry {
  return {
    cpuPct: 38 + Math.floor(Math.random() * 14),
    gpuPct: 12 + Math.floor(Math.random() * 8),
    ramUsedGb: 17 + Math.random() * 3,
    ramTotalGb: 64,
    vramUsedGb: 0,
    vramTotalGb: 0,
    tempC: 49 + Math.floor(Math.random() * 5),
    uptime: '2d 14h 06m',
  }
}

function rollSpark(): NodeTelemetry {
  return {
    cpuPct: 22 + Math.floor(Math.random() * 8),
    gpuPct: 58 + Math.floor(Math.random() * 14),
    ramUsedGb: 0,
    ramTotalGb: 0,
    vramUsedGb: 78 + Math.random() * 6,
    vramTotalGb: 128,
    tempC: 64 + Math.floor(Math.random() * 6),
    uptime: '1d 09h 41m',
  }
}

export function DiagnosticsPage() {
  const [framework, setFramework] = useState(rollFramework)
  const [spark, setSpark]         = useState(rollSpark)

  useEffect(() => {
    const i = setInterval(() => {
      setFramework(rollFramework())
      setSpark(rollSpark())
    }, 2000)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="absolute inset-0 grid grid-rows-[1fr_auto] font-mono">
      {/* TOP: two compute-node cards side by side */}
      <div className="grid grid-cols-2 divide-x divide-white/5">
        <NodeCard
          ipPillClass="text-elastic-blue border-elastic-blue/40 bg-elastic-blue/10"
          primaryBarClass="bg-elastic-blue"
          icon={<ElasticLogo variant="mark" size={28} />}
          name="Framework Desktop"
          model="Ryzen AI Max+ 395"
          extras={['64GB DDR5', 'x86_64', 'Ubuntu 24.04']}
          ip="192.168.1.10"
          role="Frontend · Backend · Embeddings"
          t={framework}
          showVram={false}
        />
        <NodeCard
          ipPillClass="text-nvidia-green border-nvidia-green/40 bg-nvidia-green/10"
          primaryBarClass="bg-nvidia-green"
          icon={<NvidiaLogo variant="mark" size={28} />}
          name="DGX Spark"
          model="GB10 Blackwell"
          extras={['128GB Unified', 'aarch64', 'DGX OS']}
          ip="192.168.1.20"
          role="Elasticsearch · LLM · GPU vector index"
          t={spark}
          showVram={true}
        />
      </div>

      {/* BOTTOM: kit-level info strip */}
      <div className="border-t border-white/5 bg-bg-elev px-4 py-2 grid grid-cols-4 gap-4 text-[10px]">
        <Kv label="NETWORK" value="192.168.1.0/24" sub="UniFi Express 7" />
        <Kv label="WAN" value="OFFLINE" sub="airgapped · expected" valueClass="text-elastic-pink" />
        <Kv label="DISPLAY" value="1280×400" sub="DeskPi 7.84″ touch" />
        <Kv label="CONSOLE" value="JetKVM" sub="remote KVM available" />
      </div>
    </div>
  )
}

function NodeCard({
  ipPillClass, primaryBarClass, icon, name, model, extras, ip, role, t, showVram,
}: {
  ipPillClass: string
  primaryBarClass: string
  icon: React.ReactNode
  name: string
  model: string
  extras: string[]
  ip: string
  role: string
  t: NodeTelemetry
  showVram: boolean
}) {
  return (
    <div className="px-5 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="text-white text-[15px] font-semibold leading-tight">{name}</div>
          <div className="text-white/50 text-[10px] uppercase tracking-widest">{model}</div>
        </div>
        <div className={`text-[10px] tabular-nums px-2 py-0.5 rounded border ${ipPillClass}`}>
          {ip}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {extras.map(e => (
          <span key={e} className="text-[9px] uppercase tracking-widest text-white/45 border border-white/10 rounded px-1.5 py-0.5">
            {e}
          </span>
        ))}
      </div>

      <div className="text-white/55 text-[10px] italic">{role}</div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
        <Bar label="CPU" pct={t.cpuPct} barClass={primaryBarClass} />
        <Bar label="GPU" pct={t.gpuPct} barClass="bg-nvidia-green" />
        {showVram ? (
          <Bar
            label="VRAM"
            pct={Math.round((t.vramUsedGb / t.vramTotalGb) * 100)}
            barClass="bg-elastic-teal"
            suffix={`${t.vramUsedGb.toFixed(1)} / ${t.vramTotalGb} GB`}
          />
        ) : (
          <Bar
            label="RAM"
            pct={Math.round((t.ramUsedGb / t.ramTotalGb) * 100)}
            barClass="bg-elastic-teal"
            suffix={`${t.ramUsedGb.toFixed(1)} / ${t.ramTotalGb} GB`}
          />
        )}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-white/40 uppercase tracking-widest">Temp</span>
          <span className={`tabular-nums ${t.tempC > 70 ? 'text-elastic-pink' : 'text-white/80'}`}>
            {t.tempC}°C
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] mt-auto pt-1 border-t border-white/5">
        <span className="text-white/40 uppercase tracking-widest">Uptime</span>
        <span className="text-white/70 tabular-nums">{t.uptime}</span>
      </div>
    </div>
  )
}

function Bar({ label, pct, barClass, suffix }: { label: string; pct: number; barClass: string; suffix?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/40 uppercase tracking-widest">{label}</span>
        <span className="text-white/70 tabular-nums">{suffix ?? `${pct}%`}</span>
      </div>
      <div className="h-1 bg-white/5 rounded mt-0.5 overflow-hidden">
        <div className={`h-full transition-all duration-700 ${barClass}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

function Kv({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-white/35 uppercase tracking-widest text-[9px]">{label}</div>
      <div className={`text-white/85 text-[12px] font-semibold ${valueClass ?? ''}`}>{value}</div>
      {sub && <div className="text-white/40 text-[9px]">{sub}</div>}
    </div>
  )
}
