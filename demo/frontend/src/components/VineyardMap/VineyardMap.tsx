import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip as MapTooltip,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Droplets,
  Thermometer,
  FlaskConical,
  AlertTriangle,
  Leaf,
  X,
  MapPin,
  MessageSquare,
} from "lucide-react";
import { useAppContext } from "../../App";

interface BlockConfig {
  id: string;
  name: string;
  variety: string;
  acres: number;
  elevation_m: number;
  aspect: string;
  soil_type: string;
  story: string;
  polygon: { lat: number; lon: number }[];
}

interface VineyardConfig {
  id: string;
  name: string;
  region: string;
  center: { lat: number; lon: number };
  blocks: BlockConfig[];
}

interface BlockSummary {
  block_id: string;
  block_name: string;
  variety: string;
  health: "healthy" | "watch" | "alert";
  alerts: { type: string; message: string }[];
  soil: { moisture_pct: number | null; temp_6in_c: number | null; temp_12in_c: number | null; ec: number | null };
  npk: { nitrogen: number | null; phosphorus: number | null; potassium: number | null; ph: number | null };
  latest_harvest: { vintage_year: number | null; grape_mass_kg: number | null; sugar_brix: number | null; quality_score: number | null };
}

type ColorMode = "health" | "moisture" | "temperature" | "potassium";

const MOCK_SUMMARIES: Record<string, BlockSummary> = {
  "BLK-A": { block_id: "BLK-A", block_name: "Les Pierres", variety: "Cabernet Sauvignon", health: "healthy", alerts: [], soil: { moisture_pct: 34.1, temp_6in_c: 19.5, temp_12in_c: 18.0, ec: 0.41 }, npk: { nitrogen: 48, phosphorus: 29, potassium: 195, ph: 7.2 }, latest_harvest: { vintage_year: 2024, grape_mass_kg: 4850, sugar_brix: 24.8, quality_score: 8 } },
  "BLK-B": { block_id: "BLK-B", block_name: "Clos du Vent", variety: "Syrah", health: "watch", alerts: [{ type: "drought", message: "Moisture below optimal — wind-exposed block" }], soil: { moisture_pct: 22.8, temp_6in_c: 21.2, temp_12in_c: 19.8, ec: 0.33 }, npk: { nitrogen: 32, phosphorus: 21, potassium: 158, ph: 7.0 }, latest_harvest: { vintage_year: 2024, grape_mass_kg: 2100, sugar_brix: 26.5, quality_score: 7 } },
  "BLK-C": { block_id: "BLK-C", block_name: "La Rivière", variety: "Merlot", health: "alert", alerts: [{ type: "nutrient", message: "Potassium critically low (50 mg/kg)" }, { type: "saturation", message: "Persistent high moisture — drainage failure suspected" }], soil: { moisture_pct: 46.2, temp_6in_c: 17.8, temp_12in_c: 16.5, ec: 0.78 }, npk: { nitrogen: 52, phosphorus: 33, potassium: 50, ph: 6.8 }, latest_harvest: { vintage_year: 2024, grape_mass_kg: 2800, sugar_brix: 22.1, quality_score: 5 } },
  "BLK-D": { block_id: "BLK-D", block_name: "Le Jardin", variety: "Chardonnay", health: "watch", alerts: [{ type: "disease", message: "Conditions match 2022 powdery mildew pattern" }], soil: { moisture_pct: 31.5, temp_6in_c: 16.4, temp_12in_c: 15.2, ec: 0.37 }, npk: { nitrogen: 37, phosphorus: 24, potassium: 168, ph: 6.5 }, latest_harvest: { vintage_year: 2024, grape_mass_kg: 3900, sugar_brix: 22.5, quality_score: 6 } },
  "BLK-E": { block_id: "BLK-E", block_name: "Vieilles Vignes", variety: "Cabernet Franc", health: "healthy", alerts: [], soil: { moisture_pct: 35.8, temp_6in_c: 18.9, temp_12in_c: 17.5, ec: 0.46 }, npk: { nitrogen: 51, phosphorus: 31, potassium: 198, ph: 6.9 }, latest_harvest: { vintage_year: 2024, grape_mass_kg: 2400, sugar_brix: 24.2, quality_score: 8 } },
  "BLK-F": { block_id: "BLK-F", block_name: "Le Plateau", variety: "Riesling", health: "healthy", alerts: [], soil: { moisture_pct: 24.1, temp_6in_c: 15.2, temp_12in_c: 14.0, ec: 0.30 }, npk: { nitrogen: 26, phosphorus: 17, potassium: 142, ph: 7.8 }, latest_harvest: { vintage_year: 2024, grape_mass_kg: 2800, sugar_brix: 21.5, quality_score: 7 } },
};

function getBlockColor(summary: BlockSummary | undefined, mode: ColorMode): { fill: string; stroke: string } {
  if (!summary) return { fill: "rgba(100,116,139,0.3)", stroke: "#475569" };
  const m = summary.soil?.moisture_pct ?? 35;
  const t = summary.soil?.temp_6in_c ?? 18;
  const k = summary.npk?.potassium ?? 180;
  const h = summary.health ?? "healthy";

  const healthStroke = h === "alert" ? "#ef4444" : h === "watch" ? "#f59e0b" : "#10b981";

  switch (mode) {
    case "moisture":
      if (m < 25) return { fill: "rgba(239,68,68,0.45)", stroke: healthStroke };
      if (m < 32) return { fill: "rgba(245,158,11,0.35)", stroke: healthStroke };
      if (m < 42) return { fill: "rgba(16,185,129,0.35)", stroke: healthStroke };
      return { fill: "rgba(59,130,246,0.35)", stroke: healthStroke };
    case "temperature":
      if (t < 14) return { fill: "rgba(59,130,246,0.35)", stroke: healthStroke };
      if (t < 18) return { fill: "rgba(16,185,129,0.35)", stroke: healthStroke };
      if (t < 22) return { fill: "rgba(245,158,11,0.35)", stroke: healthStroke };
      return { fill: "rgba(239,68,68,0.35)", stroke: healthStroke };
    case "potassium":
      if (k < 100) return { fill: "rgba(239,68,68,0.45)", stroke: "#ef4444" };
      if (k < 150) return { fill: "rgba(245,158,11,0.35)", stroke: "#f59e0b" };
      return { fill: "rgba(16,185,129,0.35)", stroke: healthStroke };
    case "health":
      if (h === "alert") return { fill: "rgba(239,68,68,0.4)", stroke: "#ef4444" };
      if (h === "watch") return { fill: "rgba(245,158,11,0.3)", stroke: "#f59e0b" };
      return { fill: "rgba(16,185,129,0.25)", stroke: "#10b981" };
  }
}

export function VineyardMap() {
  const [config, setConfig] = useState<VineyardConfig | null>(null);
  const [summaries, setSummaries] = useState<Record<string, BlockSummary>>({});
  const [colorMode, setColorMode] = useState<ColorMode>("health");
  const { selectedBlockId, setSelectedBlockId, investigateBlock } = useAppContext();

  useEffect(() => {
    fetch("/api/vineyard/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!config) return;
    const fetchSummaries = async () => {
      const results: Record<string, BlockSummary> = {};
      for (const block of config.blocks) {
        try {
          const resp = await fetch(`/api/vineyard/blocks/${block.id}/summary`);
          const data = await resp.json();
          if (data.soil?.moisture_pct != null) {
            results[block.id] = data;
          } else {
            results[block.id] = MOCK_SUMMARIES[block.id];
          }
        } catch {
          results[block.id] = MOCK_SUMMARIES[block.id];
        }
      }
      setSummaries(results);
    };
    fetchSummaries();
  }, [config]);

  const selectedBlock = config?.blocks.find((b) => b.id === selectedBlockId);
  const selectedSummary = selectedBlockId ? summaries[selectedBlockId] : null;

  if (!config) return <div className="p-6 text-slate-500">Loading vineyard...</div>;

  const center: LatLngExpression = [config.center.lat, config.center.lon];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">{config.name}</h2>
          <p className="text-sm text-slate-400 mt-1">
            {config.region} &middot; {config.blocks.length} blocks &middot; Click to inspect
          </p>
        </div>
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
          {([
            { id: "health" as const, label: "Health", icon: <Leaf size={14} /> },
            { id: "moisture" as const, label: "Moisture", icon: <Droplets size={14} /> },
            { id: "temperature" as const, label: "Temp", icon: <Thermometer size={14} /> },
            { id: "potassium" as const, label: "K Level", icon: <FlaskConical size={14} /> },
          ]).map((m) => (
            <button
              key={m.id}
              onClick={() => setColorMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                colorMode === m.id ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Leaflet Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-800">
          <MapContainer
            center={center}
            zoom={16}
            className="w-full h-full"
            style={{ background: "#0f172a" }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="/tiles/{z}/{x}/{y}.png"
            />
            {config.blocks.map((block) => {
              const summary = summaries[block.id];
              const colors = getBlockColor(summary, colorMode);
              const positions: LatLngExpression[] = block.polygon.map(
                (p) => [p.lat, p.lon] as LatLngExpression
              );
              const isSelected = selectedBlockId === block.id;

              return (
                <Polygon
                  key={block.id}
                  positions={positions}
                  pathOptions={{
                    fillColor: colors.fill,
                    fillOpacity: 0.6,
                    color: isSelected ? "#ffffff" : colors.stroke,
                    weight: isSelected ? 3 : 2,
                  }}
                  eventHandlers={{
                    click: () => setSelectedBlockId(block.id),
                  }}
                >
                  <MapTooltip
                    sticky
                    className="!bg-slate-900 !border-slate-700 !text-slate-100 !rounded-lg !px-3 !py-2 !text-xs"
                  >
                    <div>
                      <strong>{block.name}</strong> ({block.id})<br />
                      {block.variety} &middot; {block.acres} acres<br />
                      {summary && (
                        <>
                          Moisture: {summary.soil?.moisture_pct?.toFixed(1) ?? "—"}% &middot;
                          K: {summary.npk?.potassium ?? "—"} mg/kg
                        </>
                      )}
                    </div>
                  </MapTooltip>
                </Polygon>
              );
            })}
          </MapContainer>
        </div>

        {/* Detail Panel */}
        <AnimatePresence mode="wait">
          {selectedBlock && selectedSummary ? (
            <motion.div
              key={selectedBlockId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-80 shrink-0 bg-slate-900/70 border border-slate-800 rounded-xl p-5 overflow-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">{selectedBlock.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500 font-mono">{selectedBlock.id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      selectedSummary.health === "alert" ? "bg-red-500/20 text-red-400" :
                      selectedSummary.health === "watch" ? "bg-amber-500/20 text-amber-400" :
                      "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {selectedSummary.health.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedBlockId(null)} className="text-slate-500 hover:text-slate-300">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <div className="text-slate-500">Variety</div>
                  <div className="text-slate-200 font-medium">{selectedBlock.variety}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <div className="text-slate-500">Elevation</div>
                  <div className="text-slate-200 font-medium">{selectedBlock.elevation_m}m &middot; {selectedBlock.aspect}</div>
                </div>
              </div>

              {/* Alerts */}
              {selectedSummary.alerts.length > 0 && (
                <div className="space-y-2 mb-4">
                  {selectedSummary.alerts.map((alert, i) => (
                    <div key={i} className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg cursor-pointer hover:bg-red-500/15 transition-colors"
                      onClick={() => investigateBlock(selectedBlock.id, alert.message)}
                    >
                      <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
                        <AlertTriangle size={12} />
                        {alert.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Soil */}
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                  <Droplets size={12} /> Soil Sensors
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Moisture", value: selectedSummary.soil?.moisture_pct, unit: "%", color: "text-blue-400" },
                    { label: "Temp 6in", value: selectedSummary.soil?.temp_6in_c, unit: "°C", color: "text-orange-400" },
                    { label: "Temp 12in", value: selectedSummary.soil?.temp_12in_c, unit: "°C", color: "text-orange-300" },
                    { label: "EC", value: selectedSummary.soil?.ec, unit: "dS/m", color: "text-yellow-400" },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <div className={`text-lg font-mono font-bold ${m.color}`}>
                        {m.value != null ? m.value.toFixed(1) : "—"}
                      </div>
                      <div className="text-[10px] text-slate-500">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NPK */}
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                  <FlaskConical size={12} /> NPK Profile
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "N", value: selectedSummary.npk?.nitrogen, warn: 30 },
                    { label: "P", value: selectedSummary.npk?.phosphorus, warn: 15 },
                    { label: "K", value: selectedSummary.npk?.potassium, warn: 100 },
                    { label: "pH", value: selectedSummary.npk?.ph, warn: null },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <div className={`text-base font-mono font-bold ${
                        m.warn != null && m.value != null && m.value < m.warn ? "text-red-400" : "text-slate-200"
                      }`}>
                        {m.value != null ? (m.label === "pH" ? m.value.toFixed(1) : Math.round(m.value)) : "—"}
                      </div>
                      <div className="text-[10px] text-slate-500">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Harvest */}
              {selectedSummary.latest_harvest?.vintage_year && (
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-2">
                    Harvest {selectedSummary.latest_harvest.vintage_year}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <div className="text-sm font-mono font-bold text-emerald-400">{selectedSummary.latest_harvest.sugar_brix?.toFixed(1) ?? "—"}</div>
                      <div className="text-[10px] text-slate-500">Brix</div>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <div className="text-sm font-mono font-bold text-amber-400">{selectedSummary.latest_harvest.grape_mass_kg ? `${(selectedSummary.latest_harvest.grape_mass_kg / 1000).toFixed(1)}t` : "—"}</div>
                      <div className="text-[10px] text-slate-500">Yield</div>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <div className="text-sm font-mono font-bold text-purple-400">{selectedSummary.latest_harvest.quality_score ?? "—"}/10</div>
                      <div className="text-[10px] text-slate-500">Quality</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Story + Investigate button */}
              <div className="p-3 bg-slate-800/30 rounded-lg text-xs text-slate-400 italic mb-3">
                {selectedBlock.story}
              </div>

              <button
                onClick={() => investigateBlock(selectedBlock.id)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <MessageSquare size={14} />
                Investigate with AI
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-80 shrink-0 flex items-center justify-center text-sm text-slate-600"
            >
              <div className="text-center">
                <MapPin size={32} className="mx-auto mb-2 text-slate-700" />
                Click a block to inspect
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
