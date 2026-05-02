#!/usr/bin/env bash
# install.sh
#
# One-shot installer for the DDIL Kiosk on a fresh Ubuntu Server 24.04 box
# (Framework Desktop, no GUI). Run from this directory as root:
#
#     sudo ./install.sh
#
# Steps:
#   1. apt install: minimal X11 + chromium + xinput + unclutter + curl
#   2. create the `ddil` system user if it doesn't exist
#   3. copy /opt/ddil-kiosk/{deploy,dist} from this checkout
#   4. install the two systemd units, enable, start
#   5. allow `ddil` to run startx (Ubuntu locks startx to console users)
#
# Idempotent. Safe to re-run after a `git pull` + `npm run build`.

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "install.sh: must be run as root (sudo)" >&2
    exit 1
fi

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
KIOSK_DIR="$(dirname "$DEPLOY_DIR")"

if [[ ! -d "$KIOSK_DIR/dist" ]]; then
    echo "install.sh: $KIOSK_DIR/dist not found — run 'npm run build' in $KIOSK_DIR first" >&2
    exit 1
fi

echo ">>> 1/5 installing apt packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends \
    xserver-xorg xinit x11-xserver-utils xinput \
    chromium-browser unclutter curl python3

echo ">>> 2/5 creating ddil user (if needed)"
if ! id ddil >/dev/null 2>&1; then
    useradd --system --create-home --shell /bin/bash --groups video,input,tty ddil
fi

echo ">>> 3/5 syncing /opt/ddil-kiosk"
install -d -o ddil -g ddil /opt/ddil-kiosk
rsync -a --delete "$KIOSK_DIR/dist/"   /opt/ddil-kiosk/dist/
rsync -a --delete "$DEPLOY_DIR/"       /opt/ddil-kiosk/deploy/
chown -R ddil:ddil /opt/ddil-kiosk
chmod +x /opt/ddil-kiosk/deploy/kiosk-launch.sh

echo ">>> 4/5 allowing ddil to run startx (Xwrapper)"
# Ubuntu defaults Xwrapper.config to allowed_users=console which blocks
# startx from a systemd-spawned PAM session. Loosen to "anybody".
if ! grep -q '^allowed_users=anybody' /etc/X11/Xwrapper.config 2>/dev/null; then
    cat > /etc/X11/Xwrapper.config <<EOF
allowed_users=anybody
needs_root_rights=yes
EOF
fi

echo ">>> 5/5 installing systemd units"
install -m 644 "$DEPLOY_DIR/ddil-kiosk-server.service" /etc/systemd/system/
install -m 644 "$DEPLOY_DIR/ddil-kiosk.service"        /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ddil-kiosk-server.service
systemctl restart ddil-kiosk.service

cat <<EOF

✓ DDIL Kiosk installed.

  static server:  systemctl status ddil-kiosk-server
  X kiosk:        systemctl status ddil-kiosk
  logs:           journalctl -u ddil-kiosk -f
  restart:        sudo systemctl restart ddil-kiosk

  to update:      cd $KIOSK_DIR && npm run build && sudo $DEPLOY_DIR/install.sh

If the screen stays black, check:
  - HDMI is connected to the touchscreen output
  - The output name detected:  sudo -u ddil DISPLAY=:0 xrandr
  - Override with:              KIOSK_OUTPUT=HDMI-A-1  (in ddil-kiosk.service Environment=)

EOF
