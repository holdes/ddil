# cuVS GPU image — 9.4.2 → 9.5.x upgrade spike

**Question:** what does it take to keep the GPU vector-indexing race working after we
upgrade Elasticsearch from 9.4.2 to 9.5.x? **Answer: a cuvs-java rebuild (version bump
25.12.0 → 26.02.0), same proven path as the existing build — no architectural blocker.**

Spike run **2026-11-20 on the DGX Spark** (where the es-gpu node lives). See the
original build procedure in [`CUVS-AARCH64-BUILD.md`](./CUVS-AARCH64-BUILD.md); this
doc is the delta for the version bump.

## What was verified (hard facts, not assumptions)

Inspected both stock Elastic images directly on the Spark:

| | **9.4.2 (current, live)** | **9.5.5 (target)** |
|---|---|---|
| GPU module dir | `modules/gpu` | `modules/gpu` — **unchanged** ✅ |
| bundled cuvs-java JAR | `cuvs-java-25.12.0.jar` | **`cuvs-java-26.02.0.jar`** ⚠️ |
| codec / plugin jars | `elasticsearch-gpu-codec-9.4.2.jar`, `x-pack-gpu-9.4.2.jar` | `…-9.5.5.jar` |

Supporting facts:
- The Dockerfile's `COPY … modules/gpu/…` path is **correct and unchanged** — the
  `x-pack-gpu` path in the old build doc was stale.
- Current native stack: conda env `cuvs-build` has **libcuvs 25.12.00 (cuda13)**;
  repo JAR `docker/es-gpu/cuvs-java-25.12.0.jar` (rebuilt Mar 2026) matches it. The
  live `es-gpu` container is Up on 9.4.2 with that 25.12.0 JAR. Baseline is consistent.
- **Feasibility of the bump:** `rapidsai` publishes **libcuvs 26.02.00 (cuda13) for
  aarch64** (confirmed via `conda search`; 26.06/26.08/26.10 also exist). So the native
  26.02 rebuild is available on the same channel we already use.

## Conclusion

A simple `FROM …:9.5.5` + drop-in of the **same** JAR will **not** work: 9.5.x's
`x-pack-gpu`/codec jars expect `cuvs-java-26.02.0.jar`, and the Java API shifted across
the 25.12 → 26.02 cuVS cycle. We must **rebuild the aarch64 cuvs-java at 26.02** and bump
the image. This is the same procedure already executed once for 25.12 — just re-pinned.

Risk is **lower** than the first time: the module path is confirmed stable, and cuVS
26.02 (Feb 2026) is far newer than the 25.06 the original concern was written against, so
Blackwell `sm_121` support is more likely mature. The Blackwell index test is still the gate.

## ES patch version — RESOLVED (either 9.5.5 or 9.5.6; same cuVS target)

The rebuild is driven by the **bundled cuvs-java version**. Inspected all realistic
targets on 2026-11-20:

| ES version | bundled cuvs-java | available? |
|---|---|---|
| 9.5.5 | `cuvs-java-26.02.0.jar` | ✅ (running on `secdemo`) |
| 9.5.6 | `cuvs-java-26.02.0.jar` — **identical** | ✅ (latest in the 9.5 line) |
| 9.5.7 / 9.6.x | — | ❌ not released yet (latest is 9.5.6) |

**9.5.5 and 9.5.6 bundle the exact same `cuvs-java-26.02.0.jar`** (byte-identical,
1,369,789 B), so **the aarch64 rebuild is the same for both** — one JAR serves either.
The version choice is therefore decoupled from the cuVS work: pick **9.5.6** for the
latest patch, or **9.5.5** to match the `secdemo` cluster. **9.6 is not available** as of
this spike.

Re-inspect any future candidate version in ~10s before building:
```bash
sg docker -c "docker run --rm --entrypoint sh docker.elastic.co/elasticsearch/elasticsearch:<VER> \
  -c 'ls /usr/share/elasticsearch/modules/gpu/'"
```

## Rebuild steps (on the DGX Spark)

1. **New conda env at 26.02** (keep the 25.12 env for rollback):
   ```bash
   conda create -n cuvs-build-2602 -c conda-forge -c rapidsai \
     libcuvs=26.02 libcuvs-headers=26.02 cuda-toolkit=13 cmake ninja openblas openmp python=3.12
   ```
2. **Rebuild `libcuvs_java.so` + the cuvs-java JAR from the matching cuVS branch**
   (`branch-26.02`), following `CUVS-AARCH64-BUILD.md` steps 2–6. **Check first whether the
   3 aarch64 "soft gates" are still needed** — RAPIDS has been adding ARM/sbsa support, so
   26.02 may support aarch64 upstream (less/no patching). Output must be named
   **`cuvs-java-26.02.0.jar`** to match the stock module.
3. **Dockerfile** (`docker/es-gpu/Dockerfile`): bump `FROM …:9.5.6` (or `:9.5.5`) and change the COPY to
   `cuvs-java-26.02.0.jar → /usr/share/elasticsearch/modules/gpu/cuvs-java-26.02.0.jar`
   (remove the 25.12.0 copy). Drop the new JAR into `docker/es-gpu/`.
4. **Compose** (`docker/docker-compose.yml`): point the `/opt/cuvs/lib` bind mount at the
   new env — `~/miniforge3/envs/cuvs-build-2602/lib:/opt/cuvs/lib:ro`. Host CUDA mount
   (`/usr/local/cuda/lib64`) must be CUDA 13.x-compatible (the 26.02 build is cuda13).
5. **Rebuild + boot**: `sg docker -c "docker compose build es-gpu && docker compose up -d es-gpu"`.
6. **Verify** (gate): ES logs show GPU detection; create an index with
   `vectors.indexing.use_gpu: true`; index a batch; confirm GPU utilization in `nvidia-smi`;
   race GPU vs `use_gpu:false`.

## Cheap early experiment (~15 min, do before the full build)

Boot a 9.5.5 es-gpu image with the **existing renamed 25.12 JAR** copied to
`cuvs-java-26.02.0.jar` and read the startup logs. This tells you whether ES enforces the
exact JAR version/API (expected: a load or linkage error) vs. tolerates a mismatch —
confirming how strict the naming/API coupling is before you invest the compile time.

## Open items to confirm during the build (not blockers)

- Whether cuvs-java `branch-26.02` needs the 3 aarch64 soft-gate patches or supports ARM upstream.
- Whether the 9.5.x gpu module loads the JAR by exact filename or a `cuvs-java-*.jar` glob.
- Host CUDA on the Spark is 13.x-compatible for the cuda13 native libs.
- Which cluster to cut first — validate on a throwaway before the main `ddil-vineyard`.

## Rollback

Fully reversible: the 9.4.2 image, the `cuvs-build` (25.12) env, the repo's
`cuvs-java-25.12.0.jar`, and the `es-gpu-data` volume are all untouched until you flip the
running container. Revert = rebuild `es-gpu` from the unchanged 9.4.2 Dockerfile.

## Effort

~2–3 h (vs. the original ~4–5 h — the path is already proven): mostly `libcuvs`/JAR
compile + the Blackwell index test. Start this independently of the app merge; it gates
the GPU-race demo and nothing else depends on it.
