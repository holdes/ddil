# 03 — Panels & payload

Closes the four open faces and mounts the camera.

---

## DO NOT DRILL THE FRAME

**Previous versions of this guide told you to drill 16 × 4.1 mm holes into the
corner posts. That instruction was wrong and has been removed. Do not follow any
printed or exported copy that still contains it.**

The frame is not a shell with bolt-on panels. It is four L-section corner posts
carrying **eight 2 mm slots**, and the panels slide into them. There are no panel
fasteners at all. Drilling a post would cut into a slot that is already there.

How the earlier error happened, so you can distrust the right things: a ray was
fired inward at x = 45.02 and reported 10 mm of solid material. That reading was
accurate — x = 45.02 happens to fall in the one gap between the Y-face slot
(x 40–44) and the X-face slot (x 46.08–48.09). A single sample point was treated
as a characterisation of the section. Everything downstream inherited it.

---

## How the panels are actually retained

Measured from `obj_4_part 1.2.stl` and `obj_5_part 3.2.stl`:

| Feature | Measured |
|---|---|
| Slot width | 2.00 – 2.02 mm (all 8 slots, both parts) |
| Slot depth into each post | 4.00 mm (x 40.00 → 44.00) |
| Slot centreline | ±47.05 mm from frame centre |
| Slot floor | z = −47.00, flat across the full face |
| Cap rail slot | 2.02 mm, spans x −40…+40, 2.03 mm deep |

The panel is captured on **all four edges**: 3.7 mm into the post slots at the
sides, 1.9 mm into the base-plate channel at the bottom, 2.0 mm into the cap rail
at the top. Nothing screws to anything.

Because the panels seat 1.95 mm inside the ±50 envelope, the assembled cube stays
**100 mm across — a true 1U.** The old bolt-on panels would have made it 105 mm.

---

## Panel inventory

**Two of the four faces are SPLIT into an upper and a lower half.** That is not a
convenience — a whole panel physically cannot be fitted. Panels drop down into
the frame slots, and the servo shaft protrudes 8.4 mm past the panel's outer face
at a fixed height, so a closed bore would have to pass *through* the shaft on its
way down. The lens sticks out 17–35 mm. Nor can the hardware go in afterwards:
the servo's flange screws sit 13.4 and 18.8 mm off the shaft axis, outside a
⌀22 bore, so no driver reaches them through the hole.

All pieces are **87.4 mm wide**, 1.8 mm in the captured border, ribbed to 4.0 mm
across the free centre.

| Piece | Qty | Face | cm³ | Features |
|---|---|---|---|---|
| `panel_camera_lower` | 1 | **−Y** | 10.78 | lower half of the ⌀30.0 lens bore |
| `panel_camera_upper` | 1 | **−Y** | 6.32 | upper half, drops over the lens |
| `panel_wing_pass_lower` | 2 | **±X** | 8.50 ea | lower half of the ⌀22.0 shaft bore |
| `panel_wing_pass_upper` | 2 | **±X** | 8.99 ea | upper half, drops over the gear housing |
| `panel_ports` | 1 | **+Y** | 17.82 | USB-C slot, 2 × ⌀8.0 grommets — one piece |

**Bore centres**, both derived from deck_b's top face at frame z −13.10:

| | bore | frame Z | panel-local Y |
|---|---|---|---|
| servo shaft | ⌀22 | **−1.35** | −2.85 |
| camera lens | **⌀30** | **+11.90** | +10.40 |

Each pair splits **through the bore centre**, so the throat is the full bore
diameter. Splitting lower — at the bore's bottom tangent, say — does not work: a
circle tangent to a line meets it at a single point, so the throat has zero width
and nothing can enter.

The seam carries **two locating tabs at x ±24**, 10 × 4 × 2.0 mm, into pockets
with 0.25 mm clearance. They sit on the inner face in the rib zone, so neither
half needs supports.

The ribs go on the **inboard** face. The outboard face is flat and is the bed
face — that is the surface people see.

☐ Print flat, ribs up, no supports
☐ Print **one lower half of each** and test the seam before committing the rest

---

## Assembly order

⚠ **The lower halves go in BEFORE the servo and the camera.** Their notches open
upward, so they cannot pass hardware that is already fitted. Get this wrong and
you are taking the deck stack back out.

Per wing face:

☐ 1. `servo_bracket` onto Deck B — pins, then 2 × M3 through the slots
☐ 2. `panel_wing_pass_lower` drops into the side and bottom slots
☐ 3. Servo pushes in **from outboard**, through the still-open top of the face
☐ 4. Two self-tappers through the flange into the ⌀2.10 pilots
☐ 5. `panel_wing_pass_upper` drops down over the gear housing
☐ 6. Horn, hub, wing

Camera face is the same shape: bracket → lower half → camera and lens →
upper half.

☐ Seat the cap last, rails DOWN, so the rails receive the panel top edges
☐ Fix the cap with **4 × M3 into the ⌀3.00 bores at (±47, ±47)**

The ⌀3.00 bores thread M3 directly — confirmed on the printed part. Do not force
an M4; it will split the post.

Panels are held by the **standoff chain and the frame slots**. There are no
inserts and nothing bolts through a panel.

---

## Top aperture

The cap is a ring with a **90 × 90 open aperture**. The cube is open at the top by
design. This is where the APA102 strip goes — it was previously homeless because
all four side faces are assigned.

---

## Camera

The Arducam UC-261 mounts to `camera_bracket`, which bolts to **Deck B**. With
Deck B's top face at frame z = **−13.10** and the bracket placing the lens axis
**25.00 mm** above its deck (foot 4.0 + PCB gap 3.0 + half the 36 mm PCB), the
lens axis lands at **z = +11.90** — which is where `panel_camera`'s bore is cut
and where the two halves split.

From the frame's outer bottom face, the lens barrel's lower edge is at
**50.40 mm**; from the internal floor at −45.10 it is **45.50 mm**.

☐ Mount the camera to the bracket on M2.5 standoffs
☐ Bolt the bracket to Deck B — M3 through the slots at x ±16, screws from above
☐ Check the lens barrel clears the panel bore before committing the CSI cable

⚠ **The lens relief in the bracket is 23.81 mm (15/16").** It was 20.0 and the
M12 lens holder's own screws are **20.04 mm apart** — 0.04 mm too far apart to
pass, before counting their heads. If your bracket has a 20 mm square relief it
is the old one and the lens holder will not fit through it.

That leaves **1.10 mm** of material around each camera mount hole. Do not
overtighten those two screws.
