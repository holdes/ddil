# Open items

Everything in the build that is **not verified**, with the specific check needed.
Nothing here is speculative worry — each one was found by measuring a mesh or
reading a datasheet, and each one has a concrete resolution.

Ordered by how much it costs you to hit it unprepared.

---

## 1. ~~Frame posts have no panel fixing holes~~ — WITHDRAWN, was never real

**Status: closed. The premise was wrong.**

The frame is not a shell with bolt-on panels. It is four L-section corner posts
carrying **eight 2 mm slots**, and the panels slide into them. There are no panel
fasteners, and the frame must **never be drilled** — a bore into a post cuts into
a slot that is already there.

How the error survived this long: a ray fired inward at x = 45.02 reported 10 mm
of solid material. That reading was accurate. x = 45.02 falls in the one gap
between the Y-face slot (x 40–44) and the X-face slot (x 46.08–48.09), so the ray
threaded between both. A single sample point was treated as a characterisation of
the section, and every downstream part inherited the bolt-on model from it.

The collision described in (b) was real *given* the bolt-on model, and the
hole-stagger fix worked — but both solved a problem that does not exist.

Measured slot geometry now driving `gen_panels.py`:

| | |
|---|---|
| Slot width | 2.00 – 2.02 mm, all 8 slots |
| Depth into each post | 4.00 mm |
| Centreline | ±47.05 mm |
| Floor | z = −47.00, flat across the face |
| Cap rail | 2.02 mm, matching, captures the panel top |

**Remaining check:** print `stl/coupons/fit_coupon_*.stl` and set `PANEL_T`.
That is a tolerance question, not a design one.
## 2. Post mount plate vs. base plate perforations

**Blocks:** printing `pedestal_post`. **Severity: hard blocker for that part.**

The post's mount plate carries **2× M3 at 60 mm spacing** (sheet 4, POST — TOP
VIEW). Those must land on solid material in the frame's 5 mm base plate, which
has **92 perforations**. If either lands on a hole, the satellite has no
attachment to its stand.

**Check:** intersect the two hole positions against the base plate mesh.
Mechanical, quick, and I can run it.

**Do not print the post until this is answered.**

---

## 3. Qwiic pHAT may block the GPIO header

**Blocks:** §04, the APA102 LEDs. **Severity: blocks one wow factor.**

The APA102 strip needs SPI0 — GPIO10 (MOSI) and GPIO11 (SCLK). Unconfirmed
whether SparkFun DEV-15945 leaves the header reachable or covers it.

**Check:** physical inspection when it arrives.

**If blocked:** stacking header under the pHAT, or move LEDs to a PCA9685
channel — which costs per-pixel colour, a real downgrade for an IDS display.

---

## 4. `SHAFT_OFFSET = 5.9 mm` is assumed

**Blocks:** `wing_root_hub` fit. **Severity: one small reprint.**

The MG90S output shaft is not centred on the body. 5.9 mm is an assumption, not
a measurement.

**Check:** calipers on a real MG90S. Print **one** hub and test-fit before
printing the second.

---

## 5. `LENS_Y` assumes a 40 mm payload deck height

**Blocks:** `panel_camera` lens bore alignment. **Severity: one panel reprint.**

`LENS_Y = 40.0 + 25.0 − 45.0 = +20.0` in panel coordinates. The 25.0 is measured
(the camera bracket's lens axis above its deck); the **40.0 is assumed** — it
takes the payload deck's top face as 40 mm above the internal floor.

**Check:** measure actual deck spacing once the stack is built (§02), then
re-derive. If the bore is off, the lens will not centre in it.

---

## 6. Wing panel has no flat print face

**Blocks:** nothing — workaround exists. **Severity: cosmetic / convenience.**

The blade is 4 mm (z −2 to +2); the root pad is 6 mm and **centred**, so it
stands 1 mm proud on both faces. Either orientation puts 840 mm² of pad on the
bed with 11,900 mm² of blade floating 1 mm above.

**Resolution:** print with a raft (no CAD change), or offset the root pad 1 mm to
sit flush with one blade face (better surface, shifts the wing plane 1 mm
relative to the hinge — irrelevant here).

---

## 7. Flight agent not written

**Blocks:** §06, all live telemetry. **Severity: real work, not a risk.**

Specified in §06. Reads I²C sensors, frames CCSDS reusing `~/pisat_sim.py`'s
framing, emits on UDP 5012, listens on 5013.

Not started. This is the largest remaining piece of work in the project.

---

## 8. socat bridge cFS ↔ COSMOS

**Blocks:** nothing essential. **Severity: enrichment.**

CI_LAB 1234 / TO_LAB 2234 → 5012/5013, to light up the 12 stock cFS targets
alongside the simulated ones. Makes the ground display substantially richer.

---

## 9. SPARTA SOC needs Elasticsearch 9.4+

**Blocks:** the detection half of the security story. **Severity: version gate.**

`Villegas12/space_cyber_security` requires **ES 9.4+**. The kit is on **9.3.1**.

**Resolution:** upgrade the kit, or run the SPARTA content elsewhere. Decide
before building a demo narrative that depends on it.

---

## Resolved (kept for the record)

| Item | Resolution |
|---|---|
| Satellite interpenetrating the post by 20.4 mm | Body tilt sign was −20° against a +20° post axis. Fixed; joint now −0.003 mm. `verify_joint()` checks it every run |
| Post height 68.0 vs 67.0 | Was derived by addition; now measured from the mesh |
| Pedestal base cavity unprintable | Print the base upside down — no bridging, better adhesion, socket bore self-supporting |
| Ballast cover interpenetrating the cavity | Mounts on the **underside**, not into the cavity |
| Tipping risk on the pedestal | Post shortened 75 → 45 mm. CoM measured at y = −7.4 mm against a ±75 mm footprint — stable with zero ballast |
| Counterfeit microSD destroyed a build | Replaced with a genuine card, verified with `f3` |
