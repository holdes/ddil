"""
Harvest yield and wine quality model.

Annual records per block, driven by growing season weather integration.
Yield is a function of GDD, water stress, disease pressure, and vine age.
Wine quality traces back to harvest parameters.
"""

import json
import math
import random
from datetime import date

from .config import (
    BLOCKS, VINEYARD_ID, VINTAGE_PROFILES, DRAINAGE_FAILURE,
    get_station_positions, RANDOM_SEED,
)
from .weather import DayWeather


def generate_harvest_and_wine(
    weather_lookup: dict[date, DayWeather],
    harvest_path: str,
    wine_path: str,
) -> tuple[int, int]:
    """Generate harvest + wine JSONL. Returns (harvest_count, wine_count)."""
    rng = random.Random(RANDOM_SEED + 3)
    h_count = 0
    w_count = 0

    drain_start = date.fromisoformat(DRAINAGE_FAILURE["start_date"])

    with open(harvest_path, "w") as h_out, open(wine_path, "w") as w_out:
        for year, profile in VINTAGE_PROFILES.items():
            if profile["quality_base"] is None:
                continue  # skip partial year

            # Compute growing season stats (April-September)
            season_gdd = 0
            season_precip = 0
            season_days_hot = 0
            season_days_wet = 0
            season_humidity_avg = 0
            season_count = 0

            for d, w in weather_lookup.items():
                if d.year == year and 4 <= d.month <= 9:
                    season_gdd += w.gdd
                    season_precip += w.precip_mm
                    if w.temp_max_c > 35:
                        season_days_hot += 1
                    if w.precip_mm > 5:
                        season_days_wet += 1
                    season_humidity_avg += w.humidity_pct
                    season_count += 1

            if season_count > 0:
                season_humidity_avg /= season_count

            for block in BLOCKS:
                stations = get_station_positions(block)
                center = stations[0]  # use first station as block center

                # Base yield per vine (kg) depends on variety and vine age
                base_yield_kg = {
                    "Cabernet Sauvignon": 3.2,
                    "Syrah": 2.8,
                    "Merlot": 3.5,
                    "Chardonnay": 4.0,
                    "Cabernet Franc": 2.2,  # old vines, lower yield
                    "Riesling": 3.8,
                }.get(block.variety, 3.0)

                # Vine count estimate from acres
                vines_per_acre = 1200
                total_vines = int(block.acres * vines_per_acre)

                # ── Yield modifiers ──

                # Water stress (drought reduces yield, mild stress = better quality)
                water_stress = max(0, 1.0 - season_precip / 200)  # 0=wet, 1=very dry
                yield_water_mult = 1.0 - water_stress * 0.35

                # Block B (wind-exposed) amplifies drought impact
                if block.story_tag == "drought_vulnerable" and year == 2020:
                    yield_water_mult *= 0.65  # severe hit

                # Block E (old vines) buffers everything
                if block.story_tag == "old_vine_resilience":
                    yield_water_mult = 0.7 + 0.3 * yield_water_mult  # dampened

                # Disease loss (wet conditions)
                disease_loss = 0
                if season_days_wet > 15 and season_humidity_avg > 55:
                    disease_loss = 0.10 + rng.gauss(0, 0.03)
                    if block.story_tag == "disease_prone":
                        disease_loss += 0.15  # Block D extra vulnerable
                    if block.id == DRAINAGE_FAILURE["block_id"] and date(year, 6, 1) >= drain_start:
                        disease_loss += 0.20  # Block C waterlogged

                # Frost loss
                frost_loss = 0
                for d, w in weather_lookup.items():
                    if d.year == year and d.month in (3, 4) and w.temp_min_c < -2:
                        frost_loss = 0.15 + rng.gauss(0, 0.05)
                        if block.elevation_m > 300:
                            frost_loss *= 0.7  # higher = colder but cold air drains
                        break

                # Block C drainage degradation
                drain_yield_loss = 0
                if block.id == DRAINAGE_FAILURE["block_id"] and date(year, 9, 1) >= drain_start:
                    months_affected = (date(year, 9, 1) - drain_start).days / 30
                    drain_yield_loss = min(0.30, months_affected * 0.015)

                # Final yield
                yield_mult = yield_water_mult * (1 - disease_loss) * (1 - frost_loss) * (1 - drain_yield_loss)
                yield_per_vine = base_yield_kg * yield_mult * profile["gdd_mult"] + rng.gauss(0, 0.15)
                yield_per_vine = max(0.3, yield_per_vine)
                total_yield_kg = yield_per_vine * total_vines

                # ── Quality parameters ──

                # Brix: inversely related to yield (concentration effect)
                base_brix = {"Cabernet Sauvignon": 24.5, "Syrah": 25.0, "Merlot": 23.5,
                             "Chardonnay": 22.0, "Cabernet Franc": 24.0, "Riesling": 21.0}
                brix = base_brix.get(block.variety, 23.0)
                concentration = 1.0 / max(0.5, yield_mult)
                brix *= min(1.15, 0.85 + concentration * 0.15)
                brix += rng.gauss(0, 0.5)

                # Acidity: inversely correlated with heat
                acidity = 6.5 - (season_gdd / 1800) * 1.5 + rng.gauss(0, 0.3)
                acidity = max(4.0, min(8.0, acidity))

                ph = 3.2 + (brix - 20) * 0.04 + rng.gauss(0, 0.05)
                yan = 160 + (yield_mult - 0.5) * 60 + rng.gauss(0, 15)

                quality = profile["quality_base"]
                # Adjust per block
                if block.story_tag == "star_performer":
                    quality += 1
                elif block.story_tag == "old_vine_resilience":
                    quality = max(quality, 7)  # floor
                # Disease/drainage penalty
                if disease_loss > 0.15:
                    quality -= 1
                if drain_yield_loss > 0.10:
                    quality -= 1
                # Drought concentration bonus (if survived)
                if water_stress > 0.5 and yield_mult > 0.5:
                    quality += 1
                quality = max(3, min(10, quality + rng.randint(-1, 1)))

                # Harvest date (later = riper, varies by variety)
                base_harvest_day = {"Cabernet Sauvignon": 275, "Syrah": 270,
                                    "Merlot": 268, "Chardonnay": 255,
                                    "Cabernet Franc": 272, "Riesling": 260}
                h_day = base_harvest_day.get(block.variety, 270)
                h_day += int((brix - 23) * 2) + rng.randint(-3, 3)
                harvest_date = date(year, 1, 1) + __import__("datetime").timedelta(days=h_day - 1)

                # ── Write harvest records ──
                # Multiple picks per block (3-5 sectors)
                num_picks = rng.randint(3, 5)
                for pick in range(num_picks):
                    pick_date = harvest_date + __import__("datetime").timedelta(days=pick * rng.randint(1, 3))
                    pick_yield = total_yield_kg / num_picks * (0.8 + rng.random() * 0.4)
                    pick_brix = brix + rng.gauss(0, 0.3)

                    h_doc = {
                        "timestamp": pick_date.strftime("%Y-%m-%dT08:00:00Z"),
                        "vineyard_id": VINEYARD_ID,
                        "block_id": block.id,
                        "block_name": block.name,
                        "location": {"lat": center["lat"], "lon": center["lon"]},
                        "grape_mass_kg": round(pick_yield, 1),
                        "sugar_brix": round(pick_brix, 1),
                        "acidity": round(acidity + rng.gauss(0, 0.2), 1),
                        "ph": round(ph + rng.gauss(0, 0.03), 2),
                        "yan_mgL": round(yan + rng.gauss(0, 10), 0),
                        "quality_score": quality,
                        "variety": block.variety,
                        "vintage_year": year,
                    }
                    h_out.write(json.dumps(h_doc) + "\n")
                    h_count += 1

                # ── Write wine records ──
                # 2-3 wine lots per block-vintage (barrel variations)
                num_lots = rng.randint(2, 3)
                for lot in range(num_lots):
                    alcohol = round(brix * 0.55 + rng.gauss(0, 0.2), 1)
                    vol_acidity = round(0.3 + disease_loss * 0.8 + rng.gauss(0, 0.05), 2)
                    residual_sugar = round(max(0.5, 4.0 - (brix - 22) * 0.3 + rng.gauss(0, 0.3)), 1)

                    w_doc = {
                        "timestamp": date(year + 1, 3, 15).strftime("%Y-%m-%dT00:00:00Z"),
                        "vineyard_id": VINEYARD_ID,
                        "block_id": block.id,
                        "block_name": block.name,
                        "wine_type": "red" if block.variety != "Chardonnay" and block.variety != "Riesling" else "white",
                        "variety": block.variety,
                        "vintage_year": year,
                        "fixed_acidity": round(acidity + rng.gauss(0, 0.3), 1),
                        "volatile_acidity": round(max(0.1, vol_acidity), 2),
                        "citric_acid": round(0.25 + rng.gauss(0, 0.08), 2),
                        "residual_sugar": residual_sugar,
                        "chlorides": round(0.045 + rng.gauss(0, 0.01), 3),
                        "free_sulfur_dioxide": round(15 + rng.gauss(0, 5), 0),
                        "total_sulfur_dioxide": round(45 + rng.gauss(0, 10), 0),
                        "density": round(0.994 + alcohol * 0.0001 + rng.gauss(0, 0.0005), 4),
                        "ph": round(ph + rng.gauss(0, 0.05), 2),
                        "sulphates": round(0.55 + rng.gauss(0, 0.1), 2),
                        "alcohol": alcohol,
                        "quality": quality + rng.randint(-1, 0),
                    }
                    w_out.write(json.dumps(w_doc) + "\n")
                    w_count += 1

            print(f"  Vintage {year} done")

    return h_count, w_count
