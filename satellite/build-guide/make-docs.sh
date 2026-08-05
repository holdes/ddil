#!/usr/bin/env bash
# Convert the build guides to Word and PDF.
#
# Markdown stays the source of truth - regenerate, do not hand-edit the output.
# Everything here is plain CommonMark with tables, so pandoc needs no filters.
#
#   ./make-docs.sh          -> docx + a single combined docx
#   ./make-docs.sh pdf      -> also attempt PDF (needs a LaTeX or HTML engine)

set -euo pipefail
cd "$(dirname "$0")"
OUT=dist
mkdir -p "$OUT"

ORDER=(README.md 01-printing.md 02-frame-and-decks.md 03-panels-and-payload.md
       04-electronics.md 05-wings-and-pedestal.md 06-software-and-link.md
       07-checkout.md OPEN-ITEMS.md)

COMMON=(--from=gfm --toc --toc-depth=2 --standalone
        --metadata=author:"Elastic x Aerospace"
        --resource-path=.:../cad/renders:../diagrams)

echo "== docx (per guide) =="
for f in "${ORDER[@]}"; do
  pandoc "${COMMON[@]}" --metadata=title:"${f%.md}" \
         -o "$OUT/${f%.md}.docx" "$f"
  echo "   $OUT/${f%.md}.docx"
done

echo "== docx (combined) =="
pandoc "${COMMON[@]}" --metadata=title:"1U CubeSat Demo - Build Guide" \
       -o "$OUT/CubeSat-Build-Guide.docx" "${ORDER[@]}"
echo "   $OUT/CubeSat-Build-Guide.docx"

if [ "${1:-}" = "pdf" ]; then
  echo "== pdf =="
  # Try engines in order of likelihood; none is installed by default on macOS.
  for eng in tectonic xelatex pdflatex wkhtmltopdf weasyprint; do
    if command -v "$eng" >/dev/null 2>&1; then
      pandoc "${COMMON[@]}" --pdf-engine="$eng" \
             --metadata=title:"1U CubeSat Demo - Build Guide" \
             -o "$OUT/CubeSat-Build-Guide.pdf" "${ORDER[@]}"
      echo "   $OUT/CubeSat-Build-Guide.pdf  (via $eng)"
      exit 0
    fi
  done
  echo "   no PDF engine found. Install one:"
  echo "     brew install tectonic        # smallest, no full TeX install"
  echo "     brew install --cask basictex # or a real TeX distribution"
  exit 1
fi
