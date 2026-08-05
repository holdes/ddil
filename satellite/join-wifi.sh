#!/usr/bin/env bash
#
# join-wifi.sh - add a WiFi network to this machine, from an ssh session,
# without dropping the session you are using.
#
# Paste it into an ssh session, or scp it over and run it. No dependencies
# beyond what is already on the box, and no internet needed.
#
#   sudo ./join-wifi.sh DDIL
#
# The passphrase is prompted for, never passed as an argument - arguments show
# up in `ps` and in shell history.
#
# It does NOT switch you onto the new network. The profile is stored and the
# machine will pick it up the next time it associates, or when you take the old
# network away. Switching now would cut the ssh session running this script.
#
# Handles both stacks, because Raspberry Pi OS and Ubuntu Server disagree:
#   NetworkManager (Pi OS, Ubuntu Desktop)  -> nmcli
#   netplan + networkd (Ubuntu Server)      -> merged into /etc/netplan
set -u

SSID="${1:-}"
PRIO="${2:-10}"
[ -n "$SSID" ] || { echo "usage: sudo $0 <SSID> [priority]" >&2; exit 2; }
[ "$(id -u)" -eq 0 ] || { echo "run me with sudo - adding a system network needs root" >&2; exit 2; }

printf 'passphrase for %s: ' "$SSID" >&2
read -rs PSK; echo >&2
[ -n "$PSK" ] || { echo "empty passphrase" >&2; exit 2; }

ok()  { printf '  \033[32mok\033[0m    %s\n' "$*"; }
bad() { printf '  \033[31mfail\033[0m  %s\n' "$*"; }

WAS="$(ip route get 1.1.1.1 2>/dev/null | grep -oE 'dev [a-z0-9]+' | awk '{print $2}')"
echo "currently routing via: ${WAS:-unknown}"

# ------------------------------------------------------------ NetworkManager
if command -v nmcli >/dev/null 2>&1 && systemctl is-active --quiet NetworkManager 2>/dev/null; then
  echo "stack: NetworkManager"
  IF="$(nmcli -t -f DEVICE,TYPE device | awk -F: '$2=="wifi"{print $1; exit}')"
  [ -n "$IF" ] || { bad "no wifi device"; exit 1; }

  if nmcli -t -f NAME connection show | grep -qx "$SSID"; then
    nmcli connection modify "$SSID" 802-11-wireless.ssid "$SSID" \
      wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PSK" \
      connection.autoconnect yes connection.autoconnect-priority "$PRIO" \
      && ok "updated profile '$SSID'" || { bad "nmcli modify failed"; exit 1; }
  else
    nmcli connection add type wifi con-name "$SSID" ifname "$IF" ssid "$SSID" \
      connection.autoconnect yes connection.autoconnect-priority "$PRIO" >/dev/null \
      && nmcli connection modify "$SSID" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PSK" \
      && ok "added profile '$SSID' on $IF" || { bad "nmcli add failed"; exit 1; }
  fi

  nmcli -t -f NAME connection show | grep -qx "$SSID" \
    && ok "verified stored" || { bad "not listed after add"; exit 1; }
  echo
  nmcli -f NAME,TYPE,AUTOCONNECT,AUTOCONNECT-PRIORITY connection show | sed 's/^/  /'

# -------------------------------------------------------------------- netplan
elif command -v netplan >/dev/null 2>&1; then
  echo "stack: netplan"
  IF="$(for d in /sys/class/net/*; do [ -d "$d/wireless" ] && basename "$d"; done | head -1)"
  [ -n "$IF" ] || { bad "no wireless interface found"; exit 1; }
  command -v wpa_supplicant >/dev/null 2>&1 || bad "wpasupplicant is not installed - netplan wifi will not work without it"

  # Merge into the existing config rather than dropping a second file that
  # declares the same interface - two files owning one interface is how netplan
  # setups get into an unbootable state. python3 + pyyaml are present on Ubuntu
  # because cloud-init depends on them.
  python3 -c "import yaml" 2>/dev/null || {
    bad "python3 pyyaml is missing - install it (apt install python3-yaml) or edit /etc/netplan by hand"
    exit 1
  }
  TARGET="$(grep -rl "wifis" /etc/netplan/*.yaml 2>/dev/null | head -1)"
  [ -n "$TARGET" ] || TARGET=/etc/netplan/60-wifi.yaml
  echo "  merging into $TARGET"
  cp -a "$TARGET" "$TARGET.bak.$(date +%s)" 2>/dev/null && ok "backed up existing config"

  SSID="$SSID" PSK="$PSK" IFACE="$IF" TARGET="$TARGET" python3 - <<'PY' || { bad "merge failed"; exit 1; }
import os, yaml
t, ssid, psk, iface = os.environ["TARGET"], os.environ["SSID"], os.environ["PSK"], os.environ["IFACE"]
try:
    with open(t) as f:
        doc = yaml.safe_load(f) or {}
except FileNotFoundError:
    doc = {}
net = doc.setdefault("network", {})
net.setdefault("version", 2)
wifis = net.setdefault("wifis", {})
dev = wifis.setdefault(iface, {})
dev.setdefault("dhcp4", True)
dev.setdefault("access-points", {})[ssid] = {"password": psk}
with open(t, "w") as f:
    yaml.safe_dump(doc, f, default_flow_style=False, sort_keys=False)
print(f"  access points now: {', '.join(dev['access-points'])}")
PY

  chmod 600 "$TARGET"; ok "chmod 600 (netplan refuses world-readable secrets)"
  # generate, not apply: apply reconfigures the interface and would cut this session
  netplan generate && ok "config is valid" || { bad "netplan generate rejected it - restore the .bak"; exit 1; }

else
  bad "neither NetworkManager nor netplan found - stage this host by hand"
  exit 1
fi

NOW="$(ip route get 1.1.1.1 2>/dev/null | grep -oE 'dev [a-z0-9]+' | awk '{print $2}')"
echo
[ "$NOW" = "$WAS" ] && ok "still routing via ${WAS:-unknown} - session not interrupted" \
                    || echo "  NOTE route moved: ${WAS:-none} -> ${NOW:-none}"
cat <<EOF

stored, not activated. To switch:
  - take the old network away (turn off the other WLAN), or
  - reboot, or
  - NetworkManager: nmcli connection up '$SSID'
    netplan:        sudo netplan apply
  ...any of which will drop this ssh session. That is expected.
EOF
