#!/usr/bin/env bash
# kiosk-launch.sh
#
# Run as the X session entry point on the Framework Desktop. Adds a custom
# 1280x400 modeline to the HDMI output that drives the DeskPi touchscreen
# (the panel claims FHD over EDID but its physical pixels are 1280x400),
# disables screen blanking, hides the cursor, and launches Chromium in
# kiosk mode pointed at the local static server.
#
# Wired up by `ddil-kiosk.service` (see this directory).

set -euo pipefail

URL="${KIOSK_URL:-http://localhost:3100/}"
PREFERRED_W="${KIOSK_W:-1280}"
PREFERRED_H="${KIOSK_H:-400}"
MODE_NAME="${PREFERRED_W}x${PREFERRED_H}_60.00"
# cvt 1280 400 60  →  pixel clock 38.50 MHz · standard CVT timings.
# Only used as a fallback if the panel doesn't already advertise the desired
# mode — once amdgpu reads a real EDID, the panel advertises 1280x400 itself
# and we skip the custom modeline to avoid pixel-clock mismatches.
MODELINE=(38.50 1280 1304 1432 1616 400 403 413 423 -hsync +vsync)

# 1) Pick the connected output the touchscreen is on. If you have multiple
#    outputs, override with KIOSK_OUTPUT=<name> in the systemd unit.
OUTPUT="${KIOSK_OUTPUT:-}"
if [[ -z "$OUTPUT" ]]; then
    OUTPUT=$(xrandr | awk '/ connected/ {print $1; exit}')
fi
if [[ -z "$OUTPUT" ]]; then
    echo "kiosk-launch: no connected output found" >&2
    xrandr >&2
    exit 1
fi
echo "kiosk-launch: using output $OUTPUT"

# 2) If the panel already advertises the desired mode (real EDID), use it
#    directly. Otherwise inject the CVT modeline.
if xrandr | awk -v out="$OUTPUT" '$1==out{found=1; next} found && /[0-9]+x[0-9]+/{print $1}' \
   | grep -qx "${PREFERRED_W}x${PREFERRED_H}"; then
    echo "kiosk-launch: panel advertises ${PREFERRED_W}x${PREFERRED_H} natively"
    NATIVE_MODE_NAME="${PREFERRED_W}x${PREFERRED_H}"
else
    echo "kiosk-launch: injecting CVT modeline $MODE_NAME"
    xrandr --newmode "$MODE_NAME" "${MODELINE[@]}" 2>/dev/null || true
    xrandr --addmode "$OUTPUT" "$MODE_NAME" 2>/dev/null || true
    NATIVE_MODE_NAME="$MODE_NAME"
fi

# 3) Cycle the output before applying the mode so the panel re-handshakes.
#    On some panels (DeskPi RTK chip) the first mode-set after X start lands
#    on a black frame — toggling forces a fresh HPD/EDID exchange.
xrandr --output "$OUTPUT" --off || true
sleep 1
if ! xrandr --output "$OUTPUT" --mode "$NATIVE_MODE_NAME" 2>&1; then
    echo "kiosk-launch: $NATIVE_MODE_NAME rejected, falling back to preferred" >&2
    xrandr --output "$OUTPUT" --auto || true
fi

# 4) Map touch input to the kiosk output (so taps land on the right pixel
#    even if you also have a desktop monitor). Skips silently if no touch.
TOUCH_ID=$(xinput list --id-only 2>/dev/null | while read id; do
    if xinput list-props "$id" 2>/dev/null | grep -qi 'libinput tapping enabled\|abs x\|abs y'; then
        if xinput list "$id" 2>/dev/null | grep -qi 'touch'; then
            echo "$id"; break
        fi
    fi
done | head -1) || true
if [[ -n "${TOUCH_ID:-}" ]]; then
    xinput map-to-output "$TOUCH_ID" "$OUTPUT" || true
fi

# 5) Kill power management so the kiosk never sleeps (best-effort)
xset s off || true
xset s noblank || true
xset -dpms || true

# 6) Hide the cursor unless a USB keyboard moves it (handy for debugging)
if command -v unclutter >/dev/null 2>&1; then
    unclutter -idle 0.5 -root &
fi

# 7) Wait for the static server to be reachable before opening Chromium —
#    otherwise the user sees a "site can't be reached" page on cold boot.
for _ in $(seq 1 60); do
    if curl -fsS --max-time 1 "$URL" >/dev/null 2>&1; then break; fi
    sleep 0.5
done

# 8) Launch Chromium. Profile dir keeps state out of $HOME for clean replays.
PROFILE_DIR="${KIOSK_PROFILE:-$HOME/.cache/ddil-kiosk-chromium}"
mkdir -p "$PROFILE_DIR"

CHROMIUM=$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)
if [[ -z "$CHROMIUM" ]]; then
    echo "kiosk-launch: no chromium/chrome in PATH" >&2
    exit 1
fi

exec "$CHROMIUM" \
    --kiosk \
    --noerrdialogs --disable-infobars --no-first-run --no-default-browser-check \
    --disable-pinch --overscroll-history-navigation=0 \
    --disable-features=TranslateUI \
    --check-for-update-interval=31536000 \
    --user-data-dir="$PROFILE_DIR" \
    --window-size=1280,400 --window-position=0,0 \
    --start-fullscreen \
    --app="$URL"
