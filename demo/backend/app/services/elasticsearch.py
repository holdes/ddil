from elasticsearch import AsyncElasticsearch

from app.config import settings

_gpu_client: AsyncElasticsearch | None = None
_cpu_client: AsyncElasticsearch | None = None


def _es_auth() -> dict:
    """basic_auth kwargs when cluster security is on; empty dict otherwise."""
    if settings.ES_USER and settings.ES_PASSWORD:
        return {"basic_auth": (settings.ES_USER, settings.ES_PASSWORD)}
    return {}


def get_gpu_client() -> AsyncElasticsearch:
    global _gpu_client
    if _gpu_client is None:
        _gpu_client = AsyncElasticsearch(
            settings.es_gpu_url,
            request_timeout=30,
            **_es_auth(),
        )
    return _gpu_client


def get_cpu_client() -> AsyncElasticsearch:
    global _cpu_client
    if _cpu_client is None:
        _cpu_client = AsyncElasticsearch(
            settings.es_cpu_url,
            request_timeout=30,
            **_es_auth(),
        )
    return _cpu_client


async def close_clients():
    global _gpu_client, _cpu_client
    if _gpu_client:
        await _gpu_client.close()
        _gpu_client = None
    if _cpu_client:
        await _cpu_client.close()
        _cpu_client = None
