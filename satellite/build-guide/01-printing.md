# 01 — Printing

You can print everything before any electronics arrive. Nothing in this section
depends on a delivery.

Drawings: `../cad/renders/drawings/`. STLs: `../cad/stl/` (ours) and
`../cad/stl/frame/` (the HC-Eleni frame, vendored so the print queue is one folder).

---

## Material

**PETG, not PLA.** This lives under display lights and on a rack. PLA creeps —
we already lost a DGX Spark shelf to exactly that, and it sagged over weeks, not
hours. PETG holds.

You said you have white filament for the whole print, so the colour split below
is optional; it is recorded because the CAD assumes the window panel is
translucent.

| Part | Filament |
|---|---|
| Everything else | Any PETG |

---

## Part list

Volumes are solid-model, measured from the meshes. **Your slicer is
authoritative for mass and time** — at 15–20 % infill with 3 walls expect
roughly 40–55 % of the solid-equivalent mass.

### Ours (`../cad/stl/`)

| Part | Qty | Bed footprint | Vol (cm³) | Notes |
|---|---|---|---|---|
| `pedestal_base` | 1 | 150 × 150 | 345.4 | ⚠ print **flipped** — see below |
| `wing_panel` | 2 | 90 × 145 | 44.7 ea | ⚠ no flat face — see below |
| `pedestal_cover` | 1 | 132 × 132 | 52.2 | |
| `pedestal_post` | 1 | 90 × 90 | 51.3 | 90×90 Qi/magnet plate; print **plate-down**, no supports |
| `panel_wing_pass_lower` | 2 | 87.4 × 55.5 | 9.4 ea | **SPLIT** — goes in before the servo |
| `panel_wing_pass_upper` | 2 | 87.4 × 45.2 | 7.9 ea | **SPLIT** — drops over the gear housing |
| `panel_ports` | 1 | 87.4 × 96.6 | 17.8 | slot-in |
| `panel_camera_lower` | 1 | 87.4 × 68.7 | 11.9 | **SPLIT** — goes in before the camera |
| `panel_camera_upper` | 1 | 87.4 × 31.9 | 5.3 | **SPLIT** — drops over the lens |
| `wing_root_hub` | 2 | 26 × 26 × 42 | 15.3 ea | stepped profile — a uniform block is the OLD one |
| `camera_bracket` | 1 | 40 × 31.5 × 48 | 10.9 | lens relief **23.81** — a 20 mm relief is the old one |
| `servo_bracket` | 2 | 21.0 × 48.0 × 37.2 | 5.9 ea | **second one MIRRORED in X** |

### Frame (HC-Eleni, `../cad/stl/frame/`)

| Part | Qty | Footprint | Vol (cm³) |
|---|---|---|---|
| `obj_4_part 1.2` (shell) | 1 | 100 × 100 × 100 | 55.3 |
| `obj_1_part 2 floor 1` | 1 | 88 × 88 | 32.8 |
| `obj_2_part 2 floor 2` | 1 | 88 × 88 | 32.7 |
| `obj_3_part 2 floor 3` | 1 | 88 × 88 | 29.4 |
| `obj_5_part 3.2` | 1 | 100 × 100 | 22.0 |

**Totals:** ours 747.5 cm³ · frame 172.2 cm³ · **920 cm³ solid-equivalent**
(≈1.17 kg if printed 100 % solid). At normal settings a single 1 kg spool
covers the build with room to spare. The pedestal base alone is 38 % of it.

---

## Settings

Starting point, not gospel:

| Setting | Value | Why |
|---|---|---|
| Layer height | 0.2 mm | 0.12 for `wing_root_hub` — it is a keyed part |
| Walls | 3 | 4 on `wing_root_hub` (load path). Panels are 1.8 mm in the captured border — 2 walls, or the border prints oversize and will not enter the slot |
| Infill | 15–20 % | 30 % on `wing_root_hub`, 10 % on `pedestal_base` (it is huge and gets ballast anyway) |
| Supports | Only where noted below | |
| Bed adhesion | Brim on `wing_panel` and `pedestal_post` | Tall/thin footprints |

---

## Orientation — the three that matter

Most parts print in their natural STL orientation. These three do not.

### `pedestal_base` — print it UPSIDE DOWN ⚠

The ballast cavity runs from z = 0 to z = 16 and **opens downward**. Measured
cross-sections confirm it: ~10,500 mm² of material from z = 0.5 to 12, jumping
to 22,207 mm² at z = 16 where the cavity roof closes.

Printed as-modelled, that roof is a **110 mm unsupported bridge**. No slicer
will do that cleanly.

Flip it so the **top face is on the bed**:
- The solid 8 mm section prints first, then the cavity walls rise around an open
  void — zero bridging
- Bed contact goes from 10,583 mm² to **22,207 mm²**, so adhesion improves too
- The 20° socket bore now tunnels *upward* from the bed. Its steepest overhang is
  20° from vertical, well inside self-supporting range — **no support needed**
- The cover's retention lip ends up at the top of the print, which is fine

☐ Rotate 180° about X before slicing. Confirm in preview that the large square
face is on the bed and the socket opening is at the bed, not in the air.

### `wing_panel` — has no flat face ⚠

The blade is 4 mm thick (z −2 to +2). The root pad is 6 mm and **centred on the
blade**, so it stands 1 mm proud on *both* faces. Whichever way you lay it down,
the pad's 840 mm² touches the bed and 11,900 mm² of blade floats 1 mm above it.

Two options:

- **Raft (no CAD change).** Enable a raft. It lifts everything to a common plane
  and the 1 mm step becomes irrelevant. Costs some surface finish on the underside
- **Move the pad flush (CAD change).** Offsetting the root pad 1 mm so its outer
  face is coplanar with one blade face gives a genuinely flat 11,900 mm² bed
  contact and a better visible surface. It shifts the wing plane 1 mm relative to
  the hinge — irrelevant on a display model, and correctable in `wing_root_hub`

Default to the raft unless you want the nicer finish. See [`OPEN-ITEMS.md`](OPEN-ITEMS.md).

### Panels — check the coupon first

☐ Print `stl/coupons/fit_coupon_*.stl` (1.6 / 1.7 / 1.8 / 1.9 mm) and set
`PANEL_T` in `gen_panels.py` from the result **before** printing any real panel.
Notch count = thickness. The panel must slide into a 2.00 mm slot.

☐ Print flat, **ribs UP**, no supports. The outboard face is the bed face and is
the surface people see.

`panel_window` no longer exists. The APA102 strip shines through the cap's
90 × 90 top aperture instead — all four side faces are assigned.

---

## Batching

Panels batch well — all four are 87.4 × 96.6 flat plates. The two
`panel_wing_pass` copies must be identical, so print them **together in one
job**; printing them in separate sessions is how you end up with two slightly
different parts and wings that sit crooked.

Same for the two `wing_panel` and the two `servo_bracket`.

---

## After printing

☐ Deburr the M3 holes — PETG leaves a lip on the first layer that stops screws
sitting flush

☐ Test-fit the deck stack dry on the M3 rods **before** installing any inserts
(§02). If the decks bind, it is far easier to fix now

☐ Check `wing_root_hub` against a real MG90S horn. The keyed socket assumes
`SHAFT_OFFSET = 5.9 mm`, which is an **assumed** value — see
[`OPEN-ITEMS.md`](OPEN-ITEMS.md) item 4. If it does not key cleanly, stop and
measure the servo before printing the second one

---

Next: [02 — Frame & decks](02-frame-and-decks.md)
