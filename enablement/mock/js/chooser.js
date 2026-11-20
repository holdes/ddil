/* Trainer home: a copy of the kit frontend's chooser page
   (demo/frontend/src/components/AdventureChooser/AdventureChooser.tsx).
   Icons are Lucide (ISC licence): Grape, Landmark, ScanSearch, Network, ArrowRight.
   Edge Federation is out of scope for the trainer, so its card only shows a notice. */
(function () {
  var M = (window.MOCK = window.MOCK || { data: {}, screens: {} });

  function icon(nodes, size, sw) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + nodes + "</svg>";
  }
  var I = {
    grape: '<path d="M22 5V2l-5.89 5.89"/><circle cx="16.6" cy="15.89" r="3"/><circle cx="8.11" cy="7.4" r="3"/><circle cx="12.35" cy="11.65" r="3"/><circle cx="13.91" cy="5.85" r="3"/><circle cx="18.15" cy="10.09" r="3"/><circle cx="6.56" cy="13.2" r="3"/><circle cx="10.8" cy="17.44" r="3"/><circle cx="5" cy="19" r="3"/>',
    landmark: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>',
    network: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  };

  var CARDS = [
    { id: "vineyard", index: "01", kicker: "Edge AI", title: "Vineyard Intelligence", icon: I.grape,
      body: "Run a six-block Walla Walla estate from a case in the field: soil and nutrient sensors, eight vintages of history, and an AI agronomist that checks the data before it answers.",
      stats: [["841,536", "soil sensor readings"], ["869K", "docs across 5 indices"], ["5 phases", "kNN + Nemotron 3.5 Lightning"]],
      acc: "#48EFCF", accH: "rgba(72,239,207,.7)", sh: "rgba(72,239,207,0.10)" },
    { id: "sec", index: "02", kicker: "Agentic RAG", title: "SEC Findings", icon: I.landmark,
      body: "Work S&amp;P 500 10-K filings as an analyst: semantic search, then an Elastic Agent Builder agent that answers with ES|QL tools and cites its filings.",
      stats: [["10-K", "SEC EDGAR filings"], ["kNN", "search + sector filter"], ["Agent Builder", "10 tools"]],
      acc: "#5B9BFF", accH: "rgba(91,155,255,.7)", sh: "rgba(91,155,255,0.12)" },
    { id: "jina", index: "03", kicker: "Need to know", title: "Multimodal Intelligence", icon: I.scan,
      body: "Search a marked research corpus by meaning across text and figures. Each of four analysts only retrieves what their clearance and compartments allow.",
      stats: [["Jina v5 Omni", "text + image, one space"], ["Hybrid", "BM25 + kNN with RRF"], ["4", "clearance personas"]],
      acc: "#9189FA", accH: "rgba(145,137,250,.7)", sh: "rgba(145,137,250,0.12)" },
    { id: "ccs", index: "04", kicker: "Federation", title: "Edge Federation", icon: I.network,
      body: "Collect and embed field reports on the airgapped box. When HQ runs <em>Synchronise Now</em>, the box dials out to Elastic Cloud and one search spans edge and cloud.",
      stats: [["Box", "is the CCS coordinator"], ["Outbound", "only, no inbound"], ["Edge + cloud", "one query"]],
      acc: "#63C8E3", accH: "rgba(99,200,227,.7)", sh: "rgba(99,200,227,0.11)" },
  ];

  M.renderChooser = function () {
    var h = '<div class="kc"><div class="grid-bg" aria-hidden="true"></div>';
    h += '<header><div class="klogo" role="img" aria-label="Elastic"><img src="brand/logo/logo-elastic-horizontal-white.svg" alt="" draggable="false"></div>' +
      '<div class="status"><i></i>DDIL demo kit · airgapped</div></header>';
    h += '<main><div class="hero"><div class="hero-txt">' +
      '<div class="eyebrow2"><i></i>Sovereign AI · Context engineering anywhere</div>' +
      '<h1>Choose your adventure.<br><span>No cloud required.</span></h1>' +
      '<p class="lede2">GPU-accelerated search and agentic RAG on two nodes in a case. Models, indices and agents run on the kit. The cloud is optional.</p></div>' +
      '<div class="kit"><img src="img/kit-front.webp" alt="Front of the DDIL kit" draggable="false"><div>The kit · front</div></div></div>';
    h += '<div class="cards4">';
    CARDS.forEach(function (c, i) {
      var act = c.id === "ccs" ? 'data-act="ccsNotice"' : 'data-act="choose" data-adv="' + c.id + '"';
      h += '<button type="button" class="kcard" ' + act + ' style="--acc:' + c.acc + ";--acc-h:" + c.accH + ";--sh:" + c.sh + ";animation-delay:" + (0.15 + i * 0.07).toFixed(2) + 's">' +
        '<div class="kick"><span><i></i>' + c.index + " · " + c.kicker + "</span>" + icon(c.icon, 22, 1.75) + "</div>" +
        "<h2>" + c.title + "</h2><p>" + c.body + "</p>" +
        '<div class="stats">' + c.stats.map(function (s) { return "<div><b>" + s[0] + "</b><span>" + s[1] + "</span></div>"; }).join("") + "</div>" +
        '<div class="cta">Start demo' + icon(I.arrow, 14, 2) + "</div></button>";
    });
    h += "</div></main>";
    h += '<footer><span>Elasticsearch 9.5.6 + NVIDIA <span class="nc">cuVS</span> · Nemotron 3.5 Lightning + Jina v5 Omni on DGX Spark</span><span>Airgapped by default</span></footer>';
    return h + "</div>";
  };
})();
