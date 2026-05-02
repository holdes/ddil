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
MODE_NAME="1280x400_60.00"
# cvt 1280 400 60  →  pixel clock 38.50 MHz · standard CVT timings
MODELINE=(38.50 1280 1304 1432 1616 400 403 413 423 -hsync +vsync)

# 1) Pick the HDMI output the touchscreen is on. If you have multiple HDMI
#    outputs, override with KIOSK_OUTPUT=HDMI-2 in the systemd unit.
OUTPUT="${KIOSK_OUTPUT:-}"
if [[ -z "$OUTPUT" ]]; then
    OUTPUT=$(xrandr | awk '/ connected/ && /^HDMI/ {print $1; exit}')
fi
if [[ -z "$OUTPUT" ]]; then
    echo "kiosk-launch: no connected HDMI output found" >&2
    xrandr >&2
    exit 1
fi
echo "kiosk-launch: using output $OUTPUT"

# 2) Register the modeline (idempotent — newmode fails harmlessly if it exists)
xrandr --newmode "$MODE_NAME" "${MODELINE[@]}" 2>/dev/null || true
xrandr --addmode "$OUTPUT" "$MODE_NAME" 2>/dev/null || true

# 3) Apply it. If the panel rejects the modeline you'll see a blank screen
#    or a "configure crtc" error — fall back to the panel's preferred mode.
if ! xrandr --output "$OUTPUT" --mode "$MODE_NAME"; then
    echo "kiosk-launch: 1280x400 rejected, falling back to preferred mode" >&2
    xrandr --output "$OUTPUT" --auto
fi

# 4) Map touch input to the kiosk output (so taps land on the right pixel
#    even if you also have a desktop monitor). Skips silently if no touch.
TOUCH_ID=$(xinput list --id-only 2>/dev/null | while read id; do
    if xinput list-props "$id" 2>/dev/null | grep -qi 'libinput tapping enabled\|abs x\|abs y'; then
        if xinput list "$id" 2>/dev/null | grep -qi 'touch'; then
            echo "$id"; break
        fi
    fi
done | head -1)
if [[ -n "$TOUCH_ID" ]]; then
    xinput map-to-output "$TOUCH_ID" "$OUTPUT" || true
fi

# 5) Kill power management so the kiosk never sleeps
xset s off
xset s noblank
xset -dpms

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
