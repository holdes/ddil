"""Race indexer — staged GPU vs CPU simulation showcasing cuVS acceleration.

The race simulates realistic throughput numbers for a 50K vector corpus:
- GPU (cuVS on Blackwell): ~28,500 vectors/sec, finishes in ~15s, merge in ~48ms
- CPU (standard HNSW):     ~4,200 vectors/sec, finishes in ~55s, merge in ~340ms

Total race duration: ~60 seconds.
"""

import asyncio
import random
import time

from app.services.metrics import RaceMetrics, PathMetrics

race_metrics = RaceMetrics()

TOTAL_DOCS = 841536


async def _simulate_path(
    path_metrics: PathMetrics,
    label: str,
    target_throughput: float,
    merge_time_ms: float,
    total_seconds: float,
):
    """Simulate indexing + merge for one path."""
    path_metrics.start_time = time.time()
    path_metrics.total_docs = TOTAL_DOCS

    steps = int(total_seconds / 0.5)  # update every 500ms
    docs_per_step = TOTAL_DOCS / steps

    for i in range(steps):
        await asyncio.sleep(0.5)

        # Ramp up throughput with some noise
        progress = (i + 1) / steps
        ramp = min(1.0, progress * 3)  # ramp up in first third
        noise = random.gauss(1.0, 0.05)
        current_throughput = target_throughput * ramp * noise

        indexed = min(TOTAL_DOCS, int(docs_per_step * (i + 1)))
        path_metrics.docs_indexed = indexed
        path_metrics.elapsed_ms = (time.time() - path_metrics.start_time) * 1000
        path_metrics.throughput = current_throughput

        # Simulate batch merge times
        batch_merge = merge_time_ms * (0.8 + random.random() * 0.4)
        path_metrics.merge_time_ms = batch_merge

        # Resource utilization
        if label == "gpu":
            path_metrics.gpu_percent = 65 + random.gauss(0, 8)
            path_metrics.cpu_percent = 25 + random.gauss(0, 5)
            path_metrics.memory_used_gb = 12.4 + random.gauss(0, 0.3)
        else:
            path_metrics.cpu_percent = 85 + random.gauss(0, 6)
            path_metrics.gpu_percent = 0
            path_metrics.memory_used_gb = 6.2 + random.gauss(0, 0.2)

        path_metrics.history.append({
            "time": round(path_metrics.elapsed_ms / 1000, 1),
            "throughput": round(current_throughput),
        })
        if len(path_metrics.history) > 120:
            path_metrics.history = path_metrics.history[-120:]

    # Final merge
    path_metrics.merge_phase = True
    path_metrics.merge_time_ms = merge_time_ms
    path_metrics.docs_indexed = TOTAL_DOCS
    path_metrics.elapsed_ms = (time.time() - path_metrics.start_time) * 1000
    path_metrics.throughput = TOTAL_DOCS / (path_metrics.elapsed_ms / 1000)
    path_metrics.complete = True


async def run_race(index_name: str = "race-soil", data_file: str | None = None):
    """Run staged GPU vs CPU race."""
    global race_metrics
    race_metrics = RaceMetrics(status="running")

    # GPU: fast — ~15 seconds total, 28,500 vec/s, 48ms merge
    # CPU: slow — ~55 seconds total, 4,200 vec/s, 340ms merge
    await asyncio.gather(
        _simulate_path(race_metrics.gpu, "gpu",
                        target_throughput=28500, merge_time_ms=48, total_seconds=15),
        _simulate_path(race_metrics.cpu, "cpu",
                        target_throughput=4200, merge_time_ms=340, total_seconds=55),
    )

    race_metrics.status = "complete"


def get_race_metrics() -> RaceMetrics:
    return race_metrics


async def reset_race():
    global race_metrics
    race_metrics = RaceMetrics()
