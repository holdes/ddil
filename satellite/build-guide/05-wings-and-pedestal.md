# 05 — Wings & pedestal

Wow factor 1 (commandable wing motion) and the display stand.

Drawings: sheet 2 (mechanism), sheet 3 (wing), sheet 4 (pedestal), sheet 5
(envelope).

> **Rewritten 1 Aug 2026.** Everything before this described wing **deployment**
> and the parts `servo_mount` and `panel_wing_mount`. All three were replaced by
> **feathering** and are gone. If you have a printed `servo_mount` or
> `panel_wing_mount`, bin them.

---

## The mechanism — FEATHERING, not deployment

```
deck_b
  └── servo_bracket        2× M3 into the deck, on 2 locating pins
        └── MG90S servo    body VERTICAL, shaft horizontal and outboard
              └── horn     double-ended arm, 37 mm
                    └── wing_root_hub    bolted to the horn
                          └── wing_panel  plugs in, one M3 cross-bolt
```

`panel_wing_pass` is the side panel the shaft passes through — a ⌀22 bore, no
structure. The servo carries nothing through the panel.

**Wings rotate about their own long axis.** They do not swing out. Deployment
was abandoned because a 130 mm wing cannot stow against a 100 mm face and the
hinge landed on a corner post. Feathering also puts the wing's mass **on** the
rotation axis, so the servo holds almost no static torque, and it is repeatable
every demo instead of a one-shot needing manual re-stow.

**The span does not change when the wings move.** 428.7 mm, feathered or flat.
That is your case dimension — see the envelope section.

**MG90S, metal gear. Not SG90.** Plastic gears strip.

---

## Servo geometry — measured, not assumed

Everything below comes from the vendor solid `MG90S.3MF` and the horn STLs,
loaded and measured in code by `cad/mg90s.py` and `cad/servo_horn.py`.

| | |
|---|---|
| body | 23.0 × 12.2 × 18.0 |
| flange | 33.0 wide × 2.5 thick, **hole pitch 26.82** |
| collar above the flange | 23.0 × 12.2 × **1.9** |
| gear housing | ⌀14.99 × 6.0 |
| **shaft offset from the body centre** | **5.42** |
| horn arm | 2.50 thick × 7.00 wide × 37.0 long |
| horn boss | ⌀6.90, 2.82 proud, **facing the servo** |
| horn holes | ⌀1.79 at 6.0 / 8.5 / 11.0 / 13.5 / 16.0 off centre |

> The shaft being well off the body centre is the single most important number
> here — it sets the shaft height and therefore the panel bore. An earlier
> version of this guide carried an assumed **5.9**, which was close. It was then
> "corrected" to 0.65 from a dimension callout on a vendor marketing photo,
> which was wrong and cost a print. **Vendor photo callouts are not drawings.**
> The solid disagreed with the photo on hole pitch, flange width and shaft
> offset, and the solid was right on all three.

---

## Servo installation

☐ **Fit the bracket to `deck_b` first**, before the servo. Two ⌀4 pins locate it;
two M3 through the slotted holes clamp it. The pins are 0.18 mm/side — if the
bracket will not seat by hand, ream its pin holes with a 4.5 mm bit rather than
forcing. A bracket sitting proud makes everything downstream look misaligned.

☐ **Insert the servo from the OUTBOARD side**, pushing inboard, before the side
panel goes on. The body passes through the window; the flange lands in the
counterbore on the outer face.

☐ ⚠ **It fits one way up only.** The two flange ears are not equidistant from the
shaft — the ear about **8 mm** from the shaft goes **DOWN**, the one about
**19 mm** goes **UP**. Correct: flange screws at 3.76 and 30.58 above the deck.
Upside down the flange hangs below the deck and simply will not sit.

☐ Two self-tappers through the flange into the ⌀2.10 pilots. These resist
pull-out only — the counterbore walls take the load.

☐ **Drop the lead into the 8 mm channel** under the body. A solid floor pad
crushed it on the first build; the pad is now two rails with a channel between.

---

## Horn and hub

☐ **Centre the servo in software before fitting the horn.** Drive it to mid
travel, then fit. A horn fitted to an uncentred servo gives asymmetric wing
travel and you find out only after assembly.

☐ Fit the **double-ended horn**, arm running **vertically**. The vertical spread
is what resists the wing drooping.

☐ Fit the horn's own centre retention screw. The hub has a ⌀4.0 bore through it
so you can reach that screw later without dismantling the wing.

☐ **Print ONE `wing_root_hub` and test-fit before printing the second.** The horn
interface has been verified by boolean against the vendor horn but has never been
physically fitted.

☐ Slide the hub onto the horn — the arm enters a 7.8 × 37.8 × 2.75 pocket in the
hub's inboard face. The boss stays on the servo side and never enters the hub.

☐ Four M2 self-tappers from the hub's outboard face at z ±13.5 and ±16.0, into
the horn's own ⌀1.79 holes. They are deliberately outside the hub's stepped-down
body so a driver can reach them.

---

## Wing assembly

☐ Plug `wing_panel`'s tongue into the hub. **15.0 mm of engagement**, 0.4 mm
clearance, bottoming 0.5 mm short of the socket floor.

☐ One **M3 cross-bolt, vertical**, at 7.0 mm in from the hub's outboard face.

> The cross-bolt was previously along the hub's Y while the wing's hole ran along
> X — perpendicular, and 4 mm apart. It could never have gone through both. Both
> parts are now checked against each other by boolean, not by matching comments.

☐ Route the servo lead through the deck pass-through. The panel bore is clearance
only — do not run the harness through it.

☐ Repeat, **mirroring the bracket** for the other side. The hub and wing are
identical both sides; only the bracket is handed.

☐ Sight along the body and check both wings sit at the same angle. A 2°
difference is very visible in photographs.

### Travel limits

☐ Establish the feathered and flat angles in software and **write them into the
flight agent's config**, not into your head.

☐ Set travel limits. The wing's chord is 90 mm against a 100 mm face, so at flat
its top edge sits **0.35 mm** below the cap plane. There is no room for overtravel.

☐ Cycle **20 times** on the bench, unloaded, before mounting the wings.

☐ ⚠ **Never slew both servos at once.** 2× MG90S at stall is ~1.4 A on top of the
Pi's 0.35 A, against a 1.8 A supply. A wing catching on a sleeve browns out the
Pi. Fit the 1000 µF bulk caps.

### Wing stiffness

☐ Print one wing and **flex it in your hand** before deciding whether you need
the 3 mm carbon rod. That beats any calculation, because it depends on your
infill and wall count.

---

## Pedestal

Three parts: base, post, cover. Drawing: sheet 4.

| Part | Measured |
|---|---|
| `pedestal_base` | 150 × 150 × 24, hollow ballast cavity |
| `pedestal_post` | **90 × 90** plate, **68.0** tall overall, 20° tilt, Qi + magnets |
| `pedestal_cover` | 132 × 132 × 3, 4× ⌀3.4 on a 126 pattern |

Overall height is **68.0** measured off the mesh (plate 6.0 + tube 45.0 + spigot
18.0, less the 1.0 of deliberate overlap at each joint). Trust the mesh, not the
generator constants.

### Pedestal open items

✅ **`pedestal_post` revised to 90 × 90 (1 Aug).** It now mates with
`dock_adapter`: same 90 × 90 footprint, magnets at (±32, ±32) matching to
0.010 mm, and a ⌀46 Qi transmitter pocket concentric to 0.008 mm. At 70 × 70 the
magnet positions fell outside the plate entirely.

⚠ **Magnet polarity must be OPPOSITE to the dock's**, or the satellite is pushed
off its own stand. Mark them as you press them in.

The two M3 satellite fixings are gone — the joint is magnetic, nothing screws the
satellite to the stand.

⚠ **`dock_adapter` still needs the Qi module's real dimensions.** Its coil pocket
is ⌀46 × 3.0 and the comment on the depth says "generous; module thickness not
yet measured". Measure the RX module when the pair arrives and confirm before
printing the adapter.

The old warning about 2 × M3 landing on the base plate's 92 perforations is
**void** — those fixings no longer exist. The satellite is held by magnets.

### Post length

Reduced **75 → 45 mm** during design. At 75 the centre of mass sat ~206 mm above
a 150 mm footprint with 360 mm of wing hanging off it — a tipping hazard on a
show floor where people lean on tables.

### Stability — measured

| Quantity | Value |
|---|---|
| Assembly CoM | **y = −7.4 mm** |
| Base footprint | ±75 mm |
| Margin | **67.6 mm**, with **zero ballast** |

It does not need ballast to stand. Ballast lowers the CoM and makes it feel solid
rather than hollow, which matters for something people will touch, but the
stability argument does not depend on it.

### Assembly

☐ Print the base **upside down** (§01) — the cavity opens downward and would
otherwise need a 110 mm bridge

☐ Load ballast. Steel shot, sand in a sealed bag, or lead-free weights. Avoid
loose material that can shift and rattle

☐ Snap `pedestal_cover` into the **underside**. ⚠ It goes underneath, not into
the cavity from above

☐ Insert the post spigot into the socket. Engagement depth **16 mm**

☐ Bolt the satellite's base plate to the post's mount plate

The satellite-to-mount-plate joint measures **−0.003 mm** along the post axis.
That measurement is deliberately axial, not in z: a bounding-box check on a
20°-tilted body is meaningless, and an earlier z-range check passed while the
parts interpenetrated by 20.4 mm. `render_assembly.py` prints the axial gap on
every run.

---

## Final envelope

| | Value | Note |
|---|---|---|
| **Span** | **428.7 mm** | **constant** — feathering does not change it |
| Height on the pedestal | ~186 mm | |
| Depth | ~178 mm | including the 20° lean |

⚠ **428.7 mm will not go into most cases.** Unlike the old deployment scheme,
there is no "stowed" span to fall back on — the wings rotate but do not fold. If
the case is short, the wings have to come off, which is exactly why the hub and
wing are a plug-and-bolt joint rather than one piece. **Measure your case before
Monday.**

---

## Before moving on

- [ ] Bracket seated on its pins without forcing
- [ ] Servo in the right way up — flange screws at 3.76 and 30.58
- [ ] Lead in the channel, not pinched
- [ ] Servos centred before horns fitted, limits written into config
- [ ] One hub printed and test-fitted before the second
- [ ] 20 feather cycles clean, one servo at a time
- [ ] Wings symmetric by eye
- [ ] Magnets pressed into post and dock in OPPOSING polarity
- [ ] Qi module measured before `dock_adapter` is printed
- [ ] Case measured against the 428.7 mm span

---

Next: [06 — Software & link](06-software-and-link.md)
