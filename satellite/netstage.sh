#!/usr/bin/env bash
#
# netstage.sh - pre-load a WiFi network onto headless Pis, without dropping
# the connection you are using to do it.
#
# WHY
#
# Every Pi in this build is headless. Once a device is off the network there is
# no way back in: macOS cannot mount the Pi's ext4 root to edit a profile
# offline, so the only recovery is HDMI + keyboard or a serial cable. The fix is
# to stage the new network BEFORE it is needed, while the old one still works.
#
# WHAT IT DOES
#
# Auth is by ssh key (BatchMode - it never prompts). Privilege on the far end is
# `sudo -n` where available, since adding a system connection needs root.
#
# For each host: adds (or updates) a NetworkManager profile for the new SSID,
# gives it a higher autoconnect priority than everything else, and leaves the
# CURRENT connection alone. Nothing is activated - the device keeps its existing
# association and will pick the new network the next time it associates, or when
# you take the old one away.
#
# That last part is deliberate. NetworkManager does not roam off a working
# association just because a higher-priority network appeared, so activating
# mid-run would cut the SSH session it is running over.
#
# USAGE
#
#   export STAGE_PSK='the-new-passphrase'          # not on the command line
#   ./netstage.sh --ssid ddil-ops pi@groundation.local pi@pisat.local
#
#   ./netstage.sh --ssid ddil-ops --activate pi@host   # switch now (will drop SSH)
#   ./netstage.sh --list pi@host                       # just show what is stored
#
# NOTE ON THE PASSPHRASE
#   It is read from $STAGE_PSK so it never lands in your shell history. It is
#   still briefly visible in `ps` on the remote host while nmcli runs; on a
#   single-user Pi that is an acceptable trade for not having to type it into
#   every device by hand.

set -uo pipefail

SSID=""; PRIORITY=10; ACTIVATE=0; LIST=0; CONNAME=""
HOSTS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --ssid)     SSID="$2"; shift 2 ;;
    --name)     CONNAME="$2"; shift 2 ;;
    --priority) PRIORITY="$2"; shift 2 ;;
    --activate) ACTIVATE=1; shift ;;
    --list)     LIST=1; shift ;;
    -h|--help)  sed -n '2,40p' "$0"; exit 0 ;;
    *)          HOSTS+=("$1"); shift ;;
  esac
done
: "${CONNAME:=$SSID}"

if [ ${#HOSTS[@]} -eq 0 ]; then
  echo "no hosts given. try: $0 --ssid ddil-ops pi@groundation.local" >&2; exit 2
fi
if [ "$LIST" -eq 0 ] && [ -z "$SSID" ]; then
  echo "--ssid is required (or use --list)" >&2; exit 2
fi
if [ "$LIST" -eq 0 ] && [ -z "${STAGE_PSK:-}" ]; then
  echo "set STAGE_PSK to the passphrase first:  export STAGE_PSK='...'" >&2; exit 2
fi

SSH=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8)

ok()   { printf '  \033[32mok\033[0m    %s\n' "$*"; }
bad()  { printf '  \033[31mfail\033[0m  %s\n' "$*"; }
note() { printf '        %s\n' "$*"; }

rc=0
for H in "${HOSTS[@]}"; do
  printf '\n\033[1m%s\033[0m\n' "$H"

  if ! "${SSH[@]}" "$H" true 2>/dev/null; then
    bad "unreachable over ssh"; rc=1; continue
  fi

  if [ "$LIST" -eq 1 ]; then
    "${SSH[@]}" "$H" 'nmcli -f NAME,TYPE,AUTOCONNECT,AUTOCONNECT-PRIORITY connection show' \
      2>/dev/null | sed 's/^/        /'
    continue
  fi

  # NetworkManager is the assumption; Bookworm and later use it by default.
  if ! "${SSH[@]}" "$H" 'command -v nmcli >/dev/null' 2>/dev/null; then
    bad "no nmcli - this host is not on NetworkManager, stage it by hand"; rc=1; continue
  fi

  BEFORE="$("${SSH[@]}" "$H" 'nmcli -t -f NAME connection show --active | head -1' 2>/dev/null)"
  note "currently on: ${BEFORE:-unknown}"

  # add or update, idempotently; never touch the active connection
  OUT="$(STAGE_PSK="$STAGE_PSK" "${SSH[@]}" "$H" \
    "SSID='$SSID' NAME='$CONNAME' PRIO='$PRIORITY' PSK='$STAGE_PSK' bash -s" <<'REMOTE' 2>&1
set -e
IF="$(nmcli -t -f DEVICE,TYPE device | awk -F: '$2=="wifi"{print $1; exit}')"
[ -n "$IF" ] || { echo "no wifi device"; exit 1; }

# Adding a SYSTEM connection needs root. Interactively polkit would prompt, but
# over ssh there is nobody to prompt, so it just fails. Raspberry Pi OS gives the
# pi user passwordless sudo (rebuild-pi.sh depends on it), so prefer `sudo -n`
# and fall back to bare nmcli where sudo is absent or would ask for a password.
if sudo -n true 2>/dev/null; then NM="sudo -n nmcli"; else NM="nmcli"; fi

if $NM -t -f NAME connection show | grep -qx "$NAME"; then
  $NM connection modify "$NAME" \
    802-11-wireless.ssid "$SSID" \
    wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PSK" \
    connection.autoconnect yes connection.autoconnect-priority "$PRIO"
  echo "updated via $NM"
else
  $NM connection add type wifi con-name "$NAME" ifname "$IF" ssid "$SSID" \
    connection.autoconnect yes connection.autoconnect-priority "$PRIO" >/dev/null
  $NM connection modify "$NAME" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PSK"
  echo "added via $NM"
fi
REMOTE
)"
  case "$OUT" in
    *added*)   ok "profile '$CONNAME' added for SSID '$SSID' (priority $PRIORITY)"
               case "$OUT" in *"via nmcli"*) note "no passwordless sudo - if the profile does not stick, that is why" ;; esac ;;
    *updated*) ok "profile '$CONNAME' updated for SSID '$SSID' (priority $PRIORITY)" ;;
    *)         bad "could not stage: $OUT"; rc=1; continue ;;
  esac

  # prove it is actually stored, rather than trusting the exit code
  if "${SSH[@]}" "$H" "nmcli -t -f NAME connection show | grep -qx '$CONNAME'" 2>/dev/null; then
    ok "verified present on disk"
  else
    bad "nmcli reported success but the profile is not listed"; rc=1
  fi

  STILL="$("${SSH[@]}" "$H" 'nmcli -t -f NAME connection show --active | head -1' 2>/dev/null)"
  if [ "$STILL" = "$BEFORE" ]; then
    ok "still on '$BEFORE' - nothing was interrupted"
  else
    note "active connection changed: '$BEFORE' -> '${STILL:-none}'"
  fi

  if [ "$ACTIVATE" -eq 1 ]; then
    note "activating '$CONNAME' - this session will drop, that is expected"
    "${SSH[@]}" "$H" "sudo -n nmcli connection up '$CONNAME' >/dev/null 2>&1 &" 2>/dev/null || true
  fi
done

cat <<'NEXT'

next
  1. Check each device now holds both profiles:   ./netstage.sh --list pi@host
  2. Disable the bootstrap WLAN on the UniFi. The Pis re-associate onto the new
     network on their own - do this while you are still stood next to them, so a
     bad profile is a two-minute fix rather than a dead device at the venue.
  3. Find them again by mDNS (pi@<hostname>.local) or the UniFi client list;
     their addresses come from a different DHCP server now.
NEXT
exit $rc
