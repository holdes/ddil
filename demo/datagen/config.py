"""
Domaine de la Côte Cachée — vineyard definition.

All data generation flows from this configuration. Block properties drive
the causal model: soil type affects drainage, aspect affects temperature,
elevation affects frost risk, variety affects disease susceptibility.
"""

from dataclasses import dataclass, field

# ── Vineyard Identity ────────────────────────────────────────────

VINEYARD_ID = "domaine-cote-cachee"
VINEYARD_NAME = "Domaine de la Côte Cachée"
VINEYARD_REGION = "Walla Walla AVA, Washington"

# Center of vineyard (real coordinates in Walla Walla wine country)
CENTER_LAT = 46.0655
CENTER_LON = -118.3420

# Data generation range
YEARS = list(range(2018, 2026))  # 2018-2025, 8 years
RANDOM_SEED = 42


@dataclass
class SoilType:
    name: str
    drainage: float        # 0-1, higher = drains faster
    water_capacity: float  # max VWC % the soil can hold
    base_ec: float         # baseline electrical conductivity (dS/m)
    base_ph: float
    base_n: float          # baseline nitrogen mg/kg
    base_p: float          # baseline phosphorus mg/kg
    base_k: float          # baseline potassium mg/kg


@dataclass
class Block:
    id: str
    name: str
    variety: str
    acres: float
    elevation_m: int
    aspect: str            # compass direction the slope faces
    soil: SoilType
    lat_offset: float      # offset from vineyard center
    lon_offset: float
    num_stations: int = 4
    story_tag: str = ""    # narrative role

    # Block polygon vertices (offsets from block center in ~degrees)
    polygon_offsets: list = field(default_factory=list)


# ── Soil Types ───────────────────────────────────────────────────

LOESS_BASALT = SoilType(
    name="Loess over basalt",
    drainage=0.75, water_capacity=38, base_ec=0.42,
    base_ph=7.2, base_n=45, base_p=28, base_k=195,
)

ROCKY_SHALLOW = SoilType(
    name="Shallow rocky",
    drainage=0.90, water_capacity=25, base_ec=0.35,
    base_ph=7.0, base_n=30, base_p=22, base_k=160,
)

ALLUVIAL_CLAY = SoilType(
    name="Alluvial clay",
    drainage=0.40, water_capacity=48, base_ec=0.55,
    base_ph=6.8, base_n=55, base_p=35, base_k=210,
)

SANDY_LOAM = SoilType(
    name="Sandy loam",
    drainage=0.80, water_capacity=30, base_ec=0.38,
    base_ph=6.5, base_n=35, base_p=25, base_k=170,
)

VOLCANIC_DEEP = SoilType(
    name="Volcanic, deep",
    drainage=0.65, water_capacity=42, base_ec=0.48,
    base_ph=6.9, base_n=50, base_p=30, base_k=200,
)

LIMESTONE_CHALK = SoilType(
    name="Limestone-rich, chalky",
    drainage=0.85, water_capacity=28, base_ec=0.32,
    base_ph=7.8, base_n=25, base_p=18, base_k=145,
)

# ── Block Definitions ────────────────────────────────────────────

BLOCKS = [
    Block(
        id="BLK-A", name="Les Pierres", variety="Cabernet Sauvignon",
        acres=4.2, elevation_m=285, aspect="south", soil=LOESS_BASALT,
        lat_offset=0.0010, lon_offset=-0.0008, num_stations=5,
        story_tag="star_performer",
        polygon_offsets=[(-0.0005, -0.0012), (0.0005, -0.0012),
                         (0.0006, -0.0003), (-0.0004, -0.0003)],
    ),
    Block(
        id="BLK-B", name="Clos du Vent", variety="Syrah",
        acres=3.8, elevation_m=310, aspect="southwest", soil=ROCKY_SHALLOW,
        lat_offset=0.0025, lon_offset=-0.0015, num_stations=4,
        story_tag="drought_vulnerable",
        polygon_offsets=[(-0.0005, -0.0008), (0.0004, -0.0008),
                         (0.0005, 0.0001), (-0.0004, 0.0001)],
    ),
    Block(
        id="BLK-C", name="La Rivière", variety="Merlot",
        acres=5.1, elevation_m=245, aspect="east", soil=ALLUVIAL_CLAY,
        lat_offset=-0.0008, lon_offset=0.0010, num_stations=5,
        story_tag="mystery_drainage",
        polygon_offsets=[(-0.0006, -0.0010), (0.0006, -0.0010),
                         (0.0007, 0.0002), (-0.0005, 0.0002)],
    ),
    Block(
        id="BLK-D", name="Le Jardin", variety="Chardonnay",
        acres=3.5, elevation_m=260, aspect="northeast", soil=SANDY_LOAM,
        lat_offset=-0.0005, lon_offset=-0.0020, num_stations=4,
        story_tag="disease_prone",
        polygon_offsets=[(-0.0004, -0.0008), (0.0004, -0.0008),
                         (0.0005, 0.0001), (-0.0003, 0.0001)],
    ),
    Block(
        id="BLK-E", name="Vieilles Vignes", variety="Cabernet Franc",
        acres=2.8, elevation_m=295, aspect="south", soil=VOLCANIC_DEEP,
        lat_offset=0.0018, lon_offset=0.0005, num_stations=3,
        story_tag="old_vine_resilience",
        polygon_offsets=[(-0.0004, -0.0006), (0.0003, -0.0006),
                         (0.0004, 0.0002), (-0.0003, 0.0002)],
    ),
    Block(
        id="BLK-F", name="Le Plateau", variety="Riesling",
        acres=2.2, elevation_m=320, aspect="north", soil=LIMESTONE_CHALK,
        lat_offset=0.0030, lon_offset=0.0000, num_stations=3,
        story_tag="cool_climate",
        polygon_offsets=[(-0.0003, -0.0005), (0.0003, -0.0005),
                         (0.0004, 0.0003), (-0.0002, 0.0003)],
    ),
]

# ── Weather Events (baked-in narrative) ──────────────────────────

WEATHER_EVENTS = {
    # year: list of (month_start, month_end, event_type, magnitude)
    2019: [
        (1, 2, "cold_snap", -12),  # January cold snap
    ],
    2020: [
        (6, 8, "drought", 0.40),   # 60% less summer precip
    ],
    2021: [
        (4, 4, "late_frost", -5),   # April frost event
    ],
    2022: [
        (4, 5, "wet_spring", 2.2),  # 2.2x normal spring precip
    ],
    2024: [
        (3, 3, "early_frost", -7),  # Early March frost
        (7, 8, "heat_wave", 5),     # +5C above normal in July-Aug
    ],
}

# Block C drainage failure timeline
DRAINAGE_FAILURE = {
    "block_id": "BLK-C",
    "start_date": "2022-06-15",   # Failure begins
    "severity_ramp_days": 180,     # Takes 6 months to reach full effect
    "drainage_reduction": 0.65,    # Drainage drops to 35% of normal
    "k_depletion_rate": 0.08,      # K drops ~8% per month from waterlogging
}


# ── Vintage Profiles ─────────────────────────────────────────────

VINTAGE_PROFILES = {
    2018: {"character": "warm dry summer", "quality_base": 7, "gdd_mult": 1.05},
    2019: {"character": "cold winter, late harvest", "quality_base": 8, "gdd_mult": 0.95},
    2020: {"character": "severe drought, concentrated fruit", "quality_base": 8, "gdd_mult": 1.15},
    2021: {"character": "spring frost, reduced crop", "quality_base": 9, "gdd_mult": 0.98},
    2022: {"character": "wet spring, disease pressure", "quality_base": 6, "gdd_mult": 1.00},
    2023: {"character": "balanced, classic vintage", "quality_base": 7, "gdd_mult": 1.02},
    2024: {"character": "early frost + summer heat", "quality_base": 7, "gdd_mult": 1.10},
    2025: {"character": "current season (partial data)", "quality_base": None, "gdd_mult": 1.00},
}


def get_block_by_id(block_id: str) -> Block:
    for b in BLOCKS:
        if b.id == block_id:
            return b
    raise ValueError(f"Unknown block: {block_id}")


def get_block_polygon(block: Block) -> list[dict]:
    """Return polygon vertices as list of {lat, lon} dicts."""
    return [
        {
            "lat": round(CENTER_LAT + block.lat_offset + dlat, 6),
            "lon": round(CENTER_LON + block.lon_offset + dlon, 6),
        }
        for dlat, dlon in block.polygon_offsets
    ]


def get_station_positions(block: Block) -> list[dict]:
    """Generate sensor station positions within a block."""
    import random as _rng
    _rng.seed(hash(block.id))
    positions = []
    for i in range(block.num_stations):
        # Random position within block polygon bounding box
        lats = [o[0] for o in block.polygon_offsets]
        lons = [o[1] for o in block.polygon_offsets]
        lat = CENTER_LAT + block.lat_offset + _rng.uniform(min(lats) * 0.7, max(lats) * 0.7)
        lon = CENTER_LON + block.lon_offset + _rng.uniform(min(lons) * 0.7, max(lons) * 0.7)
        positions.append({
            "station_id": f"{block.id}-S{i+1:02d}",
            "lat": round(lat, 6),
            "lon": round(lon, 6),
        })
    return positions
