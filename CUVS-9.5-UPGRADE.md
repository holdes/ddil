# cuVS GPU image — 9.4.2 → 9.5.x upgrade (PROVEN)

**Question:** keep the GPU vector-indexing race working after upgrading Elasticsearch
from 9.4.2 to 9.5.x. **Answer: no cuVS source rebuild needed — a one-class bytecode
patch of the stock `cuvs-java` JAR + the matching aarch64 `libcuvs` conda libs.**
**Verified end-to-end on 2026-11-20 on the DGX Spark: a real cuVS CAGRA graph index
built on the GB10 under ES 9.5.6, aarch64.**

Supersedes the earlier "rebuild the JAR from cuVS source" plan — that turned out to
be unnecessary. See also the original 25.x procedure in `CUVS-AARCH64-BUILD.md`.

## What actually changed 9.4.2 → 9.5.x

| | 9.4.2 (live) | 9.5.5 / 9.5.6 (target) |
|---|---|---|
| GPU module dir | `modules/gpu` | `modules/gpu` — unchanged |
| bundled cuvs-java | `cuvs-java-25.12.0.jar` | `cuvs-java-26.02.0.jar` (9.5.5 **and** 9.5.6 identical) |
| native loading | embedded `.so` (25.x) | **System loader + Panama FFI** → `libcuvs_c.so` from `LD_LIBRARY_PATH` (no JNI wrapper, no embedded `.so`, arch-neutral) |

**The real blocker is a Java arch gate, not the native code.** `cuvs-java`'s
`com.nvidia.cuvs.spi.CuVSServiceProvider$Holder.builtinProvider()` does:

```
supported = os.name startsWith "Linux"  &&  os.arch equals "amd64"  &&  javaFeature > 21
if supported -> load JDKProvider (the real provider)
else         -> UnsupportedProvider("cuvs-java supports only x86")   // throws on use
```

On aarch64, `os.arch` is `aarch64`, so the stock JAR returns the UnsupportedProvider,
and Elasticsearch's `org.elasticsearch.gpu.CuVSGPUSupport` logs *"GPU based vector
indexing is not supported on this platform; cuvs-java supports only x86"* and disables
GPU. **Your live 9.4.2 node only works because `docker/es-gpu/` ships a custom-patched
JAR** (`cuvs-java-25.12.0.jar`); the 9.5.x image ships the stock (ARM-rejecting) JAR.

> A global `-Dos.arch=amd64` override is **NOT** a fix — it makes Lucene/JDK look for
> amd64 vector natives and **crashes the JVM** (exit 134) on the real aarch64 host.
> The gate must be patched surgically in cuvs-java only.

## The fix (what's in this repo)

1. **Native libs** — a conda env with `libcuvs 26.02` (aarch64, cuda13), bind-mounted at
   `/opt/cuvs/lib`:
   ```bash
   conda create -n cuvs-2602 -c rapidsai -c conda-forge 'libcuvs=26.02' 'cuda-version=13'
   ```
   (rapidsai publishes aarch64 `libcuvs 26.02`. The env ships `libcuvs_c.so` + CUDA runtime.)
2. **Patched JAR** — `docker/es-gpu/cuvs-java-26.02.0-aarch64.jar`: the stock 26.02 JAR
   with the `os.arch=="amd64"` gate in `CuVSServiceProvider$Holder` forced true. Built by
   **`docker/es-gpu/patch-cuvs-aarch64.sh`** (reproducible; replaces the
   `getProperty("os.arch").equals("amd64")` bytecode with `nop*9 + iconst_1`, preserving
   `istore_2` and all offsets — no constant-pool/length/StackMapTable change).
3. **Image** — `docker/es-gpu/Dockerfile.9.5.6`: `FROM …:9.5.6`, copies the patched JAR
   over the stock one, sets `LD_LIBRARY_PATH=/opt/cuvs/lib:/usr/local/cuda/lib64`.

Rebuild the patched JAR for a new cuvs-java version:
```bash
# extract the stock JAR from the target ES image, then:
docker/es-gpu/patch-cuvs-aarch64.sh cuvs-java-<ver>.jar cuvs-java-<ver>-aarch64.jar
# if the constant-pool indices moved, the script says so — re-derive via javap (see script).
```

## Proof it works (2026-11-20, GB10, ES 9.5.6)

Standalone single-node 9.5.6 + patched JAR + conda-2602 libs (no os.arch spoof):
```
INFO  CuVSGPUSupport — Initializing GPU support with CuVS provider ...GPUInfoProviderImpl
INFO  CuVSGPUSupport — Found compatible GPU [NVIDIA GB10] (id: [0])
# with xpack.license=trial, indexing 6000×128-d vectors + force-merge:
DEBUG ES92GpuHnswVectorsWriter — Carga index created in: 30.92 ms; #num vectors: 6000
DEBUG CuVSResourceManager     — Computation finished / Releasing resources to pool
DEBUG ES92GpuHnswVectorsWriter — cagra_hnws index serialized to Lucene HNSW in: 3.36 ms
```
A real cuVS **CAGRA** graph built on the GB10 → sm_121/Blackwell works with cuVS 26.02.

> **License:** GPU indexing needs `xpack.license.self_generated.type=trial` (already set
> in `docker-compose.yml`). On `basic` ES logs *"supports GPU indexing, but it is not
> allowed by the current license"* and falls back to CPU.
>
> **GB10 note:** `nvidia-smi` reports `memory.used [N/A]` (unified memory); and CAGRA
> builds are sub-100ms for small segments, so GPU-util polling can miss them — the DEBUG
> `Carga index created` line is the reliable signal.

## Cutover steps (Phase 3 — not yet done; live node is still 9.4.2)

1. Create the `cuvs-2602` conda env (above).
2. In `docker/docker-compose.yml` es-gpu service: set `build.dockerfile: Dockerfile.9.5.6`
   and point the native mount at the new env —
   `~/miniforge3/envs/cuvs-2602/lib:/opt/cuvs/lib:ro`.
3. Bump the **framework-cpu** node to the same 9.5.x (both nodes must match).
4. `sg docker -c "docker compose build es-gpu && docker compose up -d"`.
5. Verify: logs show `Found compatible GPU [NVIDIA GB10]`; index vectors + force-merge;
   confirm a `Carga index created` DEBUG line (set `logger.org.elasticsearch.gpu: DEBUG`).

## Rollback

Fully reversible: the live `Dockerfile` (9.4.2), the `cuvs-build` (25.12) env, the repo's
`cuvs-java-25.12.0.jar`, and `es-gpu-data` are untouched until you flip compose at cutover.
Revert = restore the es-gpu service's `build.dockerfile`/mount and rebuild.

## Effort

The spike (this) consumed the hard part. Remaining cutover is ~30 min of config + the
cluster version bump — no compile. ES version choice is free: **9.5.5 and 9.5.6 bundle the
identical `cuvs-java-26.02.0.jar`**, so the same patched JAR serves either. 9.6 is not released.
