from app.services.elasticsearch import get_gpu_client

# Searchable text fields on the vineyard indices. These hold STRUCTURED sensor
# data — there is no text-embedding field, so query is lexical (BM25). The old
# code did kNN against `reading_vector`, but that's an 8-dim SENSOR feature
# vector, not a text-embedding space: embedding the query with nomic (768-dim)
# dimension-mismatched and every search silently fell back to mock data. The real
# semantic / multimodal search demos are SEC (10-K text) and Jina (papers + images).
# NB: `location` is a geo_point (can't be match-queried) — excluded on purpose.
_TEXT_FIELDS = [
    "block_name^3",
    "variety^3",
    "block_id^2",
    "station_id",
    "source",
    "vineyard_id",
]


async def hybrid_search(
    query: str,
    index: str = "vineyard-soil",
    mode: str = "hybrid",
    size: int = 10,
) -> dict:
    client = get_gpu_client()

    # bm25 = exact best-fields; semantic/hybrid = fuzzy + phrase-boosted so the
    # modes differ and all return real hits (no vineyard text-vector exists).
    if mode == "bm25":
        inner = {
            "multi_match": {"query": query, "fields": _TEXT_FIELDS, "type": "best_fields"}
        }
    else:
        inner = {
            "multi_match": {
                "query": query,
                "fields": _TEXT_FIELDS,
                "type": "most_fields",
                "fuzziness": "AUTO",
                "operator": "or",
            }
        }

    body = {"query": inner}
    resp = await client.search(index=index, body=body, size=size)
    return resp
