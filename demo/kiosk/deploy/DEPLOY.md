# Deploying the kiosk to the Framework Desktop

End-to-end recipe for getting the kiosk on the 1280×400 DeskPi touchscreen,
booting straight into Chromium with no desktop environment, no login screen,
no cursor, no taskbar — exactly the way you want a demo appliance to behave.

## What this deploys

Two systemd units running as a dedicated `ddil` user:

| Unit | What it does |
|---|---|
| `ddil-kiosk-server.service` | Serves the built kiosk app from `/opt/ddil-kiosk/dist` on `127.0.0.1:3100` using Python's stdlib http.server (no extra deps). |
| `ddil-kiosk.service` | Owns `tty7`, runs `startx` with our launcher: registers a 1280×400 xrandr modeline, maps touch input, kills screen blanking, hides cursor, launches Chromium in `--kiosk --app=...` mode. |

The 1280×400 modeline is the important bit — your panel ships with a fake
"FHD" EDID that fooled macOS into driving it at 1920×1080. On Linux we
ignore the EDID and force-feed the real native timings.

## Prerequisites

- Ubuntu Server 24.04 on the Framework Desktop (no GUI installed)
- The DeskPi 7.84″ touchscreen connected over HDMI
- SSH access (so you can copy this directory + run the installer)
- Node 20+ on the Framework (for the one-time `npm run build`)

## Steps

```bash
# 1. Get the repo onto the Framework (any path is fine; example uses ~/ddil)
git clone <repo> ~/ddil
cd ~/ddil/demo/kiosk

# 2. Install dependencies + build the static site
npm install
npm run build              # produces ./dist

# 3. Run the one-shot installer (copies files, installs systemd units, starts)
sudo ./deploy/install.sh
```

That's it. The Framework should switch to tty7 within a few seconds and
Chromium should appear on the touchscreen rendering the kiosk at native
1280×400 with zero letterboxing.

## Updating the kiosk

After a `git pull` (or just an edit + rebuild), re-run the installer:

```bash
cd ~/ddil/demo/kiosk
npm run build
sudo ./deploy/install.sh   # idempotent — re-syncs dist/, restarts the kiosk
```

Or for a code-only restart without rebuild:

```bash
sudo systemctl restart ddil-kiosk
```

## Operating it

```bash
# live logs from the kiosk session (xrandr output, Chromium errors, etc.)
journalctl -u ddil-kiosk -f

# logs from the static server
journalctl -u ddil-kiosk-server -f

# stop everything
sudo systemctl stop ddil-kiosk ddil-kiosk-server

# get back a normal text console without uninstalling
sudo systemctl stop ddil-kiosk
# then Ctrl-Alt-F1 to switch tty
```

## Troubleshooting

### Screen stays black

The xrandr modeline got rejected by the panel's controller chip.
SSH in, switch to the kiosk user's X env, and check:

```bash
sudo systemctl stop ddil-kiosk
sudo -u ddil bash -c 'startx /opt/ddil-kiosk/deploy/kiosk-launch.sh -- :0 vt7'
```

You'll see the actual error in the terminal. Common fixes:
- Wrong output name. List outputs with `xrandr` once X is up. Override the
  detected output by adding `Environment=KIOSK_OUTPUT=HDMI-A-1` (or whatever
  the real name is) to `/etc/systemd/system/ddil-kiosk.service` and
  `systemctl daemon-reload && systemctl restart ddil-kiosk`.
- Modeline rejected. The launcher falls back to the panel's preferred mode
  automatically — you'll get letterboxing but at least visible content.
  See "Tuning the modeline" below.

### Touch input is offset / lands on wrong pixel

The launcher tries `xinput map-to-output` automatically but it can pick the
wrong device on systems with multiple touch inputs. Find the touch device:

```bash
sudo -u ddil DISPLAY=:0 xinput list
```

…then add a permanent xorg conf at `/etc/X11/xorg.conf.d/99-touch.conf`:

```
Section "InputClass"
    Identifier "DDIL touch"
    MatchProduct "<the-product-name-from-xinput-list>"
    Option "TransformationMatrix" "1 0 0 0 1 0 0 0 1"
EndSection
```

If the touch is rotated/inverted, run `xinput_calibrator` once and paste its
generated matrix in.

### Tuning the modeline

The default is generated from `cvt 1280 400 60`:

```
Modeline "1280x400_60.00"  38.50  1280 1304 1432 1616  400 403 413 423  -hsync +vsync
```

If the panel is unhappy with that, try:
- A lower refresh rate: `cvt 1280 400 50` and update the launcher.
- Reduced blanking: `cvt -r 1280 400 60`.
- The panel's own timings if you have a datasheet (often the ideal answer).

Edit `MODELINE` in `deploy/kiosk-launch.sh` and reinstall.

### "Chromium won't start as root"

The service runs as the `ddil` user, not root, so this shouldn't happen.
If you see it, you've probably edited the unit's `User=` line — set it back
to `User=ddil`.

## File map

```
demo/kiosk/deploy/
├── DEPLOY.md                       (you are here)
├── install.sh                      one-shot installer (run as root on the Framework)
├── kiosk-launch.sh                 X session entry point (xrandr + chromium)
├── ddil-kiosk-server.service       static server systemd unit
└── ddil-kiosk.service              X kiosk session systemd unit
```
