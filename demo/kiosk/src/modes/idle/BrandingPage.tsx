import { QRCodeSVG } from 'qrcode.react'
import { ElasticLogo } from '../../components/ElasticLogo'
import { NvidiaLogo } from '../../components/NvidiaLogo'
import { SecretTap } from '../../components/SecretTap'

const TICKER_LINES = [
  '◆  Multi-index hybrid retrieval — dense + BM25 + RRF',
  '◆  GPU vector indexing on cuVS — 8× faster than CPU baseline',
  '◆  Local LLM inference on DGX Spark — llama3.1:70b',
  '◆  Local embeddings on Framework — nomic-embed-text',
  '◆  Fully airgapped — zero cloud dependency',
  '◆  Context engineering anywhere — even disconnected',
  '◆  Pluggable demo runtimes — swap apps, keep the stack',
]

const QR_URL = 'https://www.elastic.co/geospatial'

interface Props {
  onSecretUnlock: () => void
}

export function BrandingPage({ onSecretUnlock }: Props) {
  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_1.4fr_1fr]">
      {/* LEFT: Elastic identity (also the secret tap target) */}
      <div className="flex flex-col justify-center items-center gap-4 border-r border-white/5 px-4">
        <SecretTap taps={5} windowMs={3000} onUnlock={onSecretUnlock} className="cursor-pointer">
          <ElasticLogo variant="horizontal" size={64} />
        </SecretTap>
        <div className="text-white/50 text-[10px] uppercase tracking-[0.3em] text-center">
          Search · Observability · Security
        </div>
        <div className="px-3 py-1 rounded-full border border-elastic-teal/40 bg-elastic-teal/10 text-elastic-teal text-[10px] uppercase tracking-widest">
          Edge AI Platform
        </div>
      </div>

      {/* CENTER: QR code centered, text below, ticker at bottom */}
      <div className="relative flex flex-col items-center justify-center px-6 min-w-0 overflow-hidden">
        {/* QR */}
        <div className="bg-white p-2 rounded-md shadow-lg shadow-black/40">
          <QRCodeSVG
            value={QR_URL}
            size={140}
            level="M"
            bgColor="#ffffff"
            fgColor="#1d1e24"
            marginSize={0}
          />
        </div>

        {/* Headline block */}
        <div className="text-center mt-3">
          <div className="text-[9px] uppercase tracking-[0.4em] text-white/40">
            Your Models · Your Data · Your Edge
          </div>
          <div className="text-white text-2xl font-bold mt-1 leading-none">
            <span className="text-elastic-teal">Sovereign</span>
            <span className="text-white/90"> AI</span>
          </div>
          <div className="text-white/60 text-[11px] mt-1 leading-snug">
            Context Engineering Anywhere
          </div>
          <div className="text-white/35 text-[9px] mt-2 uppercase tracking-widest">
            Scan ▸ elastic.co/geospatial
          </div>
        </div>

        {/* Marquee pinned to bottom of column */}
        <div className="absolute left-0 right-0 bottom-7 overflow-hidden h-5 border-y border-white/5">
          <div
            className="absolute whitespace-nowrap text-[11px] text-white/60 flex gap-8"
            style={{ animation: 'ticker 60s linear infinite' }}
          >
            {[...TICKER_LINES, ...TICKER_LINES].map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: NVIDIA / DGX identity */}
      <div className="flex flex-col justify-center items-center gap-3 border-l border-white/5 px-4">
        <NvidiaLogo variant="vertical" size={92} />
        <div className="text-white/50 text-[10px] uppercase tracking-[0.3em] text-center">
          DGX Spark · GB10 Blackwell · 128GB
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 rounded-full border border-nvidia-green/40 bg-nvidia-green/10 text-nvidia-green text-[10px] uppercase tracking-widest">
            cuVS GPU
          </div>
          <div className="px-3 py-1 rounded-full border border-white/15 bg-white/5 text-white/60 text-[10px] uppercase tracking-widest">
            llama3.1:70b
          </div>
        </div>
      </div>
    </div>
  )
}
