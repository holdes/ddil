/* Vineyard Intelligence: canned data + coach script.
   Sources: enablement/FACTS.md sections 2.x and 5.x; values copied from the staged fallbacks in
   Dashboard.tsx, VineyardMap.tsx MOCK_SUMMARIES, phase0/phase1 mocks, routers/vineyard.py.
   UI strings in quotes are verbatim from the real frontend (some contain the UI's own dashes). */
(function () {
  var M = window.MOCK;

  var estate = {
    name: "Domaine de la Côte Cachée",
    ava: "Walla Walla AVA",
    center: { lat: 46.015, lon: -118.38 },
    totalDocs: 869000,
    indexCounts: { "vineyard-soil": 841536, "vineyard-npk": 10032, "vineyard-imagery": 17151, "vineyard-harvest": 175, "vineyard-wine": 106 },
    avgMoisture: 32.4,
    avgTemp: 18.2,
  };

  // routers/vineyard.py block definitions (polygons verbatim)
  var blocks = [
    { id: "BLK-A", name: "Les Pierres", variety: "Cabernet Sauvignon", short: "Cab Sav", acres: 4.2, elev: 285, aspect: "S", soil: "Loess over basalt", story: "Star performer. South-facing, loess over basalt.",
      poly: [[46.014, -118.383], [46.014, -118.381], [46.0155, -118.381], [46.0155, -118.383]] },
    { id: "BLK-B", name: "Clos du Vent", variety: "Syrah", short: "Syrah", acres: 3.8, elev: 310, aspect: "SW", soil: "Shallow rocky", story: "Wind-exposed ridge, drought-vulnerable. Best Syrah came from the 2020 drought.",
      poly: [[46.016, -118.3835], [46.016, -118.3818], [46.0173, -118.3818], [46.0173, -118.3835]] },
    { id: "BLK-C", name: "La Rivière", variety: "Merlot", short: "Merlot", acres: 5.1, elev: 245, aspect: "E", soil: "Alluvial clay", story: "Declining since 2022. Drainage failure from 2022-06-15; potassium fell from 210 to 50 mg/kg.",
      poly: [[46.0125, -118.38], [46.0125, -118.3775], [46.0142, -118.3775], [46.0142, -118.38]] },
    { id: "BLK-D", name: "Le Jardin", variety: "Chardonnay", short: "Chard", acres: 3.5, elev: 260, aspect: "NE", soil: "Sandy loam", story: "Disease-prone in wet years. Powdery mildew in 2022.",
      poly: [[46.0145, -118.377], [46.0145, -118.3752], [46.0158, -118.3752], [46.0158, -118.377]] },
    { id: "BLK-E", name: "Vieilles Vignes", variety: "Cabernet Franc", short: "Cab Franc", acres: 2.8, elev: 295, aspect: "S", soil: "Volcanic, deep", story: "35-year-old vines. Consistent through every weather extreme.",
      poly: [[46.0158, -118.3805], [46.0158, -118.379], [46.0168, -118.379], [46.0168, -118.3805]] },
    { id: "BLK-F", name: "Le Plateau", variety: "Riesling", short: "Riesling", acres: 2.2, elev: 320, aspect: "N", soil: "Limestone-rich", story: "Highest and coolest block.",
      poly: [[46.0175, -118.3798], [46.0175, -118.3785], [46.0183, -118.3785], [46.0183, -118.3798]] },
  ];

  // VineyardMap.tsx MOCK_SUMMARIES (dashboard fallback uses the same moisture/temp + EC)
  var summaries = {
    "BLK-A": { health: "healthy", alerts: [], soil: { m: 34.1, t6: 19.5, t12: 18.0, ec: 0.41 }, npk: { n: 48, p: 29, k: 195, ph: 7.2 }, harvest: { year: 2024, kg: 4850, brix: 24.8, q: 8 } },
    "BLK-B": { health: "watch", alerts: ["Moisture below optimal — wind-exposed block"], soil: { m: 22.8, t6: 21.2, t12: 19.8, ec: 0.33 }, npk: { n: 32, p: 21, k: 158, ph: 7.0 }, harvest: { year: 2024, kg: 2100, brix: 26.5, q: 7 } },
    "BLK-C": { health: "alert", alerts: ["Potassium critically low (50 mg/kg)", "Persistent high moisture — drainage failure suspected"], soil: { m: 46.2, t6: 17.8, t12: 16.5, ec: 0.78 }, npk: { n: 52, p: 33, k: 50, ph: 6.8 }, harvest: { year: 2024, kg: 2800, brix: 22.1, q: 5 } },
    "BLK-D": { health: "watch", alerts: ["Conditions match 2022 powdery mildew pattern"], soil: { m: 31.5, t6: 16.4, t12: 15.2, ec: 0.37 }, npk: { n: 37, p: 24, k: 168, ph: 6.5 }, harvest: { year: 2024, kg: 3900, brix: 22.5, q: 6 } },
    "BLK-E": { health: "healthy", alerts: [], soil: { m: 35.8, t6: 18.9, t12: 17.5, ec: 0.46 }, npk: { n: 51, p: 31, k: 198, ph: 6.9 }, harvest: { year: 2024, kg: 2400, brix: 24.2, q: 8 } },
    "BLK-F": { health: "healthy", alerts: [], soil: { m: 24.1, t6: 15.2, t12: 14.0, ec: 0.30 }, npk: { n: 26, p: 17, k: 142, ph: 7.8 }, harvest: { year: 2024, kg: 2800, brix: 21.5, q: 7 } },
  };

  // Dashboard.tsx ALERTS (always staged)
  var alerts = [
    { severity: "critical", block: "BLK-C", title: "Potassium Depletion — La Rivière", message: "K levels dropped from 210 to 50 mg/kg since mid-2022. Possible drainage tile failure. Investigate immediately.", time: "2h ago" },
    { severity: "warning", block: "BLK-C", title: "Persistent High Moisture — La Rivière", message: "Soil moisture 15% above normal for 18 months despite dry periods. Correlates with K depletion.", time: "4h ago" },
    { severity: "warning", block: "BLK-D", title: "Disease Risk Elevated — Le Jardin", message: "Humidity + moisture conditions match 2022 powdery mildew outbreak pattern. Monitor closely.", time: "1d ago" },
    { severity: "info", block: "BLK-B", title: "Drought Watch — Clos du Vent", message: "Moisture trending below seasonal average. Wind-exposed block is first to show stress.", time: "1d ago" },
  ];

  var quickInvestigate = [
    "Why is Block C underperforming?",
    "Compare the 2020 and 2022 vintages",
    "Which blocks need attention this week?",
    "What caused the potassium cliff in La Rivière?",
    "Show me the best performing block and explain why",
  ];
  var chips = [
    "Why is La Rivière (BLK-C) underperforming since 2022?",
    "Why was the 2020 Clos du Vent Syrah our best wine despite the drought?",
    "Which blocks are at risk for disease this season?",
    "What's happening with potassium levels in Block C?",
    "Compare Block E (Vieilles Vignes) consistency across all vintages",
    "What should I prioritize this week across the estate?",
  ];

  // Phase 1 kNN mock hits (phase1_historical.py _mock_historical), used under the ES-down drill.
  var mockHistorical = [
    { title: "2020-07-15 · BLK-B Clos du Vent · Syrah · moisture 22.5% · EC 0.38", similarity: 0.94 },
    { title: "2022-05-20 · BLK-C La Rivière · Merlot · moisture 48.2% · EC 0.72", similarity: 0.87 },
  ];

  // Canned LLM outputs per story. Wording is illustrative; on the kit Nemotron 3.5 Lightning writes these live.
  var R = {};
  R.c = {
    matches: [
      { title: "2022-05-20 · BLK-C La Rivière · Merlot · moisture 48.2% · EC 0.72", similarity: 0.87 },
      { title: "2022-09-02 · BLK-C La Rivière · Merlot · moisture 47.0% · EC 0.75", similarity: 0.86 },
      { title: "2023-04-11 · BLK-C La Rivière · Merlot · moisture 45.9% · EC 0.77", similarity: 0.84 },
      { title: "2019-06-03 · BLK-C La Rivière · Merlot · moisture 36.1% · EC 0.44", similarity: 0.71 },
      { title: "2020-07-15 · BLK-B Clos du Vent · Syrah · moisture 22.5% · EC 0.38", similarity: 0.62 },
    ],
    pattern: "Current readings match Block C after June 2022: saturated clay, rising EC, falling potassium. Pre-2022 readings for the same block sat near 36% moisture with EC under 0.5.",
    overall: "high",
    risks: [
      { severity: "critical", category: "nutrient", description: "Potassium at 50 mg/kg, down from 210. Merlot ripening and colour suffer below 100." },
      { severity: "high", category: "drainage", description: "Moisture 15% above normal for 18 months. Pattern fits a failed drainage tile from mid-2022." },
      { severity: "medium", category: "disease", description: "Waterlogged clay raises root rot and botrytis pressure in a wet spring." },
    ],
    recs: [
      { priority: "urgent", action: "Inspect and repair the drainage tile along the east edge of La Rivière.", rationale: "Saturation began 2022-06-15 and has not recovered in dry periods." },
      { priority: "high", action: "Apply potassium sulfate once drainage is restored; retest NPK in 30 days.", rationale: "Leaching continues while the soil stays waterlogged." },
      { priority: "medium", action: "Thin Merlot crop load this season to protect quality.", rationale: "2024 quality score 5 with brix 22.1, lowest on the estate." },
    ],
    actions: [
      { task: "Excavate and camera-inspect drainage line, east row ends", assignee: "Vineyard crew", deadline: "This week", equipment: "Mini excavator, drain camera" },
      { task: "Order and apply potassium sulfate after drain repair", assignee: "Vineyard manager", deadline: "Within 3 weeks", equipment: "Spreader" },
      { task: "Pull soil cores at 6 and 12 inches for lab NPK", assignee: "Agronomist", deadline: "Day 30", equipment: "Soil probe" },
      { task: "Crop thinning pass on La Rivière Merlot", assignee: "Vineyard crew", deadline: "Before veraison", equipment: "" },
    ],
    cost: "$8,000 to $12,000",
    summary: "Block C has a drainage failure that started in mid-2022. Waterlogged clay is leaching potassium (210 to 50 mg/kg). Repair the drain first, then rebuild potassium and thin the crop to protect the 2026 Merlot.",
  };
  R.vintage = {
    matches: [
      { title: "2020-07-15 · BLK-B Clos du Vent · Syrah · moisture 22.5% · EC 0.38", similarity: 0.94 },
      { title: "2020-08-03 · BLK-B Clos du Vent · Syrah · moisture 21.8% · EC 0.36", similarity: 0.92 },
      { title: "2022-05-20 · BLK-C La Rivière · Merlot · moisture 48.2% · EC 0.72", similarity: 0.66 },
    ],
    pattern: "2020 was a summer drought with 60% less rain and an April frost. 2022 was a wet spring with disease in Blocks C and D. Clos du Vent shows the lowest moisture in 2020 and the highest quality Syrah.",
    overall: "medium",
    risks: [
      { severity: "medium", category: "climate", description: "Vintage quality swings with water stress: 2020 quality base 8, 2022 quality base 6." },
      { severity: "medium", category: "disease", description: "Wet years drive mildew in Le Jardin and rot in La Rivière." },
    ],
    recs: [
      { priority: "high", action: "Use controlled deficit irrigation on Clos du Vent to reproduce the 2020 concentration effect.", rationale: "Small, concentrated berries gave the best Syrah in a drought year." },
      { priority: "medium", action: "Pre-position fungicide and canopy work for wet springs.", rationale: "2022 losses came from disease, not yield." },
    ],
    actions: [
      { task: "Set deficit irrigation thresholds for BLK-B from 2020 moisture readings", assignee: "Vineyard manager", deadline: "Before bloom", equipment: "Irrigation controller" },
      { task: "Build a wet-spring spray plan for BLK-C and BLK-D", assignee: "Agronomist", deadline: "March", equipment: "" },
    ],
    cost: "$2,000 to $4,000",
    summary: "2020 beat 2022 because drought stress concentrated the fruit, most of all on Clos du Vent. 2022 lost quality to a wet spring and disease. Reproduce 2020 with deficit irrigation; defend against 2022 with an early spray plan.",
  };
  R.disease = {
    matches: [
      { title: "2022-05-28 · BLK-D Le Jardin · Chardonnay · moisture 38.4% · EC 0.40", similarity: 0.91 },
      { title: "2022-06-10 · BLK-D Le Jardin · Chardonnay · moisture 37.2% · EC 0.39", similarity: 0.89 },
      { title: "2022-05-20 · BLK-C La Rivière · Merlot · moisture 48.2% · EC 0.72", similarity: 0.80 },
    ],
    pattern: "Current humidity and moisture in Le Jardin track the May to June 2022 window that preceded powdery mildew. La Rivière is wet for a different reason: drainage.",
    overall: "high",
    risks: [
      { severity: "high", category: "disease", description: "Le Jardin Chardonnay: conditions match the 2022 powdery mildew outbreak." },
      { severity: "medium", category: "disease", description: "La Rivière: waterlogged clay raises botrytis and root rot risk." },
      { severity: "low", category: "disease", description: "Le Plateau and Les Pierres: cool or well-drained, low pressure." },
    ],
    recs: [
      { priority: "high", action: "Start a preventive sulfur program on Le Jardin now.", rationale: "Mildew is cheaper to prevent than to cure." },
      { priority: "medium", action: "Open the canopy on BLK-C and BLK-D to improve airflow.", rationale: "Both blocks hold moisture." },
    ],
    actions: [
      { task: "Sulfur application, BLK-D", assignee: "Spray crew", deadline: "Within 5 days", equipment: "Airblast sprayer" },
      { task: "Leaf pulling on east sides, BLK-C and BLK-D", assignee: "Vineyard crew", deadline: "Next 2 weeks", equipment: "" },
      { task: "Scout leaves twice weekly and log imagery", assignee: "Agronomist", deadline: "Ongoing", equipment: "Camera" },
    ],
    cost: "$3,000 to $5,000",
    summary: "Le Jardin is the highest disease risk this season; its conditions match the 2022 mildew outbreak. La Rivière is next because of drainage. Start sulfur on Block D this week and open canopies on C and D.",
  };
  R.consistency = {
    matches: [
      { title: "2020-07-15 · BLK-E Vieilles Vignes · Cab Franc · moisture 33.0% · EC 0.45", similarity: 0.90 },
      { title: "2022-05-20 · BLK-E Vieilles Vignes · Cab Franc · moisture 37.1% · EC 0.47", similarity: 0.89 },
      { title: "2018-08-12 · BLK-E Vieilles Vignes · Cab Franc · moisture 35.4% · EC 0.46", similarity: 0.88 },
    ],
    pattern: "Vieilles Vignes moisture stays in a narrow band across drought (2020) and wet (2022) years. Deep volcanic soil and 35-year-old roots buffer both extremes.",
    overall: "low",
    risks: [
      { severity: "low", category: "climate", description: "Lowest variance on the estate across 2018 to 2025." },
      { severity: "low", category: "vine age", description: "Old vines yield less per acre (2,400 kg in 2024)." },
    ],
    recs: [
      { priority: "medium", action: "Keep current management; do not change irrigation.", rationale: "The block self-regulates." },
      { priority: "low", action: "Propagate cuttings from Vieilles Vignes for replanting other blocks.", rationale: "Captures proven resilient genetics." },
    ],
    actions: [
      { task: "Tag top 20 vines for cutting propagation", assignee: "Vineyard manager", deadline: "Dormant season", equipment: "Tags" },
    ],
    cost: "Under $1,000",
    summary: "Vieilles Vignes is the steadiest block on the estate. Deep volcanic soil and old roots flatten every weather extreme. Leave it alone and use it as the genetic source for replanting.",
  };
  R.best = {
    matches: [
      { title: "2024-07-20 · BLK-A Les Pierres · Cab Sav · moisture 34.6% · EC 0.40", similarity: 0.93 },
      { title: "2021-07-18 · BLK-A Les Pierres · Cab Sav · moisture 33.8% · EC 0.41", similarity: 0.91 },
    ],
    pattern: "Les Pierres holds moisture near 34% with low EC and healthy potassium (195 mg/kg). South aspect and loess over basalt drain well and ripen fully.",
    overall: "low",
    risks: [{ severity: "low", category: "general", description: "No active risk. Highest 2024 yield on the estate (4,850 kg, brix 24.8, quality 8)." }],
    recs: [
      { priority: "medium", action: "Hold irrigation and nutrition steady.", rationale: "Current readings sit in the optimal band." },
      { priority: "low", action: "Use Les Pierres readings as the estate baseline for alerts.", rationale: "It is the reference healthy block." },
    ],
    actions: [{ task: "Record Les Pierres as baseline profile in the alert rules", assignee: "Vineyard manager", deadline: "This month", equipment: "" }],
    cost: "None",
    summary: "Les Pierres is the best performing block: optimal moisture, healthy potassium, full ripeness and the top 2024 yield. South aspect and well-drained loess over basalt explain it.",
  };
  R.drought = {
    matches: [
      { title: "2020-07-15 · BLK-B Clos du Vent · Syrah · moisture 22.5% · EC 0.38", similarity: 0.94 },
      { title: "2021-08-09 · BLK-B Clos du Vent · Syrah · moisture 23.4% · EC 0.35", similarity: 0.88 },
    ],
    pattern: "Clos du Vent at 22.8% moisture matches the 2020 drought profile. The wind-exposed ridge dries first.",
    overall: "medium",
    risks: [
      { severity: "medium", category: "water", description: "Moisture below 25%: drought stress threshold." },
      { severity: "low", category: "quality", description: "Mild stress helped 2020 Syrah; severe stress cuts yield." },
    ],
    recs: [{ priority: "high", action: "Deficit irrigation to hold moisture near 25%.", rationale: "Keeps the 2020 concentration benefit without yield loss." }],
    actions: [{ task: "Adjust BLK-B irrigation schedule", assignee: "Vineyard manager", deadline: "This week", equipment: "Irrigation controller" }],
    cost: "Under $1,000",
    summary: "Clos du Vent is in drought watch. Hold it near 25% moisture with deficit irrigation to repeat the 2020 result.",
  };
  R.plateau = {
    matches: [{ title: "2023-07-02 · BLK-F Le Plateau · Riesling · moisture 24.6% · EC 0.31", similarity: 0.90 }],
    pattern: "Le Plateau is the coolest and highest block. Low moisture and lower potassium (142 mg/kg) are typical for limestone.",
    overall: "low",
    risks: [{ severity: "medium", category: "water", description: "Moisture 24.1%, just under the 25% threshold." }],
    recs: [{ priority: "medium", action: "Light irrigation pass; monitor potassium quarterly.", rationale: "Limestone soils hold less K." }],
    actions: [{ task: "Single irrigation set on BLK-F", assignee: "Vineyard crew", deadline: "This week", equipment: "" }],
    cost: "Under $500",
    summary: "Le Plateau is healthy but dry. One irrigation set and quarterly potassium checks.",
  };
  R.priorities = {
    matches: R.c.matches.slice(0, 2).concat(R.disease.matches.slice(0, 1)),
    pattern: "Three blocks need action: La Rivière (drainage and potassium), Le Jardin (mildew pattern) and Clos du Vent (drought watch).",
    overall: "high",
    risks: [
      { severity: "critical", category: "nutrient", description: "BLK-C potassium at 50 mg/kg; drainage failure." },
      { severity: "high", category: "disease", description: "BLK-D matches the 2022 mildew pattern." },
      { severity: "medium", category: "water", description: "BLK-B moisture 22.8%." },
    ],
    recs: [
      { priority: "urgent", action: "Repair La Rivière drainage.", rationale: "Root cause of the potassium loss." },
      { priority: "high", action: "Preventive sulfur on Le Jardin.", rationale: "Get ahead of mildew." },
      { priority: "medium", action: "Deficit irrigation on Clos du Vent.", rationale: "Hold near 25%." },
    ],
    actions: [
      { task: "Drain inspection, BLK-C", assignee: "Vineyard crew", deadline: "Monday", equipment: "Mini excavator" },
      { task: "Sulfur application, BLK-D", assignee: "Spray crew", deadline: "Wednesday", equipment: "Airblast sprayer" },
      { task: "Irrigation schedule change, BLK-B", assignee: "Vineyard manager", deadline: "Friday", equipment: "" },
    ],
    cost: "$10,000 to $15,000",
    summary: "This week: fix the drain in La Rivière, start sulfur in Le Jardin, adjust irrigation on Clos du Vent. Les Pierres, Vieilles Vignes and Le Plateau need no action.",
  };

  function pickResponse(query, blockId) {
    var q = (query || "").toLowerCase();
    if (/potassium|block c\b|la rivi|blk-c|cliff/.test(q)) return "c";
    if (/2020|2022|vintage|syrah|drought/.test(q)) return "vintage";
    if (/disease|mildew/.test(q)) return "disease";
    if (/block e|vieilles|consisten/.test(q)) return "consistency";
    if (/best perform/.test(q)) return "best";
    if (/prioriti|attention|this week/.test(q)) return "priorities";
    var byBlock = { "BLK-A": "best", "BLK-B": "drought", "BLK-C": "c", "BLK-D": "disease", "BLK-E": "consistency", "BLK-F": "plateau" };
    if (blockId && byBlock[blockId]) return byBlock[blockId];
    return "priorities";
  }

  // Typed questions and chips send no block_id, so Phase 0 reads the latest doc across all blocks (FACTS F8).
  // The kit picks whichever block wrote last. The mock fixes it to BLK-F so you can see the effect.
  var latestBlock = "BLK-F";

  // SearchPlayground backend fallback (routers/search.py) shown on the kit today for Hybrid and Semantic.
  var searchFallback = [
    { id: "mock-1", title: "Block B3 — Soil Station #17", snippet: "Moisture: 31% (down 12% from 30-day avg), EC rising.", score: 0.943, source: "historical", index: "vineyard-soil" },
    { id: "mock-2", title: "Block B7 — Soil Station #31", snippet: "Moisture: 28%, Temperature anomaly at 24\" depth.", score: 0.891, source: "historical", index: "vineyard-soil" },
  ];
  // LeafScanner canned result (routers/images.py)
  var leaf = { classification: "Black Rot", confidence: 0.942, similarCount: 847, affectedBlocks: ["B3", "B7", "C2"],
    recommendation: "Apply mancozeb fungicide within 48 hours. Remove infected leaves and fruit mummies. Increase canopy airflow by shoot positioning.",
    similar: [0.96, 0.94, 0.91, 0.89, 0.87] };

  // Kit-pace timings for the agent stream, in seconds from submit. FACTS has no measured value:
  // four sequential Nemotron 3.5 Lightning calls, 120 s cap each (F7). The mock budgets ~80 s.
  var pipelineTiming = { sensors: 1.2, historical: 18, risk: 24, recommendation: 21, action_plan: 18, llmTimeout: 120 };

  var steps = [
    { id: "arch", title: "Architecture", screen: "arch", target: 60,
      coach: {
        status: "STAGED",
        say: [
          "This is the whole kit: two computers, a gateway and a switch in one Pelican case.",
          "The DGX Spark (192.168.1.20) runs the GPU Elasticsearch node, NVIDIA Nemotron 3.5 Lightning in Ollama and Jina Embeddings v5 Omni. The Framework Desktop (192.168.1.10) runs the CPU node, Kibana and this app.",
          "Every query, embedding and answer today runs inside this case. Click Continue.",
        ],
        proof: "Point at the two boxes in the case. The IPs on screen are the IPs on the hardware.",
        honest: "This screen is a static diagram. Correct two labels if asked: the AI Agronomist is a Python pipeline that calls Ollama, not Agent Builder; the Jina server and the ES inference endpoint on the DGX card serve the Multimodal adventure, not this one. The 12x stat is a UI claim. Pre-show: all nodes and Kibana on 9.5.6 with security settings matched, and the kit config pointing at Nemotron 3.5 Lightning and Jina v5 Omni.",
        questions: [
          { q: "Is this one cluster or two?", a: "One cluster, ddil-vineyard, with one node on each machine. The GPU node carries node.attr.accel=gpu so indices can be pinned to it." },
          { q: "Which Elasticsearch version?", a: "Elasticsearch and Kibana 9.5.6 on both machines. The GPU node adds the aarch64 cuVS library." },
          { q: "Does the model need the cloud?", a: "No. NVIDIA Nemotron 3.5 Lightning runs in Ollama on the DGX Spark. Embeddings come from Jina Embeddings v5 Omni on the same box. Jina is part of Elastic." },
          { q: "What does it weigh?", a: "The screen says under 50 lbs. Weigh your own kit before you quote it." },
        ],
        fails: "This screen needs no backend. If the page will not load, the frontend container on the Framework (port 3000) is down: run docker compose up -d in ~/demo on the Framework, or present this view from the deck.",
      } },
    { id: "intro", title: "Race Intro", screen: "intro", target: 45,
      coach: {
        status: "STAGED",
        say: [
          "Before the owner can ask anything, the data has to be indexed: 841,536 soil readings, 17K disease images, 10K nutrient profiles, 281 harvest and wine records.",
          "Building the vector index is the expensive part. The DGX Spark builds it on the GPU with NVIDIA cuVS.",
          "Click Start the Race.",
        ],
        proof: "Same data and the same Elasticsearch on both sides. One setting differs: vectors.indexing.use_gpu=true on the GPU node.",
        honest: "Every number here is hardcoded. The race that follows is a staged visualization that ends about 3.7x faster end to end, not 12x. The CPU rate here (~2,400 v/s) does not match the race (4,200 v/s). Imagery vectors are 768-d in the mapping, not 2048. Say: \"The next screen visualizes what cuVS does to build time.\"",
        questions: [
          { q: "Is 12x real?", a: "12x is a UI claim. The staged race shows about 3.7x end to end and 7.1x on force merge. Measured results depend on dataset and dimensions; offer the benchmark write-up rather than a number from this screen." },
          { q: "Why are soil vectors only 8 dimensions?", a: "Each reading is encoded as an 8-dim feature vector (moisture, temperature, EC, depth, time) for similarity across history. GPU build pays off most on high-dimension vectors, 768 and up." },
        ],
        fails: "Frontend only. Same recovery as the Architecture screen.",
      } },
    { id: "race", title: "Indexing Race", screen: "race", target: 75,
      coach: {
        status: "STAGED",
        say: [
          "Both sides index the same 841,536 vectors. Left is CPU HNSW, right is GPU HNSW with cuVS.",
          "At about 15 seconds the GPU side finishes and the explainer appears while the CPU keeps going.",
          "Name what is accelerated: HNSW graph construction during indexing and segment merges. Search stays on the CPU.",
          "The CPU finishes at about 55 seconds. Click Continue to Demo.",
        ],
        proof: "The GPU card completes while the CPU bar sits near 27%.",
        honest: "No indexing happens. The backend replays a simulation: GPU 15 s, CPU 55 s, throughput shown as target x ramp x noise, recall hardcoded at 98.9 / 98.7. Say: \"This is a staged visualization of the build-time gap cuVS gives.\" Never call it real-time. Do not read out Total Vectors Indexed (1,683,072); it counts both sides. The CPU card label \"Port 9201\" and its \"GPU Util 0%\" are UI artifacts.",
        questions: [
          { q: "Is this live?", a: "No. It is a staged visualization with fixed timings. A force-merge timing script exists in the repo but is not wired to this screen." },
          { q: "Why does throughput not match the progress bar?", a: "They come from separate formulas in the simulator. The final figure is total vectors over elapsed time: about 56,100 v/s GPU and 15,300 v/s CPU." },
          { q: "Is recall identical?", a: "The 98.9 and 98.7 figures are placeholders. cuVS builds a CAGRA graph and converts it to HNSW, so search runs on the same structure. Measure recall on your own data." },
          { q: "Does the GPU make search faster?", a: "This feature accelerates index build and merge. Queries run on the CPU HNSW graph." },
        ],
        fails: "Both bars stay at zero: the backend or the race WebSocket is down. Click Skip and tell the build-time story from the intro screen. Reset on this screen calls /api/race/reset; Start Race restarts it.",
      } },
    { id: "dashboard", title: "Dashboard", screen: "dashboard", target: 60,
      coach: {
        status: "MIXED",
        say: [
          "Domaine de la Côte Cachée: a fictional estate in the Walla Walla AVA, six blocks, about 22 acres.",
          "The data is synthetic from one causal model: weather drives soil, soil drives nutrients, nutrients drive harvest and wine. Eight years, 2018 to 2025.",
          "La Rivière, Block C, is red: potassium fell from 210 to 50 mg/kg since mid-2022.",
          "Everything here is clickable. Click the BLK-C card to investigate, or go to Vineyard first.",
        ],
        proof: "The critical alert and the BLK-C card agree: moisture 46.2%, EC 0.78.",
        honest: "KPIs and block cards are MEASURED when Elasticsearch answers. When it does not, the screen silently shows staged numbers that look the same. The four alerts are always hardcoded. Say: \"The alerts are configured for this story; the agent pulls the sensor data itself.\"",
        questions: [
          { q: "Is this real data?", a: "It is synthetic from a seeded generator with stories baked in: the 2020 drought, the 2022 wet spring, the Block C drainage failure from 15 June 2022. It behaves like sensor data so the agent can find the stories." },
          { q: "How many records?", a: "About 869,000 documents in five indices. Soil readings are 841,536 of them." },
          { q: "Why do the acres say 22?", a: "The six blocks sum to 21.6 acres. The chooser rounds to 22." },
        ],
        fails: "If the KPIs read exactly 869,000 total, 32.4% moisture and 18.2°C, you are on the staged fallback (F1: the backend container has no ES credentials). Keep going; the story holds. Fix after the session.",
      } },
    { id: "map", title: "Vineyard Map", screen: "map", target: 60,
      coach: {
        status: "MIXED",
        say: [
          "The estate on an offline map. The tiles are stored on the kit.",
          "Switch the colour mode to K Level: Block C turns red, everything else stays green or amber.",
          "Click La Rivière. The panel shows soil, NPK, the latest harvest and the block story. Click Investigate with AI.",
        ],
        proof: "In K Level mode, Block C at 50 mg/kg is the only block under 100.",
        honest: "Per-block numbers are MEASURED when ES answers and fall back per block to staged values when it does not. The mock shows the staged values. The real map is Leaflet with CartoDB Dark Matter tiles; the mock draws the same polygons without tiles.",
        questions: [
          { q: "Where do the tiles come from offline?", a: "Pre-downloaded CartoDB Dark Matter tiles, zoom 14 to 17, served by the backend from the kit disk." },
          { q: "Can this use real field sensors?", a: "Yes. Each reading is a document with a block id, timestamp and values. Point real sensor ingest at the same indices and the screens work unchanged." },
        ],
        fails: "Blank map without tiles: the backend /tiles route is down or data/tiles is missing. Polygons still draw. Use the Dashboard block cards instead.",
      } },
    { id: "chat", title: "AI Agronomist", screen: "chat", target: 150,
      coach: {
        status: "LIVE",
        say: [
          "One click runs a five-phase pipeline. Phase 0 reads the latest soil and NPK documents for the block straight from Elasticsearch.",
          "Phase 1 runs a kNN search over the soil vectors for similar conditions in past years; the model interprets the matches.",
          "Phases 2 to 4 ask Nemotron 3.5 Lightning on the DGX Spark for risk, a variety-specific recommendation and an action plan.",
          "Fill the wait. Each phase is a full model call on local hardware. Open each card as it completes.",
        ],
        proof: "Phase 0 numbers match the BLK-C card on the Dashboard: same index, same moment, no cloud call.",
        honest: "Elasticsearch queries and model calls are live. Three on-screen claims are wrong: the chooser and Architecture say Elastic Agent Builder, but this is Python calling Ollama; the progress line says phases 2 to 4 run in parallel, but they run one after another; the system prompt carries the estate background, so the model knows the stories before it searches. Say: \"A Python orchestrator calls Elasticsearch and Nemotron 3.5 Lightning on the Spark in five steps.\" Timing on the kit: four sequential model calls, each capped at 120 s. Budget 1.5 to 3 minutes per question; the worst case is about 8 minutes. FACTS has no measured timing. Kit pace in the mock runs about 80 s.",
        questions: [
          { q: "Is this Agent Builder?", a: "No. This pipeline is Python plus Ollama. The SEC adventure shows Agent Builder with ES|QL tools." },
          { q: "Why is it slow?", a: "Four sequential model calls on one GB10, fully disconnected, each a full generation with no network." },
          { q: "Can it hallucinate?", a: "The model sees the sensor snapshot, the kNN matches and the estate background. Open the phase cards to show the retrieved numbers the answer used." },
          { q: "Why did it analyse a different block?", a: "Typed questions and chips send no block id, so Phase 0 reads whichever block reported last. Start from a block card, the map or an alert when the block matters." },
        ],
        fails: "Phase 1 spinning past 2 minutes means the model is cold or stuck (F6). The stream ends without completing and the screen stays \"running\". Recovery: click Search in the sidebar, come back to AI Agronomist (the screen resets) and open a cached run under Recent Investigations. Warm the model before the audience arrives by running one question after your last Reset Demo.",
      } },
    { id: "search", title: "Search", screen: "search", target: 45,
      coach: {
        status: "STAGED",
        say: [
          "Same data, three retrieval modes: BM25 keyword, semantic, and hybrid with RRF.",
          "If you show it, keep it short and move on.",
        ],
        proof: "None on the current kit build. Show hybrid retrieval in the SEC or Multimodal adventure instead.",
        honest: "Hybrid and Semantic always fail on the current build (768-d query against an 8-d field) and return two canned results titled Block B3 and Block B7 (soil stations #17 and #31). Those blocks do not exist on the estate. The 12 ms embed latency is hardcoded. Recommended: skip this screen.",
        questions: [
          { q: "What is RRF?", a: "Reciprocal Rank Fusion merges ranked lists from keyword and vector search by rank position, so scores need no normalising. Elasticsearch runs it as a retriever." },
        ],
        fails: "This screen returns canned results by design today (C9). Skip it.",
      } },
    { id: "scanner", title: "Crop Health", screen: "scanner", target: 30,
      coach: {
        status: "STAGED",
        say: ["Upload a leaf photo to find similar disease images by vector similarity."],
        proof: "None. Show image similarity live in the Multimodal adventure.",
        honest: "Fully canned. Any image returns Black Rot at 94.2% with 847 similar and blocks B3, B7, C2, which are not estate block ids. Recommended: skip. If shown, say: \"This screen illustrates image similarity.\"",
        questions: [{ q: "Which model embeds the images?", a: "The subtitle says CLIP, but this screen does not embed anything today. The Multimodal adventure embeds images with Jina on the DGX Spark." }],
        fails: "Nothing to fail; it is canned. Skip it.",
      } },
    { id: "overview", title: "System and reset", screen: "overview", target: 30,
      coach: {
        status: "STAGED",
        say: [
          "Recap: the data never left the case. Elasticsearch stored and searched it on two small nodes; Nemotron 3.5 Lightning reasoned over it on the Spark.",
          "Click Reset Demo in the sidebar to return to the chooser for the next group.",
        ],
        proof: "Reset Demo returns to the chooser and clears Recent Investigations.",
        honest: "Do not present the System screen. It is stale: 615K+ vectors, GPU ~22s / CPU ~150s, and a CPU Elasticsearch node on the Spark at :9201. None of that matches the kit.",
        questions: [{ q: "Can we run this on our own hardware?", a: "Yes. It is stock Elasticsearch plus the cuVS library on the GPU node, Ollama for the model, and a small FastAPI and React app. Size the GPU node for the model you choose." }],
        fails: "Reset Demo does not reset the race on the server. The next Start Race reinitialises it.",
      } },
  ];

  var drills = {
    llm: { label: "LLM timeout", see: "AI Agronomist: Phase 1 never completes. After 120 s the stream ends without job_complete and the screen stays \"running\" with the spinner.", fix: "Navigate away (Search) and back to reset the screen, then open a cached run from Recent Investigations. Narrate the five phases from the cached cards. After the session: check ollama ps on the Spark and warm the model." },
    search: { label: "Search fallback", see: "Dashboard, Map and Phase 0 show staged numbers with no error. Search returns the canned Block B3 and Block B7 soil-station results. The tell: totals of exactly 869,000 and 32.4% / 18.2°C.", fix: "Keep presenting; the story still holds on staged numbers. Do not claim the numbers are live. After the session: give the backend ES credentials (F1)." },
    es: { label: "ES down", see: "Dashboard and Map look normal (silent fallback). The agent still runs, but Phase 0 shows BLK-C mock values (46.2%, K 50) for any block, and Phase 1 shows the two mock matches (2020 BLK-B, 2022 BLK-C).", fix: "Investigate Block C so the mock values fit the story. Avoid other blocks. After the session: check docker ps on both nodes and GET _cluster/health." },
  };

  M.data.vineyard = {
    id: "vineyard", title: "Vineyard Intelligence", accent: "teal",
    estate: estate, blocks: blocks, summaries: summaries, alerts: alerts, quickInvestigate: quickInvestigate, chips: chips,
    responses: R, pickResponse: pickResponse, latestBlock: latestBlock, mockHistorical: mockHistorical,
    searchFallback: searchFallback, leaf: leaf, pipelineTiming: pipelineTiming, steps: steps, drills: drills,
  };
})();
