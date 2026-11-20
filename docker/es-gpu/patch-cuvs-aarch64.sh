#!/usr/bin/env bash
# Patch the stock cuvs-java JAR to run on aarch64 (DGX Spark / GB10).
#
# cuvs-java's CuVSServiceProvider$Holder.builtinProvider() gates on
# os.arch == "amd64" and otherwise returns an UnsupportedProvider("cuvs-java
# supports only x86"), which makes Elasticsearch's CuVSGPUSupport disable GPU
# indexing on ARM. The native side (libcuvs_c.so) is arch-neutral and loaded
# from LD_LIBRARY_PATH, so the ONLY blocker is this Java arch check.
#
# This forces the arch check to true by replacing the
#   getProperty("os.arch").equals("amd64")  ->  (nop*9, iconst_1)
# byte sequence, preserving istore_2 and all offsets (StackMapTable stays valid).
# Same-length, no constant-pool change. Verified working on ES 9.5.6 + cuvs-java
# 26.02.0 (real CAGRA build on the GB10). Idempotent-ish: re-run on a fresh stock JAR.
#
# Usage: ./patch-cuvs-aarch64.sh <stock-cuvs-java.jar> <output.jar>
set -euo pipefail
SRC="${1:?stock cuvs-java jar}"; OUT="${2:?output jar}"
CLS='com/nvidia/cuvs/spi/CuVSServiceProvider$Holder.class'
TMP="$(mktemp -d)"; cp "$SRC" "$OUT"; chmod 644 "$OUT"
( cd "$TMP" && unzip -oq "$OUT" "$CLS" )
python3 - "$TMP/$CLS" <<'PY'
import sys
p=sys.argv[1]; b=bytearray(open(p,'rb').read())
old=bytes([0x12,0x45,0xB8,0x00,0x37,0x12,0x47,0xB6,0x00,0x49,0x3D])  # ldc os.arch; getProperty; ldc amd64; equals; istore_2
new=bytes([0x00]*9+[0x04,0x3D])                                      # nop*9; iconst_1; istore_2
# NOTE: constant-pool indices (#69 os.arch, #55 getProperty, #71 amd64, #73 equals)
# are build-specific. If this assert fails on a new cuvs-java build, re-derive via:
#   javap -p -c 'CuVSServiceProvider$Holder.class'  (find the os.arch/equals/istore_2 run)
assert b.count(old)==1, "gate pattern not found/unique — re-derive indices for this cuvs-java build"
b[b.find(old):b.find(old)+len(old)]=new
open(p,'wb').write(b); print("patched os.arch gate -> always true")
PY
( cd "$TMP" && zip -q "$OUT" "$CLS" )
rm -rf "$TMP"
echo "wrote $OUT"
