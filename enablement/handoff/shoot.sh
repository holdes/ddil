#!/bin/bash
# usage: T=16 ./shoot.sh [deckfile] [n1 n2 ...]   -> shots/s<n>.png  (default: every slide of ddil-handoff.html)
cd "$(dirname "$0")"
F=${1:-ddil-handoff.html}; shift
N=${@:-$(seq 1 $(grep -c '<section class="slide' "$F"))}
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p shots
for n in $N; do
 "$CH" --headless=new --disable-gpu --hide-scrollbars --window-size=1280,720 --virtual-time-budget=9000 --screenshot=shots/s$n.png "file://$PWD/$F?t=${T:-16}#$n" >/dev/null 2>&1 &
 [ $((n % 4)) -eq 0 ] && wait
done; wait
