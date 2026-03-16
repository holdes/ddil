import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip as MapTooltip,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Droplets,
  Thermometer,
  Database,
  AlertTriangle,
  TrendingDown,
  Grape,
  MapPin,
  Zap,
} from "lucide-react";
import { useAppContext } from "../../App";

interface BlockSummary {
  block_id: string;
  moisture: number;
  temp: number;
  ec: number;
}

interface DashboardData {
  vineyard: string;
  total_docs: number;
  index_counts: Record<string, number>;
  avg_moisture: number;
  avg_temp: number;
  block_summaries: BlockSummary[];
  blocks_total: number;
}

const BLOCK_META: Record<string, { name: string; variety: string; color: string }> = {
  "BLK-A": { name: "Les Pierres", variety: "Cab Sav", color: "emerald" },
  "BLK-B": { name: "Clos du Vent", variety: "Syrah", color: "purple" },
  "BLK-C": { name: "La Rivière", variety: "Merlot", color: "red" },
  "BLK-D": { name: "Le Jardin", variety: "Chard", color: "amber" },
  "BLK-E": { name: "Vieilles Vignes", variety: "Cab Franc", color: "blue" },
  "BLK-F": { name: "Le Plateau", variety: "Riesling", color: "cyan" },
};

// Hardcoded alerts that match our data stories
const ALERTS = [
  {
    severity: "critical",
    block: "BLK-C",
    title: "Potassium Depletion — La Rivière",
    message: "K levels dropped from 210 to 50 mg/kg since mid-2022. Possible drainage tile failure. Investigate immediately.",
    time: "2h ago",
  },
  {
    severity: "warning",
    block: "BLK-C",
    title: "Persistent High Moisture — La Rivière",
    message: "Soil moisture 15% above normal for 18 months despite dry periods. Correlates with K depletion.",
    time: "4h ago",
  },
  {
    severity: "warning",
    block: "BLK-D",
    title: "Disease Risk Elevated — Le Jardin",
    message: "Humidity + moisture conditions match 2022 powdery mildew outbreak pattern. Monitor closely.",
    time: "1d ago",
  },
  {
    severity: "info",
    block: "BLK-B",
    title: "Drought Watch — Clos du Vent",
    message: "Moisture trending below seasonal average. Wind-exposed block is first to show stress.",
    time: "1d ago",
  },
];

function KPICard({
  label,
  value,
  unit,
  icon,
  subtitle,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-mono font-bold text-slate-100">
        {value}
        {unit && <span className="text-base text-slate-500 ml-1">{unit}</span>}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

function AlertItem({
  alert,
  onClick,
}: {
  alert: (typeof ALERTS)[0];
  onClick: () => void;
}) {
  const colors = {
    critical: "border-red-500/40 bg-red-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    info: "border-blue-500/20 bg-blue-500/5",
  };
  const badges = {
    critical: "bg-red-500/20 text-red-400",
    warning: "bg-amber-500/20 text-amber-400",
    info: "bg-blue-500/20 text-blue-400",
  };

  return (
    <div
      onClick={onClick}
      className={`border rounded-lg p-3 cursor-pointer hover:brightness-125 transition-all ${colors[alert.severity as keyof typeof colors]}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badges[alert.severity as keyof typeof badges]}`}>
            {alert.severity.toUpperCase()}
          </span>
          <span className="text-xs text-slate-500">{alert.block}</span>
        </div>
        <span className="text-[10px] text-slate-600">{alert.time}</span>
      </div>
      <div className="text-sm text-slate-200 font-medium">{alert.title}</div>
      <div className="text-xs text-slate-400 mt-1">{alert.message}</div>
    </div>
  );
}

interface BlockPolygon {
  id: string;
  name: string;
  variety: string;
  polygon: { lat: number; lon: number }[];
}

interface VineyardConfig {
  center: { lat: number; lon: number };
  blocks: BlockPolygon[];
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [vineyardConfig, setVineyardConfig] = useState<VineyardConfig | null>(null);
  const { investigateBlock, investigate, navigateTo } = useAppContext();

  useEffect(() => {
    fetch("/api/vineyard/config")
      .then((r) => r.json())
      .then(setVineyardConfig)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/vineyard/dashboard")
      .then((r) => r.json())
      .then((d) => {
        // Use mock data if ES indices are empty
        if (!d.block_summaries || d.block_summaries.length === 0) {
          throw new Error("empty");
        }
        setData(d);
      })
      .catch(() => {
        setData({
          vineyard: "Domaine de la Côte Cachée",
          total_docs: 869000,
          index_counts: {
            "vineyard-soil": 841536,
            "vineyard-npk": 10032,
            "vineyard-imagery": 17151,
            "vineyard-harvest": 175,
            "vineyard-wine": 106,
          },
          avg_moisture: 32.4,
          avg_temp: 18.2,
          block_summaries: [
            { block_id: "BLK-A", moisture: 34.1, temp: 19.5, ec: 0.41 },
            { block_id: "BLK-B", moisture: 22.8, temp: 21.2, ec: 0.33 },
            { block_id: "BLK-C", moisture: 46.2, temp: 17.8, ec: 0.78 },
            { block_id: "BLK-D", moisture: 31.5, temp: 16.4, ec: 0.37 },
            { block_id: "BLK-E", moisture: 35.8, temp: 18.9, ec: 0.46 },
            { block_id: "BLK-F", moisture: 24.1, temp: 15.2, ec: 0.30 },
          ],
          blocks_total: 6,
        });
      });
  }, []);

  if (!data) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-slate-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Grape size={24} className="text-emerald-400" />
          {data.vineyard}
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Walla Walla AVA &middot; 6 blocks &middot; {data.total_docs.toLocaleString()} indexed documents
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          label="Avg Moisture"
          value={data.avg_moisture}
          unit="%"
          icon={<Droplets size={14} />}
          subtitle="Across all blocks"
        />
        <KPICard
          label="Avg Soil Temp"
          value={data.avg_temp}
          unit="°C"
          icon={<Thermometer size={14} />}
          subtitle="6-inch depth"
        />
        <KPICard
          label="Total Records"
          value={data.total_docs.toLocaleString()}
          icon={<Database size={14} />}
          subtitle="5 indices"
        />
        <KPICard
          label="Active Alerts"
          value={ALERTS.filter((a) => a.severity !== "info").length}
          icon={<AlertTriangle size={14} />}
          subtitle={`${ALERTS.filter((a) => a.severity === "critical").length} critical`}
        />
      </div>

      {/* Mini Map + Block Grid Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Mini Map */}
        <div className="col-span-1">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <MapPin size={14} />
            Estate Overview
          </h3>
          <div className="rounded-xl overflow-hidden border border-slate-800 h-64 cursor-pointer"
            onClick={() => navigateTo("vineyard" as any)}
          >
            {vineyardConfig ? (
              <MapContainer
                center={[vineyardConfig.center.lat, vineyardConfig.center.lon] as LatLngExpression}
                zoom={15}
                className="w-full h-full"
                style={{ background: "#0f172a" }}
                zoomControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                attributionControl={false}
              >
                <TileLayer url="/tiles/{z}/{x}/{y}.png" />
                {vineyardConfig.blocks.map((block) => {
                  const blockData = data.block_summaries.find((s) => s.block_id === block.id);
                  const isAlert = blockData && (blockData.moisture > 45 || blockData.moisture < 25);
                  const isWatch = blockData && (blockData.moisture > 40 || blockData.moisture < 30);
                  const status = isAlert ? "alert" : isWatch ? "watch" : "healthy";
                  const fillColor = status === "alert" ? "#ef4444" : status === "watch" ? "#f59e0b" : "#10b981";
                  const positions: LatLngExpression[] = block.polygon.map(
                    (p) => [p.lat, p.lon] as LatLngExpression
                  );
                  return (
                    <Polygon
                      key={block.id}
                      positions={positions}
                      pathOptions={{ fillColor, fillOpacity: 0.4, color: fillColor, weight: 2 }}
                      eventHandlers={{ click: () => investigateBlock(block.id) }}
                    >
                      <MapTooltip className="!bg-slate-900 !border-slate-700 !text-slate-100 !rounded-lg !px-2 !py-1 !text-xs">
                        <strong>{block.name}</strong> — {block.variety}
                      </MapTooltip>
                    </Polygon>
                  );
                })}
              </MapContainer>
            ) : (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-600 text-xs">
                Loading map...
              </div>
            )}
          </div>
          <div className="text-[10px] text-slate-600 mt-1 text-center">Click to open full vineyard view</div>
        </div>

        {/* Block Status Cards */}
        <div className="col-span-2">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Block Status</h3>
          <div className="grid grid-cols-3 gap-3">
            {data.block_summaries.map((block) => {
              const meta = BLOCK_META[block.block_id] || {
                name: block.block_id,
                variety: "Unknown",
                color: "slate",
              };
              const isAlert = block.moisture > 45 || block.moisture < 25;
              const isWatch = block.moisture > 40 || block.moisture < 30;
              const status = isAlert ? "alert" : isWatch ? "watch" : "healthy";

              return (
                <motion.button
                  key={block.block_id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => investigateBlock(block.block_id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    status === "alert"
                      ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"
                      : status === "watch"
                      ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                      : "border-slate-800 bg-slate-900/40 hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-500">
                      {block.block_id}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        status === "alert"
                          ? "bg-red-500 animate-pulse"
                          : status === "watch"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    />
                  </div>
                  <div className="text-sm font-medium text-slate-200">
                    {meta.name}
                  </div>
                  <div className="text-xs text-slate-500 mb-3">
                    {meta.variety}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">Moisture</div>
                      <div className={`font-mono font-bold ${
                        block.moisture < 25
                          ? "text-red-400"
                          : block.moisture > 45
                          ? "text-blue-400"
                          : "text-emerald-400"
                      }`}>
                        {block.moisture.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Temp</div>
                      <div className="font-mono font-bold text-orange-400">
                        {block.temp.toFixed(1)}°
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">EC</div>
                      <div className={`font-mono font-bold ${
                        block.ec > 0.6 ? "text-amber-400" : "text-slate-300"
                      }`}>
                        {block.ec.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alerts + Quick Investigate Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Alerts Feed */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            Alerts & Anomalies
          </h3>
          <div className="space-y-2">
            {ALERTS.map((alert, i) => (
              <AlertItem
                key={i}
                alert={alert}
                onClick={() => investigateBlock(alert.block, alert.title + " — " + alert.message)}
              />
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Zap size={14} className="text-emerald-400" />
              Quick Investigate
            </h3>
            <div className="space-y-2">
              {[
                "Why is Block C underperforming?",
                "Compare the 2020 and 2022 vintages",
                "Which blocks need attention this week?",
                "What caused the potassium cliff in La Rivière?",
                "Show me the best performing block and explain why",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => investigate(q)}
                  className="w-full text-left text-xs p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
