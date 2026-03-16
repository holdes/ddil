#!/usr/bin/env python3
"""
Preprocess USDA Cook Farm sensor data into vineyard-soil JSONL.

Transforms 42 stations x ~2,800 days x 5 depths into ~590K individual
sensor reading documents. Merges VWC (volumetric water content) with
temperature data per station/date. Maps Cook Farm stations onto a
fictional vineyard grid with realistic geo_points.

The Cook Farm data (Pullman, WA) is recontextualized as historical
baseline data for the "Domaine de la Côte Cachée" vineyard — a
30-hectare estate in the Walla Walla AVA growing Syrah, Cab Sav,
and Merlot across 6 blocks.
"""

import csv
import json
import math
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

# ── Vineyard Narrative ───────────────────────────────────────────

# Fictional vineyard in Walla Walla AVA (real wine region near Pullman)
VINEYARD_ID = "cote-cachee"
VINEYARD_CENTER = (46.065, -118.345)  # Walla Walla AVA

# Map 42 stations to 6 vineyard blocks with varieties
BLOCKS = [
    {"id": "A1", "variety": "Syrah", "aspect": "south", "elevation_m": 285},
    {"id": "A2", "variety": "Syrah", "aspect": "southwest", "elevation_m": 290},
    {"id": "B1", "variety": "Cabernet Sauvignon", "aspect": "south", "elevation_m": 295},
    {"id": "B2", "variety": "Cabernet Sauvignon", "aspect": "southeast", "elevation_m": 300},
    {"id": "C1", "variety": "Merlot", "aspect": "east", "elevation_m": 280},
    {"id": "C2", "variety": "Merlot", "aspect": "west", "elevation_m": 275},
]

DEPTHS = [30, 60, 90, 120, 150]

# Seasonal EC patterns (dS/m) — higher in dry summer, lower in wet winter
EC_SEASONAL = {
    1: 0.35, 2: 0.32, 3: 0.30, 4: 0.33, 5: 0.38, 6: 0.45,
    7: 0.55, 8: 0.60, 9: 0.52, 10: 0.42, 11: 0.38, 12: 0.36,
}

# Drought years for narrative (real PNW droughts)
DROUGHT_YEARS = {2007, 2012, 2015}


def station_to_block(station_id: str) -> dict:
    """Map station ID to a vineyard block deterministically."""
    idx = hash(station_id) % len(BLOCKS)
    return BLOCKS[idx]


def station_to_geopoint(station_id: str, block: dict) -> dict:
    """Generate a geo_point within the vineyard grid."""
    random.seed(hash(station_id))
    block_idx = BLOCKS.index(block)
    row = block_idx // 2
    col = block_idx % 2
    # Spread blocks across ~500m x 300m
    lat = VINEYARD_CENTER[0] + (row * 0.001) + random.uniform(-0.0003, 0.0003)
    lon = VINEYARD_CENTER[1] + (col * 0.0015) + random.uniform(-0.0005, 0.0005)
    return {"lat": round(lat, 6), "lon": round(lon, 6)}


def fabricate_ec(moisture: float, month: int, depth: int, year: int) -> float:
    """Generate realistic electrical conductivity from moisture + season."""
    base = EC_SEASONAL.get(month, 0.4)
    # EC inversely correlates with moisture (salt concentration)
    moisture_factor = max(0.1, 1.0 - (moisture / 50.0))
    depth_factor = 1.0 + (depth / 500.0)  # slightly higher at depth
    drought_factor = 1.15 if year in DROUGHT_YEARS else 1.0
    noise = random.gauss(0, 0.03)
    return round(max(0.05, base * moisture_factor * depth_factor * drought_factor + noise), 3)


def normalize(value: float, min_val: float, max_val: float) -> float:
    if max_val == min_val:
        return 0.0
    return round(max(0.0, min(1.0, (value - min_val) / (max_val - min_val))), 6)


def compute_reading_vector(moisture, temp, ec, depth, hour, day_of_year) -> list:
    """8-dim normalized vector for kNN similarity search."""
    return [
        normalize(moisture, 0, 60),
        normalize(temp, -5, 40),
        normalize(temp, -5, 40),   # temp_12 (approx from single reading)
        normalize(temp, -5, 40),   # temp_24 (approx)
        normalize(ec, 0, 2),
        normalize(depth, 0, 150),
        normalize(hour, 0, 24),
        normalize(day_of_year, 1, 366),
    ]


def parse_tab_file(filepath: Path) -> list[dict]:
    """Parse tab-delimited Cook Farm sensor file."""
    rows = []
    with open(filepath) as f:
        # Handle quoted headers
        header_line = f.readline().strip()
        headers = [h.strip('"') for h in header_line.split('\t')]
        for line in f:
            vals = [v.strip().strip('"') for v in line.strip().split('\t')]
            if len(vals) == len(headers):
                rows.append(dict(zip(headers, vals)))
    return rows


def main():
    raw_dir = Path(__file__).parent.parent / "data" / "raw" / "cook-farm" / "CAF_Sensor_Dataset"
    output = Path(__file__).parent.parent / "data" / "preprocessed" / "soil-readings.jsonl"

    vwc_dir = raw_dir / "CAF_VWC"
    temp_dir = raw_dir / "CAF_Temp"

    if not vwc_dir.exists():
        print(f"VWC directory not found: {vwc_dir}")
        sys.exit(1)

    output.parent.mkdir(parents=True, exist_ok=True)

    # Build temp lookup: station -> date -> {depths}
    print("Loading temperature data...")
    temp_lookup = {}
    for temp_file in sorted(temp_dir.glob("*_temp.txt")):
        station = temp_file.stem.replace("_temp", "")
        rows = parse_tab_file(temp_file)
        temp_lookup[station] = {}
        for row in rows:
            date = row.get("Date", "")
            temps = {}
            for depth in DEPTHS:
                key = f"Temp_{depth}cm"
                val = row.get(key, "NA")
                if val != "NA" and val != "":
                    try:
                        temps[depth] = float(val)
                    except ValueError:
                        pass
            if temps:
                temp_lookup[station][date] = temps

    print(f"  Loaded temp data for {len(temp_lookup)} stations")

    # Process VWC files, merge with temp, explode by depth
    print("Processing VWC data...")
    count = 0
    skipped = 0

    with open(output, "w") as out:
        for vwc_file in sorted(vwc_dir.glob("*_vwc.txt")):
            station = vwc_file.stem.replace("_vwc", "")
            block = station_to_block(station)
            geo = station_to_geopoint(station, block)
            rows = parse_tab_file(vwc_file)

            for row in rows:
                date_str = row.get("Date", "")
                if not date_str:
                    continue

                try:
                    dt = datetime.strptime(date_str, "%Y-%m-%d")
                except ValueError:
                    continue

                month = dt.month
                year = dt.year
                day_of_year = dt.timetuple().tm_yday

                # Get temps for this station/date
                station_temps = temp_lookup.get(station, {}).get(date_str, {})

                # Explode into per-depth records
                for depth in DEPTHS:
                    vwc_key = f"VWC_{depth}cm"
                    vwc_val = row.get(vwc_key, "NA")

                    if vwc_val == "NA" or vwc_val == "":
                        skipped += 1
                        continue

                    try:
                        moisture = float(vwc_val) * 100  # fraction -> percentage
                    except ValueError:
                        skipped += 1
                        continue

                    if moisture < 0 or moisture > 100:
                        skipped += 1
                        continue

                    temp = station_temps.get(depth, 15.0)  # default 15°C
                    ec = fabricate_ec(moisture, month, depth, year)

                    # Fabricate 4 hourly snapshots per day for more volume
                    for hour in [6, 10, 14, 18]:
                        # Small hourly variation
                        hour_moisture = moisture + random.gauss(0, 0.3)
                        hour_temp = temp + (hour - 12) * 0.15 + random.gauss(0, 0.2)
                        hour_ec = ec + random.gauss(0, 0.01)

                        timestamp = dt.replace(hour=hour).strftime("%Y-%m-%dT%H:%M:%SZ")

                        doc = {
                            "timestamp": timestamp,
                            "vineyard_id": VINEYARD_ID,
                            "block_id": block["id"],
                            "station_id": station,
                            "location": geo,
                            "source": "historical",
                            "soil_moisture_pct": round(hour_moisture, 2),
                            "soil_temp_6in_c": round(hour_temp, 2),
                            "soil_temp_12in_c": round(hour_temp - 1.5, 2),
                            "soil_temp_24in_c": round(hour_temp - 3.0, 2),
                            "electrical_conductivity": round(max(0.01, hour_ec), 3),
                            "depth_cm": depth,
                            "reading_vector": compute_reading_vector(
                                hour_moisture, hour_temp, hour_ec,
                                depth, hour, day_of_year
                            ),
                        }

                        out.write(json.dumps(doc) + "\n")
                        count += 1

                        if count % 100000 == 0:
                            print(f"    {count:,} records...")

            print(f"  Station {station} done (block {block['id']})")

    print(f"\nTotal: {count:,} records written to {output}")
    print(f"Skipped: {skipped:,} NA/invalid readings")


if __name__ == "__main__":
    main()
