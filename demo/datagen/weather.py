"""
Synthetic weather model for Walla Walla AVA.

Generates daily weather records (2018-2025) based on real climatological
normals for the region. Weather events from config.py are injected to
create the narrative (2020 drought, 2022 wet spring, etc.).
"""

import math
import random
from datetime import date, timedelta
from dataclasses import dataclass

from .config import WEATHER_EVENTS, YEARS, RANDOM_SEED


@dataclass
class DayWeather:
    date: date
    temp_min_c: float
    temp_max_c: float
    temp_avg_c: float
    precip_mm: float
    humidity_pct: float
    wind_speed_ms: float
    solar_rad_wm2: float
    gdd: float  # growing degree days (base 10C)


# Walla Walla climatological normals (approximate)
MONTHLY_NORMALS = {
    #     avg_temp  precip_mm  humidity  solar_rad
    1:  (-0.5,     35,        78,       80),
    2:  (2.5,      28,        72,       130),
    3:  (6.5,      30,        62,       200),
    4:  (10.5,     25,        52,       280),
    5:  (15.0,     22,        48,       340),
    6:  (19.5,     15,        42,       380),
    7:  (24.0,     5,         32,       390),
    8:  (23.5,     6,         34,       350),
    9:  (18.5,     10,        40,       270),
    10: (11.5,     22,        55,       170),
    11: (4.5,      35,        72,       90),
    12: (0.0,      38,        80,       65),
}


def generate_weather(seed: int = RANDOM_SEED) -> list[DayWeather]:
    """Generate daily weather for all configured years."""
    rng = random.Random(seed)
    days = []

    for year in YEARS:
        start = date(year, 1, 1)
        end = date(year, 12, 31)
        d = start

        # Carry forward for autocorrelation
        prev_temp_anomaly = 0.0
        prev_precip_anomaly = 0.0

        while d <= end:
            month = d.month
            day_of_year = d.timetuple().tm_yday
            normals = MONTHLY_NORMALS[month]
            base_temp, base_precip, base_humidity, base_solar = normals

            # Smooth daily temperature using sinusoidal interpolation
            # Peaks around day 200 (mid-July), troughs around day 15 (mid-Jan)
            seasonal_phase = 2 * math.pi * (day_of_year - 15) / 365
            seasonal_temp = -1.0 + 25.0 * (0.5 + 0.5 * math.sin(seasonal_phase - math.pi / 2))

            # Blend monthly normal with sinusoidal for smoother transitions
            temp_avg = 0.6 * seasonal_temp + 0.4 * base_temp

            # Autocorrelated anomaly (weather persists day to day)
            prev_temp_anomaly = 0.7 * prev_temp_anomaly + rng.gauss(0, 1.5)
            temp_avg += prev_temp_anomaly

            # Apply weather events
            events = WEATHER_EVENTS.get(year, [])
            precip_mult = 1.0
            temp_offset = 0.0
            for m_start, m_end, event_type, magnitude in events:
                if m_start <= month <= m_end:
                    if event_type == "drought":
                        precip_mult = magnitude  # e.g., 0.40 = 60% reduction
                    elif event_type == "wet_spring":
                        precip_mult = magnitude  # e.g., 2.2x
                    elif event_type == "cold_snap":
                        temp_offset = magnitude  # e.g., -12
                    elif event_type == "late_frost":
                        if day_of_year >= 91 and day_of_year <= 120:  # April
                            temp_offset = magnitude
                    elif event_type == "early_frost":
                        if day_of_year >= 60 and day_of_year <= 90:  # March
                            temp_offset = magnitude
                    elif event_type == "heat_wave":
                        temp_offset = magnitude

            temp_avg += temp_offset

            # Diurnal range (wider in summer, narrower in winter)
            diurnal = 6 + 8 * (0.5 + 0.5 * math.sin(seasonal_phase - math.pi / 2))
            temp_min = temp_avg - diurnal / 2 + rng.gauss(0, 1)
            temp_max = temp_avg + diurnal / 2 + rng.gauss(0, 1)

            # Precipitation (Poisson-ish: some days rain, most don't in summer)
            daily_precip_chance = min(0.8, base_precip / 30 / 3)  # rough daily probability
            if rng.random() < daily_precip_chance:
                prev_precip_anomaly = 0.5 * prev_precip_anomaly + rng.gauss(0, 2)
                precip = max(0, (base_precip / 10 + prev_precip_anomaly) * precip_mult)
            else:
                precip = 0.0
                prev_precip_anomaly *= 0.5

            # Humidity correlates with precip and temperature
            humidity = base_humidity + (10 if precip > 0 else -5) + rng.gauss(0, 5)
            humidity = max(15, min(98, humidity))

            # Wind (higher in spring, exposed locations vary per block)
            wind = 2.5 + 1.5 * math.sin(2 * math.pi * (day_of_year - 80) / 365)
            wind += rng.gauss(0, 0.8)
            wind = max(0.2, wind)

            # Solar radiation
            solar = base_solar * (0.3 if precip > 5 else 0.7 if precip > 0 else 1.0)
            solar += rng.gauss(0, 20)
            solar = max(20, solar)

            # Growing degree days (base 10C)
            gdd = max(0, temp_avg - 10)

            days.append(DayWeather(
                date=d,
                temp_min_c=round(temp_min, 1),
                temp_max_c=round(temp_max, 1),
                temp_avg_c=round(temp_avg, 1),
                precip_mm=round(max(0, precip), 1),
                humidity_pct=round(humidity, 1),
                wind_speed_ms=round(wind, 1),
                solar_rad_wm2=round(solar, 0),
                gdd=round(gdd, 2),
            ))

            d += timedelta(days=1)

    return days


def get_weather_lookup(weather: list[DayWeather]) -> dict[date, DayWeather]:
    """Build a date->weather lookup dict."""
    return {w.date: w for w in weather}
