# 07 — Checkout

Bring-up order, acceptance tests, and the pre-demo routine.

The principle: **add one thing at a time and confirm it before adding the next.**
Every hard-to-diagnose failure in this build so far came from stacking two
changes and not knowing which one broke it.

---

## Bring-up order

Do not skip ahead. Each stage assumes the previous one passed.

| # | Stage | Pass criterion |
|---|---|---|
| 1 | BEC output, disconnected | Multimeter reads **5.0 V** |
| 2 | Pi alone | Boots, reachable over WiFi |
| 3 | I²C chain | `i2cdetect -y 1` shows 0x76/77, 0x6A/6B, 0x40 |
| 4 | Camera | Enumerates, captures a frame |
| 5 | Servos, unloaded | Both centre, then sweep to limits |
| 6 | Servos, wings fitted | 20 clean feather cycles, **one servo at a time** |
| 7 | LEDs | All pixels addressable, colour correct |
| 8 | Flight agent | Emits on 5012 |
| 9 | COSMOS | Decodes packets, screens populate |
| 10 | Uplink | Command on 5013 moves the wings |
| 11 | Zeek → Elastic | Traffic visible, detections fire |
| 12 | Alert → LED | End-to-end, unassisted |

---

## Acceptance tests

Run these once the build is complete. They are the ones that catch real problems.

### T1 — Sensor liveness

☐ Breathe on the BME280. Humidity should move within a second or two and settle
back

☐ Tilt the body. Gyro and accel should respond immediately and return to rest

*This is also the audience interaction. If it feels laggy to you it will feel
broken to them.*

### T2 — Feathering under load

☐ Feather 20 times with the wings fitted and the body on the pedestal, moving
**one servo at a time**

☐ Listen for gear chatter. Watch for the pedestal rocking

☐ Confirm both wings reach the same angle each time

*Failure here after passing the bench test in §05 means the wings are heavier
than the servos like, or the hub is slipping on the horn.*

### T3 — Brownout

☐ ⚠ **DO NOT slew both wings simultaneously.** 2x MG90S at stall is ~1.4 A on
top of the Pi's 0.35 A against a 1.8 A supply - it browns out the Pi. Instead
verify the firmware REFUSES a simultaneous command, then measure ONE servo
stalling while the LEDs are at full brightness and
the camera is streaming

☐ Confirm the Pi does not reboot

*This is the worst-case current draw and the exact combination a demo produces.
If it reboots, the BEC is undersized or the rails are not actually separate.*

### T4 — Cold start

☐ Power the whole thing from cold with no keyboard, no SSH

☐ Confirm it reaches a working, telemetry-emitting state on its own within a
couple of minutes

*You will be plugging this in on a show floor. It has to come up by itself.*

### T5 — Link loss

☐ Pull the groundstation off the network mid-demo

☐ Confirm the satellite keeps running and resumes cleanly when it returns

*Nothing on the satellite should depend on the ground being there.*

### T6 — The whole story

☐ Run the full narrative once, end to end, out loud, in front of someone

*Timing problems and awkward gaps only show up when you narrate it.*

---

## Pre-demo routine

Every time, before the audience arrives:

☐ Check free RAM on the groundstation Pi — COSMOS wants ~4.7 GB and Chromium
takes its share. This is the most likely day-of failure

☐ `cd ~/cosmos-project && docker compose start` if COSMOS was stopped

☐ Confirm the aero kiosk is up: `systemctl --user status aero-kiosk`

☐ Feather one wing and return it — proves servos, uplink and power in one action

☐ Trigger one IDS alert and confirm the LEDs respond

☐ Stow the wings before anyone gets near the table

---

## Known failure modes

Collected from this build. Symptom first, because that is how you meet them.

| Symptom | Likely cause |
|---|---|
| **Pi reboots when wings move** | Servos on the logic rail. Separate the BEC rail (§04) |
| **Camera not detected** | 15-pin cable instead of the 22-pin Pi Zero cable, or contacts reversed |
| **A sensor missing from `i2cdetect`** | Cable not fully seated. Almost never a dead board |
| **LEDs flicker or show garbage** | No common ground, or 3.3 V logic without the level shifter |
| **COSMOS shows nothing** | Endianness. Primary header BIG, bodies LITTLE (§06) |
| **Commands arrive but attribution is wrong** | NAT in the path rewriting `src_ip`. Route, do not NAT |
| **Wings asymmetric** | Horn fitted to an uncentred servo. Recentre and refit (§05) |
| **Screen blank / cycling** | Kiosk service crash-looping. `journalctl --user -u aero-kiosk` |
| **Touchscreen dead** | The panel's USB touch cable is not connected. Check `lsusb` shows more than root hubs |
| **microSD dies under load** | Counterfeit card. We lost a build to one that reported 2 TB. Verify with `f3` |

---

## Spares to carry

Cheap insurance for a show floor:

- Spare **microSD**, flashed and tested
- Spare **MG90S** — the most likely mechanical failure
- Spare **JST-SH cables** in two lengths
- The **22-pin CSI cable** — irreplaceable on the day
- Small hex drivers and flush cutters
- A printed copy of the topology diagram

---

## Done

- [ ] All 12 bring-up stages pass
- [ ] T1–T6 pass
- [ ] Pre-demo routine rehearsed
- [ ] Spares packed
- [ ] Stowed envelope fits the case

Open items that never got closed: [`OPEN-ITEMS.md`](OPEN-ITEMS.md).
