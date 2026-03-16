from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Elasticsearch — one cluster, two data nodes
    ES_MAIN_URL: str = "http://es-cpu:9200"           # Framework CPU node (local)
    ES_GPU_URL: str = "http://192.168.1.20:9200"       # DGX Spark GPU node

    # DGX Spark — AI/ML powerhouse
    DGX_SPARK_HOST: str = "192.168.1.20"

    # Ollama — all inference on DGX Spark
    OLLAMA_EMBED_URL: str = "http://192.168.1.20:11434"
    OLLAMA_LLM_URL: str = "http://192.168.1.20:11434"

    # Models
    EMBED_MODEL: str = "nomic-embed-text"
    LLM_MODEL: str = "gpt-oss:120b"

    # Data paths (container mount)
    DATA_DIR: str = "/data"

    # Race settings
    RACE_BATCH_SIZE: int = 500
    RACE_METRICS_INTERVAL_MS: int = 500

    @property
    def es_gpu_url(self) -> str:
        return self.ES_GPU_URL

    @property
    def es_cpu_url(self) -> str:
        return self.ES_MAIN_URL

    class Config:
        env_prefix = "VINEYARD_"
        env_file = ".env"


settings = Settings()
