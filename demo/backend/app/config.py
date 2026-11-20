from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Elasticsearch — one cluster, two data nodes ───────────────────────────
    ES_MAIN_URL: str = "http://es-cpu:9200"            # Framework CPU node (compose-local)
    ES_GPU_URL: str = "http://es.ddil:9200"            # DGX Spark GPU node (friendly DNS → 192.168.1.20)

    # Optional host/port overrides. When the *_HOST form is supplied it wins over
    # the *_URL default above (e.g. raw kit IPs instead of .ddil names).
    ES_GPU_HOST: str | None = None
    ES_GPU_PORT: int = 9200
    ES_CPU_HOST: str | None = None
    ES_CPU_PORT: int = 9201

    # ── DGX Spark — AI/ML powerhouse ──────────────────────────────────────────
    DGX_SPARK_HOST: str = "spark.ddil"                 # friendly DNS → 192.168.1.20

    # ── Local LLM (airgapped) ─────────────────────────────────────────────────
    # Which server answers services/llm.py (agent phases, RAG, Need-to-Know analyst):
    #   "vllm"   → vLLM OpenAI-compatible /v1/chat/completions at VLLM_URL (default)
    #              serving NVIDIA Nemotron 3.5 Lightning on the DGX Spark
    #   "ollama" → Ollama native /api/chat at OLLAMA_LLM_URL (previous path)
    LLM_BACKEND: str = "vllm"
    VLLM_URL: str = "http://vllm.ddil:8000"            # friendly DNS → 192.168.1.20; port: confirm on kit
    VLLM_API_KEY: str | None = None                    # only if vLLM runs with --api-key
    # vllm: used when GET /v1/models lists it, else the first served id (cached).
    # ollama: set VINEYARD_LLM_MODEL to the pulled Ollama tag.
    LLM_MODEL: str = "nemotron-3.5-lightning"

    # ── Ollama — local inference (airgapped) ──────────────────────────────────
    OLLAMA_EMBED_URL: str = "http://ollama.ddil:11434"
    OLLAMA_LLM_URL: str = "http://ollama.ddil:11434"
    # Vineyard text search still embeds with nomic via Ollama (services/embedder);
    # switching it needs a re-embed of the Vineyard index. See enablement/FACTS.md.
    EMBED_MODEL: str = "nomic-embed-text"

    # ── Data paths (container mount) ──────────────────────────────────────────
    DATA_DIR: str = "/data"

    # ── Race settings ─────────────────────────────────────────────────────────
    RACE_BATCH_SIZE: int = 500
    RACE_METRICS_INTERVAL_MS: int = 500

    # ── Finance / SEC demo (chapters 03 + 04) ─────────────────────────────────
    # Which embedder produces query vectors for /api/finance/search. Both run on
    # the airgapped kit (DGX Spark):
    #   "jina"   → Jina Embeddings v5 Omni via JINA_OMNI_URL /v1/embeddings (default)
    #   "ollama" → OLLAMA_EMBED_URL /api/embed with EMBED_MODEL (fallback)
    # The chosen backend MUST match the model and dims the SEC_INDEX was built
    # with (demo/scripts/finance/reembed-local.py + setup-index-local.sh).
    EMBED_BACKEND: str = "jina"

    SEC_INDEX: str = "sec_10k_2026"
    # One dimension for the SEC index, the corpus re-embed and the query embed.
    # 768 matches the kit's jina-omni-text ES inference endpoint.
    SEC_EMBED_DIMS: int = 768
    # Model the Kibana connector (provision-connector-local.sh) is set to; the
    # finance-analyst agent answers through it. Reported by /api/finance/agent/state.
    SEC_AGENT_LLM_MODEL: str = "nemotron-3.5-lightning"

    # Elasticsearch basic-auth (security on for the SEC index; None = no auth)
    ES_USER: str | None = None
    ES_PASSWORD: str | None = None

    # Kibana / Agent Builder
    KIBANA_URL: str = "http://kibana.ddil:5601"        # friendly DNS → 192.168.1.10
    KIBANA_SPACE: str = "default"
    KIBANA_USER: str | None = None
    KIBANA_PASSWORD: str | None = None
    AGENT_BUILDER_AGENT_ID: str = "finance-analyst"
    # Default to the stable tool-calling Qwen3 connector (NOT the old
    # finance-ollama-llm id, which doesn't exist → 404 on the SEC agent).
    AGENT_BUILDER_CONNECTOR_ID: str = "ddil-agent-qwen3"
    # Tool-calling LLM connector every Choose-Your-Adventure agent converses through.
    # Qwen3 (ddil-agent-qwen3) — NOT Nemotron (leaks tool-call tokens). See apply-agents.sh.
    AGENT_LLM_CONNECTOR: str = "ddil-agent-qwen3"
    ES_INFERENCE_LLM_ID: str | None = None

    # ── Jina multimodal + DLS demo (adventure 3) ──────────────────────────────
    # Local Jina omni embedding server (OpenAI-compatible /v1/embeddings) on the
    # Blackwell GPU. Speaks text + image (base64) into one shared vector space.
    JINA_OMNI_URL: str = "http://jina.ddil:8081"       # friendly DNS → 192.168.1.20
    JINA_OMNI_MODEL: str = "jina-embeddings-v5-omni-small"
    JINA_ES_URL: str | None = None              # falls back to es_gpu_url
    # Simple "search images by typing" track (ES-native inference, 768-d)
    JINA_MM_INDEX: str = "jina-multimodal"
    JINA_MM_INFERENCE_ID: str = "jina-omni-text"
    JINA_MM_DIMS: int = 768
    # Scale / DLS "Need-to-Know" track (app-side embed, 1024-d, bbq_hnsw)
    JINA_DLS_INDEX: str = "pmc-unstructured"
    JINA_DLS_DIMS: int = 1024
    # On-box media mounts (figures + source PDFs) served back to the UI
    JINA_FIG_DIR: str = "/data/jina/extracted_imgs"
    JINA_PDF_DIR: str = "/data/jina/samples"
    JINA_IMG_DIR: str = "/data/jina/images"     # 10-doc track PNGs

    # ── CCS edge-federation demo (adventure 4) ────────────────────────────────
    # Direction: the BOX is the CCS coordinator (it dials OUT to ECH and adds it
    # as a remote cluster named "cloud"). "Synchronise Now" registers that remote
    # on the box; a federated search then spans the box's edge index + ECH's
    # cloud index. Box→ECH is outbound-only — no inbound-to-box networking.
    ECH_ES_URL: str = "https://your-deployment.es.us-east-1.aws.found.io:9243"  # REST, for seeding the cloud index
    ECH_API_KEY: str | None = None              # ApiKey auth to ECH (seeding)
    CCS_INDEX: str = "field-reports"            # demo index on both clusters

    # ECH registered on the box as remote "cloud" (RCS 2.0). The cross-cluster
    # API key is pre-loaded in the box's ES keystore (cluster.remote.cloud.credentials);
    # Synchronise Now just sets mode+proxy_address to connect/disconnect.
    CCS_CLOUD_ALIAS: str = "cloud"
    CCS_CLOUD_PROXY: str = "<ech-remote-host>:9400"   # ECH "remote cluster" proxy endpoint
    CCS_CLOUD_SERVER_NAME: str | None = None          # ECH server_name for TLS SNI (from the deployment's remote params)

    # Coordinator + edge collection both live on the box's local ES. The iPad
    # scene collects + embeds field reports into CCS_INDEX here.
    CCS_EDGE_ES_URL: str | None = None          # the box (coordinator); falls back to es_gpu_url
    CCS_EMBED_DIMS: int = 768                   # nomic-embed-text

    # ── Derived URLs ──────────────────────────────────────────────────────────
    @property
    def jina_es_url(self) -> str:
        return self.JINA_ES_URL or self.es_gpu_url

    @property
    def ccs_edge_es_url(self) -> str:
        return self.CCS_EDGE_ES_URL or self.es_gpu_url

    @property
    def es_gpu_url(self) -> str:
        if self.ES_GPU_HOST:
            return f"http://{self.ES_GPU_HOST}:{self.ES_GPU_PORT}"
        return self.ES_GPU_URL

    @property
    def es_cpu_url(self) -> str:
        if self.ES_CPU_HOST:
            return f"http://{self.ES_CPU_HOST}:{self.ES_CPU_PORT}"
        return self.ES_MAIN_URL

    @property
    def kibana_space_url(self) -> str:
        """Base URL for Agent Builder calls, space-scoped when not 'default'."""
        if self.KIBANA_SPACE and self.KIBANA_SPACE != "default":
            return f"{self.KIBANA_URL}/s/{self.KIBANA_SPACE}"
        return self.KIBANA_URL

    class Config:
        env_prefix = "VINEYARD_"
        env_file = ".env"
        extra = "ignore"  # tolerate vars not modeled here


settings = Settings()
