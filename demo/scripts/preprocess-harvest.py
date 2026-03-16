#!/usr/bin/env python3
"""
Preprocess French Vineyard yield data into vineyard-harvest JSONL.

Transforms the Zenodo grapevine yield dataset (Oger et al. 2023) into
harvest records. Maps two Syrah fields onto the Domaine de la Côte Cachée
narrative — Field 1 becomes blocks A1/A2 (main Syrah plantings),
Field 2 becomes block C1 (experimental Merlot-to-Syrah grafts).

Also fabricates multi-vintage data by projecting the 2022 harvest
across 2018-2023 with realistic vintage variation (frost years,
drought years, exceptional years).
"""

import csv
import json
import random
import sys
from pathlib import Path

VINEYARD_ID = "cote-cachee"
VINEYARD_CENTER = (46.065, -118.345)

# Vintage character profiles (multipliers on base yield/quality)
VINTAGES = {
    2018: {"yield_mult": 1.05, "brix_mult": 1.02, "quality": 7, "note": "warm dry summer"},
    2019: {"yield_mult": 0.92, "brix_mult": 1.08, "quality": 8, "note": "late harvest, concentrated"},
    2020: {"yield_mult": 1.10, "brix_mult": 0.95, "quality": 6, "note": "high vigor, dilute"},
    2021: {"yield_mult": 0.78, "brix_mult": 1.12, "quality": 9, "note": "spring frost, low yield excellence"},
    2022: {"yield_mult": 1.00, "brix_mult": 1.00, "quality": 7, "note": "baseline vintage"},
    2023: {"yield_mult": 0.85, "brix_mult": 1.05, "quality": 8, "note": "drought stress, good extraction"},
}

# Block mapping for fields
FIELD_BLOCKS = {
    1: [
        {"block_id": "A1", "variety": "Syrah", "fraction": 0.6},
        {"block_id": "A2", "variety": "Syrah", "fraction": 0.4},
    ],
    2: [
        {"block_id": "C1", "variety": "Merlot", "fraction": 1.0},
    ],
}


def row_to_geopoint(x: float, y: float, field: int) -> dict:
    """Convert projected coordinates to approximate lat/lon in vineyard."""
    # Normalize coords relative to vineyard center
    # Original data is in projected coords (French Lambert), we fake-map to Walla Walla
    random.seed(hash((x, y)))
    lat_offset = (y - 6272000) / 100000 * 0.003
    lon_offset = (x - 767000) / 100000 * 0.004
    field_offset = 0.002 if field == 2 else 0
    return {
        "lat": round(VINEYARD_CENTER[0] + lat_offset + random.gauss(0, 0.00005), 6),
        "lon": round(VINEYARD_CENTER[1] + lon_offset + field_offset + random.gauss(0, 0.00005), 6),
    }


def fabricate_quality_params(total_yield: float, vintage: dict) -> dict:
    """Generate realistic harvest quality parameters."""
    # Base values for Syrah/Merlot in warm climate
    base_brix = 23.5
    base_ph = 3.55
    base_acidity = 5.8  # g/L tartaric acid
    base_yan = 180  # mg/L

    # Yield inversely affects concentration
    yield_kg = total_yield / 1000.0  # grams to kg
    concentration = max(0.7, 1.3 - (yield_kg / 5.0))

    brix = round(base_brix * vintage["brix_mult"] * concentration + random.gauss(0, 0.8), 1)
    ph = round(base_ph + (brix - 23.5) * 0.03 + random.gauss(0, 0.05), 2)
    acidity = round(base_acidity * (1.1 - concentration * 0.1) + random.gauss(0, 0.3), 1)
    yan = round(base_yan * concentration * vintage["yield_mult"] + random.gauss(0, 15), 0)

    return {
        "sugar_brix": max(18, min(28, brix)),
        "ph": max(3.1, min(4.0, ph)),
        "acidity": max(3.5, min(8.5, acidity)),
        "yan_mgL": max(80, min(300, yan)),
    }


def main():
    raw_dir = Path(__file__).parent.parent / "data" / "raw" / "french-vineyard" / "Data" / "Aggregated_data"
    output = Path(__file__).parent.parent / "data" / "preprocessed" / "harvest-records.jsonl"

    if not raw_dir.exists():
        print(f"Raw data not found: {raw_dir}")
        sys.exit(1)

    output.parent.mkdir(parents=True, exist_ok=True)

    count = 0

    with open(output, "w") as out:
        # Process yield files
        for field_num in [1, 2]:
            yield_file = raw_dir / f"Field{field_num}_Yield.csv"
            if not yield_file.exists():
                print(f"  Skipping missing file: {yield_file}")
                continue

            print(f"Processing Field {field_num}: {yield_file.name}")

            with open(yield_file) as f:
                reader = csv.DictReader(f)
                rows = list(reader)

            blocks = FIELD_BLOCKS[field_num]

            for row in rows:
                vine_type = row.get("Type", "").strip()
                if vine_type != "Productive":
                    continue

                try:
                    x = float(row.get("X", 0))
                    y = float(row.get("Y", 0))
                    total_yield = float(row.get("Total_yield", 0))
                    inflorescence = int(row.get("Inflorescence_number", 0))
                except (ValueError, TypeError):
                    continue

                if total_yield <= 0:
                    continue

                geo = row_to_geopoint(x, y, field_num)

                # Assign to block based on row position
                vine_id = row.get("ID", "0")
                block_idx = hash(vine_id) % len(blocks)
                block = blocks[block_idx]

                # Generate records across multiple vintages
                for year, vintage in VINTAGES.items():
                    random.seed(hash((vine_id, year)))

                    # Vary yield per vintage
                    vintage_yield = total_yield * vintage["yield_mult"] + random.gauss(0, total_yield * 0.05)
                    vintage_yield = max(50, vintage_yield)  # minimum 50g

                    quality = fabricate_quality_params(vintage_yield, vintage)

                    # Harvest date varies by vintage (Sept-Oct)
                    base_day = 260 + int((vintage["brix_mult"] - 0.95) * 30)  # later harvest = riper
                    harvest_day = base_day + random.randint(-5, 5)
                    from datetime import date
                    harvest_date = date(year, 1, 1) + __import__("datetime").timedelta(days=harvest_day - 1)

                    doc = {
                        "timestamp": harvest_date.strftime("%Y-%m-%dT00:00:00Z"),
                        "vineyard_id": VINEYARD_ID,
                        "block_id": block["block_id"],
                        "location": geo,
                        "grape_mass_kg": round(vintage_yield / 1000.0, 3),
                        "sugar_brix": quality["sugar_brix"],
                        "acidity": quality["acidity"],
                        "ph": quality["ph"],
                        "yan_mgL": quality["yan_mgL"],
                        "quality_score": vintage["quality"] + random.randint(-1, 1),
                        "variety": block["variety"],
                        "vintage_year": year,
                    }

                    out.write(json.dumps(doc) + "\n")
                    count += 1

            print(f"  Field {field_num}: done")

        # Also process bunch-level data from Field 1 for extra volume
        bunches_file = raw_dir / "Field1_Bunches.csv"
        if bunches_file.exists():
            print(f"Processing bunch-level data: {bunches_file.name}")
            with open(bunches_file) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        x = float(row.get("X", 0))
                        y = float(row.get("Y", 0))
                        bunch_weight = float(row.get("Bunch_weight", 0))
                    except (ValueError, TypeError):
                        continue

                    if bunch_weight <= 0:
                        continue

                    geo = row_to_geopoint(x, y, 1)
                    vine_id = row.get("ID", "0")
                    block = FIELD_BLOCKS[1][hash(vine_id) % 2]

                    # Only do 2022 vintage for bunch-level (it's the real data year)
                    vintage = VINTAGES[2022]
                    quality = fabricate_quality_params(bunch_weight * 5, vintage)

                    doc = {
                        "timestamp": "2022-09-25T00:00:00Z",
                        "vineyard_id": VINEYARD_ID,
                        "block_id": block["block_id"],
                        "location": geo,
                        "grape_mass_kg": round(bunch_weight / 1000.0, 4),
                        "sugar_brix": quality["sugar_brix"],
                        "acidity": quality["acidity"],
                        "ph": quality["ph"],
                        "yan_mgL": quality["yan_mgL"],
                        "quality_score": 7 + random.randint(-1, 1),
                        "variety": block["variety"],
                        "vintage_year": 2022,
                    }

                    out.write(json.dumps(doc) + "\n")
                    count += 1

    print(f"\nTotal: {count:,} harvest records written to {output}")


if __name__ == "__main__":
    main()
