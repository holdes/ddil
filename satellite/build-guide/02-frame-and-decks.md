# 02 — Frame & decks

Builds the load-bearing skeleton: HC-Eleni shell, three decks on M3 rods.

Drawing: sheet 2 (`dims_sheet2_mechanism.svg`) for the payload tray.

---

## What the frame actually is

Worth stating plainly, because the product photos mislead and it changed the
whole panel design:

**The HC-Eleni "shell" is not a shell.** It is four corner posts with a
perforated base and top plate. Measured from the mesh:

| Feature | Measured |
|---|---|
| Overall | 100.01 × 100.01 × 100.0 |
| Corner posts | 10.0 × 10.0, centres at **±45.02** |
| Clear span per face | **80.04 mm — fully open** |
| Base plate | 5.0 mm thick, 92 perforations |
| Deck size | 88 × 88 |
| Deck stack pattern | **82 × 82** corner holes at ⌀3.0 |
| Cable pass-through | 20 × 20 |

The four faces are open. That is why the face panels in §03 exist — the closed
look you wanted comes from them, not from the frame.

---

## Deck assignment

Three decks, bottom to top. This split keeps the noisy power rail away from the
I²C chain and puts the camera where its lens can reach a panel.

| Deck | Height above internal floor | Carries |
|---|---|---|
| **Floor 1** | 1 mm | EPS — BEC / buck converter, power distribution |
| **Floor 2** | 31 mm | Avionics — Pi Zero 2 W, camera bracket |
| **Floor 3** | 61 mm | Payload — payload tray, sensor breakouts, LED strip |

> The camera bracket goes on **Floor 2, not Floor 3**. Its lens sits 25.0 mm
> above whatever deck it bolts to. From Floor 3 that would put the lens at the
> very top edge of the body, above the panel's bore. From Floor 2 it lands at
> ~+22 in body coordinates, which matches the camera panel's lens bore.
>
> ⚠ The bore height in `panel_camera` is derived from an **assumed** 40 mm
> payload-deck height. Confirm your actual deck spacing before you commit —
> [`OPEN-ITEMS.md`](OPEN-ITEMS.md) item 5.

---

## Steps

### Dry fit first

☐ Stand the four M3 rods in the base plate's 82 × 82 corner holes

☐ Slide all three decks down the rods, no fasteners

☐ Confirm each deck seats flat and slides freely. PETG shrinkage can tighten a
3.0 mm hole enough to bind — ream to 3.2 mm if so

☐ Check the 20 × 20 pass-through lines up on all three decks. This is the only
route for the wing servo harness and the LED strip; if it is obstructed you will
find out much later, with the body closed

**Do not install inserts until the dry fit passes.** A bound stack is easy to
fix now and miserable to fix once inserts are in.

### Heat-set inserts

The design uses **4.1 mm** holes for M3 brass inserts.

☐ Set the iron to **210–230 °C** for PETG. Hotter than that and the boss slumps
around the insert; cooler and it will not flow

☐ Put the insert on the tip, rest it in the hole, and let it **sink under its own
weight plus light pressure**. Do not push. If you are pushing, it is too cold

☐ Keep it square. An insert that goes in tilted will strip on first use — this is
what the insert tips are for

☐ Stop when the flange is **flush**. Sinking it proud leaves a raised collar that
stops the mating part seating

☐ Let it cool fully before threading anything into it

### Stack assembly

☐ Fit Floor 1, spacers, Floor 2, spacers, Floor 3 in order

☐ Snug the rod nuts — firm, not tight. You are clamping printed plastic, and
over-torquing bows the decks and pulls the stack out of square

☐ Check the stack is square with calipers: measure corner-to-corner both
diagonals across the top deck. They should match within ~0.5 mm

☐ Route a spare length of wire through the 20 × 20 pass-through now, from Floor 1
to Floor 3, and leave it there as a pull-string. You will want it in §04

### Payload tray

Sits on Floor 3. It has an M2.5 grid and zip-tie slots for breakouts with no
mounting holes.

☐ Mount the tray to Floor 3 on M2.5 nylon standoffs

☐ Leave it **loose** for now — you will want to lift it to reach the deck below
during the electronics fit

---

## Before moving on

- [ ] Stack dry-fits and slides freely
- [ ] All inserts flush and square
- [ ] Diagonals match within 0.5 mm
- [ ] Pass-through clear, pull-string in place
- [ ] Payload tray fitted but not torqued down

---

Next: [03 — Panels & payload](03-panels-and-payload.md)
