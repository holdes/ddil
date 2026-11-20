/* SEC Findings: canned data + coach script. Sources: FACTS.md section 3 and 5.
   Search hits and agent answers are MOCK content. They never quote real filings; on the kit
   the hits are live chunks of sec_10k_2026 and the agent writes its own cited answer. */
(function () {
  var M = window.MOCK;

  var chapters = [
    { number: "00", short: "Setup" }, { number: "01", short: "Speed" }, { number: "02", short: "Side-by-Side" },
    { number: "—", short: "Elastic" }, { number: "03", short: "Interface" }, { number: "04", short: "Agentic" },
    { number: "—", short: "Workflows" }, { number: "05", short: "The Stack" },
  ];

  var hardware = {
    cpu: { label: "Framework Desktop", detail: "Ryzen AI Max+ 395 · 64 GB · x86_64", ip: "192.168.1.10:9200", node: "framework-cpu", accel: "cpu", heap: "8g", note: "No GPU in the race: CPU HNSW graph build" },
    gpu: { label: "NVIDIA DGX Spark", detail: "GB10 · 128 GB unified · aarch64", ip: "192.168.1.20:9200", node: "spark-gpu", accel: "gpu", heap: "16g", note: "GB10 Blackwell GPU · cuVS CAGRA → HNSW conversion" },
  };
  var annualNode = { cpu: 135617, gpu: 148417 };
  var tcoDefaults = { totalVectors: 1e10, dims: 1024, slaHours: 12, cpuVps: 17919, gpuVps: 185600 };

  function computeTco(cpuVps, gpuVps) {
    var cpuNodes = tcoDefaults.totalVectors / cpuVps / 3600 / tcoDefaults.slaHours;
    var gpuNodes = tcoDefaults.totalVectors / gpuVps / 3600 / tcoDefaults.slaHours;
    var cpuUsd = cpuNodes * annualNode.cpu, gpuUsd = gpuNodes * annualNode.gpu;
    return { cpuNodes: cpuNodes, gpuNodes: gpuNodes, cpuUsd: cpuUsd, gpuUsd: gpuUsd, savingsUsd: cpuUsd - gpuUsd, savingsPct: (cpuUsd - gpuUsd) / cpuUsd * 100 };
  }

  var exampleSearches = [
    "AI model risk and governance disclosures",
    "Commercial real estate exposure",
    "Supply chain disruption risk in semiconductors",
    "Climate-related transition risk",
    "Cybersecurity incident response",
  ];
  var exampleAgent = [
    "Compare AI risk disclosures across AAPL, MSFT, GOOGL and META — what do they agree on, where do they differ?",
    "Which financial-sector filings flag commercial real estate exposure as a material risk?",
    "What climate-transition risks does the Energy sector disclose in its 10-Ks?",
    "Across the S&P 500, which sector has the most filings citing supply-chain disruption?",
    "Show me three healthcare 10-Ks that talk about generative AI in clinical workflows.",
  ];

  // Sector facet. On the kit this is a live terms agg; these counts are illustrative and sum to 503.
  var sectors = [
    ["Industrials", 78], ["Financials", 72], ["Information Technology", 69], ["Health Care", 62], ["Consumer Discretionary", 50],
    ["Consumer Staples", 38], ["Utilities", 31], ["Real Estate", 31], ["Materials", 28], ["Energy", 22], ["Communication Services", 22],
  ];

  // Mock hit lists per example search: [ticker, company, sector]
  var hitSets = {
    0: [["MSFT", "Microsoft", "Information Technology"], ["GOOGL", "Alphabet", "Communication Services"], ["META", "Meta Platforms", "Communication Services"], ["NVDA", "NVIDIA", "Information Technology"], ["IBM", "IBM", "Information Technology"], ["CRM", "Salesforce", "Information Technology"], ["ADBE", "Adobe", "Information Technology"], ["JPM", "JPMorgan Chase", "Financials"]],
    1: [["WFC", "Wells Fargo", "Financials"], ["BAC", "Bank of America", "Financials"], ["USB", "U.S. Bancorp", "Financials"], ["PNC", "PNC Financial", "Financials"], ["TFC", "Truist", "Financials"], ["C", "Citigroup", "Financials"], ["BXP", "BXP", "Real Estate"], ["VNO", "Vornado", "Real Estate"]],
    2: [["NVDA", "NVIDIA", "Information Technology"], ["AMD", "AMD", "Information Technology"], ["INTC", "Intel", "Information Technology"], ["QCOM", "Qualcomm", "Information Technology"], ["AVGO", "Broadcom", "Information Technology"], ["TXN", "Texas Instruments", "Information Technology"], ["MU", "Micron", "Information Technology"], ["AAPL", "Apple", "Information Technology"]],
    3: [["XOM", "Exxon Mobil", "Energy"], ["CVX", "Chevron", "Energy"], ["DUK", "Duke Energy", "Utilities"], ["NEE", "NextEra Energy", "Utilities"], ["COP", "ConocoPhillips", "Energy"], ["SO", "Southern Co", "Utilities"], ["DOW", "Dow", "Materials"], ["F", "Ford", "Consumer Discretionary"]],
    4: [["CRWD", "CrowdStrike", "Information Technology"], ["PANW", "Palo Alto Networks", "Information Technology"], ["JPM", "JPMorgan Chase", "Financials"], ["UNH", "UnitedHealth", "Health Care"], ["MSFT", "Microsoft", "Information Technology"], ["CSCO", "Cisco", "Information Technology"], ["MA", "Mastercard", "Financials"], ["V", "Visa", "Financials"]],
  };
  var hitScores = [0.912, 0.897, 0.884, 0.871, 0.866, 0.852, 0.847, 0.839];

  // Agent runs. Tool names and query shapes from provision-agent-local.sh. Answer text is illustrative.
  var agentRuns = [
    { tools: [
        { reason: "The user wants a comparison across four named companies on one topic. finance.compare_companies takes up to six tickers and a topic.", tool: "finance.compare_companies", params: { t1: "AAPL", t2: "MSFT", t3: "GOOGL", t4: "META", topic: "artificial intelligence risk" }, rows: 48 },
        { reason: "I have passages for all four. Pulling the strongest passage per company to cite accession numbers.", tool: "finance.company_disclosures", params: { ticker: "META", topic: "AI regulation", top_n: 3 }, rows: 3 },
      ],
      answer: "### Where they agree\n- All four describe AI as a growth driver and a source of regulatory risk. [AAPL · acc-mock-01] [MSFT · acc-mock-02]\n- All four cite evolving AI regulation in the US and EU. [GOOGL · acc-mock-03] [META · acc-mock-04]\n### Where they differ\n- Two emphasise compute supply and data-centre cost. [MSFT · acc-mock-02] [GOOGL · acc-mock-03]\n- One emphasises content and model-safety risk on its platforms. [META · acc-mock-04]" },
    { tools: [
        { reason: "Sector-scoped question. I will search Financials filings for commercial real estate as a material risk.", tool: "platform.core.search", params: { index: "sec_10k_2026", query: "commercial real estate exposure material risk", filter: "sector: Financials" }, rows: 10 },
        { reason: "Counting distinct filings that match to give the breadth.", tool: "finance.sector_breakdown", params: { topic: "commercial real estate" }, rows: 11 },
      ],
      answer: "### Financials filings flagging CRE\n- Several large banks name office-loan concentration as a material risk. [WFC · acc-mock-11] [BAC · acc-mock-12]\n- Regional banks tie CRE exposure to deposit and capital pressure. [USB · acc-mock-13] [TFC · acc-mock-14]\n### Breadth\n- Financials has the highest count of matching filings in the sector breakdown." },
    { tools: [
        { reason: "Energy sector plus a topic. Searching for transition-risk language.", tool: "platform.core.search", params: { index: "sec_10k_2026", query: "climate transition risk carbon policy", filter: "sector: Energy" }, rows: 10 },
      ],
      answer: "### Transition risks the Energy sector discloses\n- Carbon pricing and emissions regulation. [XOM · acc-mock-21] [CVX · acc-mock-22]\n- Demand shift toward low-carbon energy. [COP · acc-mock-23]\n- Capital-allocation and stranded-asset risk. [XOM · acc-mock-21]" },
    { tools: [
        { reason: "This is an aggregation across the corpus. finance.sector_breakdown counts distinct filings per sector for a topic.", tool: "finance.sector_breakdown", params: { topic: "supply chain disruption" }, rows: 11 },
      ],
      answer: "### Sector with the most supply-chain filings\n- Industrials leads the count, followed by Information Technology and Consumer Discretionary. (finance.sector_breakdown, COUNT_DISTINCT(accession) BY sector)\n- Counts come from one ES|QL query over sec_10k_2026." },
    { tools: [
        { reason: "Healthcare sector, topic generative AI in clinical workflows, three examples.", tool: "platform.core.search", params: { index: "sec_10k_2026", query: "generative AI clinical workflow", filter: "sector: Health Care", size: 3 }, rows: 3 },
      ],
      answer: "### Three healthcare 10-Ks discussing generative AI in clinical workflows\n- A managed-care company on AI-assisted care management. [UNH · acc-mock-41]\n- A medical-technology company on AI in imaging workflows. [mock · acc-mock-42]\n- A health-services company on AI documentation tools. [mock · acc-mock-43]" },
  ];
  // Kit-pace offsets in seconds for one agent run. DOC-ONLY bench note: "3 LLM calls · 120K · 77s".
  var agentTiming = { firstReason: 6, perTool: 14, answerStart: 8, answerDur: 16 };

  var workflowYaml = [
    "name: daily-10-k-ai-risk-digest",
    "description: Daily 10-K AI-Risk Digest",
    "triggers:",
    "  - type: scheduled",
    "    with:",
    "      rrule:",
    "        freq: DAILY",
    "        byhour: [9]",
    "        tzid: UTC",
    "steps:",
    "  - name: ask_agent",
    "    type: ai.agent",
    "    with:",
    "      agent_id: finance-analyst",
    "      message: Which S&P 500 sectors are leaning hardest into AI-risk language right now?",
    "  - name: log_digest",
    "    type: console",
    "    with:",
    "      message: \"{{ steps.ask_agent.output }}\"",
  ].join("\n");

  var steps = [
    { id: "setup", title: "00 Setup", ch: 0, target: 60,
      coach: { status: "STAGED",
        say: ["Two nodes in this case, one Elasticsearch 9.5.6 cluster. The DGX Spark has the GB10 GPU; the Framework Desktop runs on CPU.", "One setting differs: vectors.indexing.use_gpu. Everything runs inside the case, with no cloud account and no per-hour bill.", "Press the right arrow for the race."],
        proof: "Same index mapping, same Elasticsearch version on both nodes: only the indexing hardware differs.",
        honest: "The cards describe the kit's own two nodes. Node names, heap sizes and roles come from the compose files. The 9.5.6 version on both nodes is the showcase target: confirm with GET / on each node before the session.",
        questions: [
          { q: "What does this cost to run?", a: "There is no per-hour or per-token bill. Inference, embeddings and search all run on the two nodes in the case." },
          { q: "Do search nodes need a GPU?", a: "No. The GPU builds the graph; the result is HNSW, which the CPU node searches as well." },
        ],
        fails: "Static chapter. If the deck will not load, the frontend is down; present from the deck PDF." } },
    { id: "speed", title: "01 Speed", ch: 1, target: 90,
      coach: { status: "STAGED",
        say: ["Click Start. Left is CPU HNSW, right is GPU cuVS CAGRA.", "When the GPU finishes, the popup appears. Use the presenter tabs while the CPU catches up: why it matters, use cases, scale projection.", "When both finish, read the headline row: ingest, force merge and end-to-end speedups."],
        proof: "Force-merge speedup is the number to land: the GPU builds the graph during merge.",
        honest: "The subtitle says \"live, real-time race … CAGRA\". On the kit this is the same staged simulator as the vineyard (841,536 docs, 15 s vs 55 s), so the speedups are staged. The headline row states where the job ran and that there is no cloud bill; it shows no dollar figure. Say: \"This visualizes the shape of the result.\"",
        questions: [
          { q: "What did this run cost?", a: "Nothing per job. Both nodes are in the case; there is no per-hour or per-token billing." },
          { q: "What is CAGRA?", a: "The cuVS GPU graph-build algorithm. Elasticsearch builds the graph on the GPU and converts it to HNSW, so CPU search works unchanged." },
          { q: "Is the recall measured?", a: "No. 98.9 / 98.7 are hardcoded in the simulator." },
        ],
        fails: "Bars do not move: the backend or /api/race is down. Go to chapter 02 and talk over the Architecture tab." } },
    { id: "side", title: "02 Side-by-Side", ch: 2, target: 60,
      coach: { status: "STAGED",
        say: ["Throughput tab replays the race history.", "Architecture tab: vectors.indexing.use_gpu: true is the only change. cuVS runs graph build and merge through cuvs-java; Elasticsearch parses, stores and serves on CPU.", "Kit economics: inference and embeddings run on the DGX Spark, there is no per-hour or per-token bill, and nothing leaves the case."],
        proof: "One setting changes. Graphs built on the GPU convert to HNSW, so search nodes need no GPU.",
        honest: "The kit economics panel carries no dollar figures. Its two durations come from the staged race.",
        questions: [
          { q: "Do search nodes need GPUs?", a: "No. GPU-built graphs are HNSW on disk, and any CPU node serves the queries." },
          { q: "Which release ships this?", a: "The chapter says bundled in Elasticsearch 9.5.6, the kit's version. Check current release notes before quoting availability or licence tier." },
        ],
        fails: "Chart empty: no race has run. Go back to 01 and run it, or describe the shape." } },
    { id: "elastic", title: "— Elastic", ch: 3, target: 45,
      coach: { status: "STAGED",
        say: ["Segue. A faster index build matters because one index feeds search, agents, dashboards and workflows.", "Three pillars: developer speed, new use cases from faster rebuilds, relevance for agents."],
        proof: "The next two chapters use one index, sec_10k_2026, from two interfaces.",
        honest: "The pipeline text says \"GPU-built index from chapter 01\". On the kit the SEC index is 768-d, embedded with Jina Embeddings v5 Omni on the Spark, and the race did not build it. The index must be re-embedded on the kit before the demo (STAGED, confirm on kit).",
        questions: [{ q: "What are the four consumers?", a: "Analyst search, developer API, the agent, and Kibana dashboards and workflows, all on the same index." }],
        fails: "Static chapter." } },
    { id: "interface", title: "03 Interface", ch: 4, target: 90,
      coach: { status: "LIVE",
        say: ["Left: the analyst types a question and gets semantic hits over 503 S&P 500 10-K filings.", "Right: the developer's exact request as cURL, Python or Dev Tools.", "Click \"AI model risk and governance disclosures\", then a sector chip to filter."],
        proof: "took_ms is the real query time. Paste the Dev Tools tab into Kibana and get the same hits.",
        honest: "Search and sector counts are LIVE. The query is embedded on the Spark with Jina Embeddings v5 Omni at 768-d. The 503 filings and 93,541 chunks are labels.",
        questions: [
          { q: "How fast is it?", a: "The panel shows took_ms from the live query. No kit latency figure is quoted beyond that." },
          { q: "Can I filter and search together?", a: "Yes. The sector filter runs inside the kNN query as a filter." },
        ],
        fails: "502 \"Query embed failed\": the backend cannot reach its query embedder (F3). On stage: open Kibana Discover on sec-10k-data-view and run a keyword search. Fix after: confirm the kit config points the SEC embedder at Jina v5 Omni on :8081, set in the backend container environment. Sector chips missing: /api/finance/sectors returned 500 because ES is unreachable (F1)." } },
    { id: "agentic", title: "04 Agentic", ch: 5, target: 150,
      coach: { status: "LIVE",
        say: ["This is Elastic Agent Builder. The finance-analyst agent has three ES|QL tools (company disclosures, compare companies, sector breakdown) plus platform tools.", "Send the first example. Reasoning and tool calls stream; the answer cites ticker and accession for every claim.", "Open a tool call to show the ES|QL it ran. Open in Kibana shows the same conversation in Agent Builder."],
        proof: "Each claim carries a ticker and accession from a tool result.",
        honest: "The chat runs live through Kibana Agent Builder and Nemotron 3.5 Lightning on vLLM on the Spark, through the finance-ollama-llm connector. The config card is mostly canned. The Tradeoffs panel shows this run's time and tokens and states there is no cloud spend. Rehearse this chapter on your kit and budget one to two minutes per question. Kit pace in the mock runs about 45 to 60 s.",
        questions: [
          { q: "What tools can the agent use?", a: "Ten: three custom ES|QL tools and seven platform tools (search, execute_esql, generate_esql, get_document_by_id, get_index_mapping, list_indices, index_explorer). It is told to use at most six calls per question." },
          { q: "Where does the model run?", a: "NVIDIA Nemotron 3.5 Lightning on vLLM on the DGX Spark, through a Kibana OpenAI-compatible connector named finance-ollama-llm. The id is historical; the old Ollama connector stays as finance-ollama-fallback." },
          { q: "How do I trust the answer?", a: "Open the tool calls. The agent answers from what its ES|QL queries returned and must cite ticker and accession." },
        ],
        fails: "Spinner with no events after 60 s: Agent Builder or the model is hung, and the backend has no read timeout (F9). Click Reset conversation and ask the sector-breakdown example (one tool call), or go back to chapter 03. Pre-run one question before the session to warm Nemotron 3.5 Lightning." } },
    { id: "workflows", title: "— Workflows", ch: 6, target: 45,
      coach: { status: "STAGED",
        say: ["The same agent on a schedule: a daily 10-K AI-risk digest at 09:00 UTC.", "Workflows trigger agents, and agents can call workflows back."],
        proof: "The ai.agent step calls finance-analyst by id: the same agent from chapter 04.",
        honest: "The YAML is shown, not provisioned. \"Open in Kibana\" and \"Trigger now\" return 404 on the kit (F13). Do not click them.",
        questions: [{ q: "Is Workflows GA?", a: "Check the release notes for your target version before quoting. On the kit it is shown as YAML only." }],
        fails: "If someone clicks the links: they 404 because the workflow is not provisioned. Move on." } },
    { id: "stack", title: "05 The Stack", ch: 7, target: 45,
      coach: { status: "STAGED",
        say: ["Recap: GPU-built index, search for analysts and developers, an agent that cites its sources, a workflow on a schedule.", "The point: how fast you rebuild the vector layer sets how fresh everything above it can be."],
        proof: "Everything shown ran in the case: Elasticsearch 9.5.6, Jina Embeddings v5 Omni and Nemotron 3.5 Lightning on the DGX Spark.",
        honest: "The recap quotes no speedup multiplier; no kit measurement exists. The links need internet; on an airgapped kit share them afterwards.",
        questions: [{ q: "Where can I read more?", a: "The Search Labs blog, github.com/elastic/elasticsearch and build.nvidia.com. Send the links after the session." }],
        fails: "Esc returns to the chooser." } },
  ];

  var drills = {
    llm: { label: "LLM timeout", see: "Chapter 04: the agent shows a spinner and no events. It never errors because the backend has no read timeout (F9).", fix: "Click Reset conversation. Ask the sector-breakdown example (one tool call). If that hangs too, go to chapter 03 and show live search." },
    search: { label: "Search fallback", see: "Chapter 03: 502 \"Query embed failed\". The backend cannot reach its query embedder (F3).", fix: "Open Kibana Discover on sec-10k-data-view and search there. After the session confirm the kit config points the SEC embedder at Jina v5 Omni." },
    es: { label: "ES down", see: "Chapter 03: sector chips missing (sectors 500) and search fails. Chapter 04: tool calls return errors and the agent says it cannot reach the data.", fix: "Stay on the static chapters (00, 01, 02, 05). After the session: check docker ps on both nodes and GET _cluster/health." },
  };

  M.data.sec = {
    id: "sec", title: "SEC Findings", accent: "blue", chapters: chapters, hardware: hardware, tcoDefaults: tcoDefaults, computeTco: computeTco,
    exampleSearches: exampleSearches, exampleAgent: exampleAgent, sectors: sectors, hitSets: hitSets, hitScores: hitScores,
    agentRuns: agentRuns, agentTiming: agentTiming, workflowYaml: workflowYaml, steps: steps, drills: drills,
    corpus: { filings: 503, chunks: 93541, index: "sec_10k_2026", dims: 768 },
  };
})();
