#!/usr/bin/env python3
"""
Master data generator for Domaine de la Côte Cachée.

Generates all JSONL files from a single coherent causal model:
  weather → soil moisture → NPK → disease → harvest → wine

Usage:
  python -m demo.datagen.generate [--output-dir demo/data/synthetic]
"""

import argparse
import sys
from pathlib import Path

# Add parent to path for package imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from demo.datagen.weather import generate_weather, get_weather_lookup
from demo.datagen.soil import generate_soil
from demo.datagen.npk import generate_npk
from demo.datagen.harvest import generate_harvest_and_wine
from demo.datagen.config import BLOCKS, VINEYARD_NAME


def main():
    parser = argparse.ArgumentParser(description="Generate vineyard dataset")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "synthetic",
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    print(f"╔══════════════════════════════════════════════════╗")
    print(f"║  {VINEYARD_NAME:^46s}  ║")
    print(f"║  Synthetic Data Generator                        ║")
    print(f"╚══════════════════════════════════════════════════╝")
    print()

    # ── Step 1: Weather ──────────────────────────────────────
    print("Step 1: Generating weather model...")
    weather = generate_weather()
    weather_lookup = get_weather_lookup(weather)
    print(f"  {len(weather):,} daily weather records (2018-2025)")
    print()

    # ── Step 2: Soil moisture ────────────────────────────────
    print("Step 2: Generating soil moisture readings...")
    soil_path = args.output_dir / "soil-readings.jsonl"
    soil_count = generate_soil(weather_lookup, str(soil_path))
    print(f"  Total: {soil_count:,} soil records → {soil_path.name}")
    print()

    # ── Step 3: NPK nutrients ────────────────────────────────
    print("Step 3: Generating NPK nutrient profiles...")
    npk_path = args.output_dir / "npk-profiles.jsonl"
    npk_count = generate_npk(weather_lookup, str(npk_path))
    print(f"  Total: {npk_count:,} NPK records → {npk_path.name}")
    print()

    # ── Step 4: Harvest + Wine ───────────────────────────────
    print("Step 4: Generating harvest and wine records...")
    harvest_path = args.output_dir / "harvest-records.jsonl"
    wine_path = args.output_dir / "wine-quality.jsonl"
    h_count, w_count = generate_harvest_and_wine(
        weather_lookup, str(harvest_path), str(wine_path)
    )
    print(f"  Total: {h_count:,} harvest records → {harvest_path.name}")
    print(f"  Total: {w_count:,} wine records → {wine_path.name}")
    print()

    # ── Step 5: Summary ──────────────────────────────────────
    # Note: grape image embeddings are kept from the original dataset
    # (demo/data/preprocessed/grape-embeddings.jsonl) and will be
    # re-tagged with block_id/timestamp in a separate step.

    total = soil_count + npk_count + h_count + w_count
    print("═" * 52)
    print(f"  COMPLETE — {total:,} total documents generated")
    print()
    print("  Breakdown:")
    print(f"    Soil moisture:  {soil_count:>10,}")
    print(f"    NPK nutrients:  {npk_count:>10,}")
    print(f"    Harvest:        {h_count:>10,}")
    print(f"    Wine:           {w_count:>10,}")
    print(f"    Imagery:        {'17,151':>10s}  (existing, needs re-tag)")
    print(f"    ─────────────────────────")
    print(f"    Total:          {total + 17151:>10,}")
    print()
    print(f"  Output: {args.output_dir}")
    print("═" * 52)


if __name__ == "__main__":
    main()
