"""
NPK nutrient model driven by soil type, weather, and management.

Weekly readings per station. Block C shows potassium depletion from
waterlogging starting mid-2022.
"""

import json
import math
import random
from datetime import date, timedelta

from .config import (
    BLOCKS, VINEYARD_ID, DRAINAGE_FAILURE,
    get_station_positions, RANDOM_SEED,
)
from .weather import DayWeather


def normalize(value: float, min_val: float, max_val: float) -> float:
    if max_val == min_val:
        return 0.0
    return round(max(0.0, min(1.0, (value - min_val) / (max_val - min_val))), 6)


def generate_npk(weather_lookup: dict[date, DayWeather], output_path: str) -> int:
    """Generate NPK JSONL. Returns doc count."""
    rng = random.Random(RANDOM_SEED + 2)
    count = 0

    drain_start = date.fromisoformat(DRAINAGE_FAILURE["start_date"])
    k_depletion = DRAINAGE_FAILURE["k_depletion_rate"]

    with open(output_path, "w") as out:
        for block in BLOCKS:
            stations = get_station_positions(block)
            soil = block.soil

            for station in stations:
                station_rng = random.Random(hash(station["station_id"] + "npk"))

                # Per-station baseline variation
                n_base = soil.base_n + station_rng.gauss(0, 3)
                p_base = soil.base_p + station_rng.gauss(0, 2)
                k_base = soil.base_k + station_rng.gauss(0, 5)

                sorted_dates = sorted(weather_lookup.keys())
                # Weekly sampling (every 7 days)
                for d in sorted_dates[::7]:
                    w = weather_lookup[d]
                    month = d.month
                    day_of_year = d.timetuple().tm_yday

                    # Seasonal N pattern: spring application bump (March-April)
                    n_seasonal = 15 * math.exp(-((month - 3.5) ** 2) / 2)
                    # N depletes through growing season
                    n_depletion = max(0, (day_of_year - 90) / 365 * 12) if day_of_year > 90 else 0
                    nitrogen = n_base + n_seasonal - n_depletion + rng.gauss(0, 2)

                    # P is relatively stable
                    phosphorus = p_base + rng.gauss(0, 1.5)
                    # Slow annual depletion without amendment
                    years_elapsed = (d - date(2018, 1, 1)).days / 365
                    phosphorus -= years_elapsed * 0.5

                    # K — Block C potassium cliff
                    potassium = k_base + rng.gauss(0, 3)
                    if block.id == DRAINAGE_FAILURE["block_id"] and d >= drain_start:
                        months_since = (d - drain_start).days / 30
                        potassium -= potassium * k_depletion * months_since
                        potassium = max(50, potassium)  # floor

                    # pH stable per soil type with minor seasonal variation
                    ph = soil.base_ph + 0.1 * math.sin(2 * math.pi * day_of_year / 365) + rng.gauss(0, 0.05)

                    npk_vector = [
                        normalize(nitrogen, 0, 100),
                        normalize(phosphorus, 0, 60),
                        normalize(potassium, 0, 300),
                        normalize(w.temp_avg_c, -10, 40),
                        normalize(w.humidity_pct, 10, 100),
                        normalize(ph, 5, 9),
                        normalize(w.precip_mm, 0, 30),
                    ]

                    doc = {
                        "timestamp": d.strftime("%Y-%m-%dT12:00:00Z"),
                        "vineyard_id": VINEYARD_ID,
                        "block_id": block.id,
                        "block_name": block.name,
                        "variety": block.variety,
                        "source": "sensor",
                        "location": {"lat": station["lat"], "lon": station["lon"]},
                        "soil_nitrogen_mgkg": round(max(5, nitrogen), 1),
                        "soil_phosphorus_mgkg": round(max(3, phosphorus), 1),
                        "soil_potassium_mgkg": round(max(30, potassium), 1),
                        "temperature_c": w.temp_avg_c,
                        "humidity_pct": w.humidity_pct,
                        "ph": round(ph, 2),
                        "rainfall_mm": w.precip_mm,
                        "crop_suitability": block.variety.lower().replace(" ", "_"),
                        "npk_vector": npk_vector,
                    }

                    out.write(json.dumps(doc) + "\n")
                    count += 1

            print(f"  Block {block.id} NPK done")

    return count
