"""
Soil moisture model driven by weather, soil type, and block properties.

Generates hourly readings (sampled to 4/day) for each station across all
blocks. Block C's drainage failure is injected starting mid-2022.
"""

import json
import math
import random
from datetime import date, datetime, timedelta

from .config import (
    BLOCKS, VINEYARD_ID, DRAINAGE_FAILURE,
    get_station_positions, RANDOM_SEED,
)
from .weather import DayWeather


DEPTHS = [15, 30, 60]  # cm — 6in, 12in, 24in
HOURS = [6, 10, 14, 18]  # 4 readings per day


def normalize(value: float, min_val: float, max_val: float) -> float:
    if max_val == min_val:
        return 0.0
    return round(max(0.0, min(1.0, (value - min_val) / (max_val - min_val))), 6)


def compute_reading_vector(moisture, temp6, temp12, temp24, ec, depth, hour, day_of_year):
    return [
        normalize(moisture, 0, 60),
        normalize(temp6, -10, 45),
        normalize(temp12, -10, 45),
        normalize(temp24, -10, 45),
        normalize(ec, 0, 2.0),
        normalize(depth, 0, 150),
        normalize(hour, 0, 24),
        normalize(day_of_year, 1, 366),
    ]


def generate_soil(weather_lookup: dict[date, DayWeather], output_path: str) -> int:
    """Generate soil moisture JSONL. Returns doc count."""
    rng = random.Random(RANDOM_SEED + 1)
    count = 0

    # Parse drainage failure date
    drain_start = datetime.strptime(DRAINAGE_FAILURE["start_date"], "%Y-%m-%d").date()
    drain_ramp = DRAINAGE_FAILURE["severity_ramp_days"]
    drain_reduction = DRAINAGE_FAILURE["drainage_reduction"]

    with open(output_path, "w") as out:
        for block in BLOCKS:
            stations = get_station_positions(block)
            base_drainage = block.soil.drainage
            base_capacity = block.soil.water_capacity
            base_ec = block.soil.base_ec

            for station in stations:
                station_rng = random.Random(hash(station["station_id"]))

                # Per-station personality (slight variation)
                station_drainage_offset = station_rng.gauss(0, 0.03)
                station_capacity_offset = station_rng.gauss(0, 2)

                # Track moisture state per depth (carry forward)
                moisture_state = {d: base_capacity * 0.6 for d in DEPTHS}

                sorted_dates = sorted(weather_lookup.keys())
                for d in sorted_dates:
                    w = weather_lookup[d]
                    day_of_year = d.timetuple().tm_yday

                    # Effective drainage — apply Block C failure
                    eff_drainage = base_drainage + station_drainage_offset
                    if block.id == DRAINAGE_FAILURE["block_id"] and d >= drain_start:
                        days_since = (d - drain_start).days
                        failure_pct = min(1.0, days_since / drain_ramp)
                        eff_drainage *= (1.0 - failure_pct * drain_reduction)

                    eff_capacity = base_capacity + station_capacity_offset

                    # Daily water budget
                    rain_infiltration = w.precip_mm * 0.7  # 70% infiltrates
                    # Evapotranspiration (simplified Hargreaves)
                    et = max(0, 0.5 * w.solar_rad_wm2 / 400 * (w.temp_avg_c + 5) * 0.12)
                    # Drainage loss
                    drain_loss = eff_drainage * 1.5  # mm equivalent lost per day

                    for depth in DEPTHS:
                        depth_factor = 1.0 - (depth / 200)  # deeper = less responsive
                        prev = moisture_state[depth]

                        # Water balance
                        gain = rain_infiltration * depth_factor
                        loss = (et * depth_factor + drain_loss * depth_factor * 0.5)
                        new_moisture = prev + (gain - loss) * 0.15  # damped

                        # Clamp
                        new_moisture = max(5, min(eff_capacity + 5, new_moisture))
                        moisture_state[depth] = new_moisture

                    # Generate hourly readings
                    for hour in HOURS:
                        for depth in DEPTHS:
                            base_moisture = moisture_state[depth]

                            # Hourly variation (drier midday, wetter morning/evening)
                            hour_factor = -1.5 * math.sin(2 * math.pi * (hour - 6) / 24)
                            moisture = base_moisture + hour_factor + rng.gauss(0, 0.5)
                            moisture = max(2, min(base_capacity + 8, moisture))

                            # Temperature at depth (damped + lagged from air temp)
                            depth_lag = depth / 15  # hours of lag per depth
                            depth_damping = 0.4 + 0.6 * math.exp(-depth / 40)
                            temp_at_depth = (
                                10 + (w.temp_avg_c - 10) * depth_damping
                                + rng.gauss(0, 0.3)
                            )

                            # EC correlates inversely with moisture (salt concentration)
                            ec = base_ec * (1.3 - moisture / base_capacity * 0.4)
                            # Block C: rising EC from waterlogging salt accumulation
                            if block.id == DRAINAGE_FAILURE["block_id"] and d >= drain_start:
                                days_since = (d - drain_start).days
                                ec += 0.0003 * days_since  # slow rise
                            ec = max(0.05, ec + rng.gauss(0, 0.02))

                            timestamp = datetime(d.year, d.month, d.day, hour)

                            doc = {
                                "timestamp": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                                "vineyard_id": VINEYARD_ID,
                                "block_id": block.id,
                                "block_name": block.name,
                                "station_id": station["station_id"],
                                "variety": block.variety,
                                "location": {"lat": station["lat"], "lon": station["lon"]},
                                "source": "sensor",
                                "soil_moisture_pct": round(moisture, 2),
                                "soil_temp_6in_c": round(temp_at_depth, 2),
                                "soil_temp_12in_c": round(temp_at_depth - 1.2, 2),
                                "soil_temp_24in_c": round(temp_at_depth - 2.8, 2),
                                "electrical_conductivity": round(ec, 3),
                                "depth_cm": depth,
                                "air_temp_c": w.temp_avg_c,
                                "precip_mm": w.precip_mm,
                                "humidity_pct": w.humidity_pct,
                                "reading_vector": compute_reading_vector(
                                    moisture, temp_at_depth,
                                    temp_at_depth - 1.2, temp_at_depth - 2.8,
                                    ec, depth, hour, day_of_year,
                                ),
                            }

                            out.write(json.dumps(doc) + "\n")
                            count += 1

                            if count % 200000 == 0:
                                print(f"    soil: {count:,} records...")

            print(f"  Block {block.id} ({block.name}) done")

    return count
