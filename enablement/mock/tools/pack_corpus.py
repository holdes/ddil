#!/usr/bin/env python3
"""pack_corpus.py: build the Multimodal practice corpus for the DDIL mock.

Reads the same artifacts the kit ingests (demo/scripts/jina/ingest-pmc.py):
  hires_chunks.jsonl, hires_images.jsonl, extracted_imgs/, samples/<PMCID>.1.pdf
selects ~100 redistributable papers (CC BY / CC0 only, with figures and a PDF),
stamps each with the kit's own deterministic marking (markings.assign_markings),
and writes:
  js/data-corpus.js      globals: paper metadata, markings, chunk text, figure list
  data/corpus-manifest.json   selection + attribution
  data/pdfs/<PMCID>.pdf       source PDFs                 (gitignored)
  data/figs/<PMCID>/<fig>.jpg figures resized to ~480 px  (gitignored)
  dist/ddil-mock.zip          with --zip: the whole mock incl. media, for SAs

Run with:  python3 -I tools/pack_corpus.py [--src DIR] [--n 100] [--zip] [--no-media]
Stdlib only; uses macOS `sips` to resize figures (falls back to copying).
"""
from __future__ import annotations

import argparse
import collections
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

MOCK = Path(__file__).resolve().parent.parent
REPO = MOCK.parent.parent
DEFAULT_SRC = Path("/Users/bholden/Desktop/Jina/demo-multimodal/scale")
MARKINGS = REPO / "demo" / "scripts" / "jina" / "markings.py"
OK_LICENCES = {"CC BY", "CC0"}
PER_JOURNAL_CAP = 4
MAX_FIGS_PER_PAPER = 8
FIG_PX = 480


def load_markings():
    spec = importlib.util.spec_from_file_location("kit_markings", MARKINGS)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod.assign_markings


def page_from(fn: str) -> int:  # same rule as ingest-pmc.py
    m = re.search(r"(?:figure|table)-(\d+)", fn)
    return int(m.group(1)) if m else 1


def jpeg_size(path: Path) -> tuple[int, int]:
    """(width, height) from the JPEG SOF marker; (0, 0) if unreadable."""
    try:
        with open(path, "rb") as f:
            data = f.read(262144)
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xC0, 0xC1, 0xC2):
                return int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
            i += 2 + int.from_bytes(data[i + 2:i + 4], "big")
    except OSError:
        pass
    return 0, 0


def usable_figure(path: Path) -> bool:
    """Skip publisher badges ("Check for updates"), logos and slivers."""
    w, h = jpeg_size(path)
    if w < 180 or h < 120:
        return False
    return max(w / h, h / w) <= 3.2


def is_junk(text: str) -> bool:
    """Cheap OCR-junk test: very short, or mostly non-letters."""
    t = text.strip()
    if len(t) < 60:
        return True
    letters = sum(c.isalpha() for c in t)
    return letters / max(1, len(t)) < 0.55


def clean(text: str) -> str:
    t = re.sub(r"(\w)- (\w)", r"\1\2", text)  # de-hyphenate line breaks ("transi- tion")
    t = re.sub(r"\s*\n\s*", " ", t)
    return re.sub(r"\s{2,}", " ", t).strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--n", type=int, default=100)
    ap.add_argument("--zip", action="store_true", help="also write dist/ddil-mock.zip with media")
    ap.add_argument("--no-media", action="store_true", help="only write the JS + manifest")
    args = ap.parse_args()
    src: Path = args.src
    assign_markings = load_markings()

    papers: dict[str, dict] = {}
    chunks: dict[str, list] = collections.defaultdict(list)
    all_chunks = 0
    with open(src / "hires_chunks.jsonl", encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            all_chunks += 1
            papers.setdefault(d["parent_id"], d)
            chunks[d["parent_id"]].append(d)
    images: dict[str, list] = {}
    with open(src / "hires_images.jsonl", encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            images[d["parent_id"]] = d["images"]
    all_images = sum(len(v) for v in images.values())

    def pdf_path(pid: str) -> Path:
        return src / "samples" / f"{pid}.1.pdf"

    def figures_of(pid: str) -> list:
        imgs = [fn for fn in images.get(pid, []) if usable_figure(src / "extracted_imgs" / fn)]
        return ([fn for fn in imgs if "/figure-" in fn] or imgs)[:MAX_FIGS_PER_PAPER]

    usable = {pid: figures_of(pid) for pid in images}
    qualifying = [pid for pid, p in papers.items()
                  if p.get("license_code") in OK_LICENCES and usable.get(pid) and pdf_path(pid).exists()]
    qualifying.sort(key=lambda pid: (pdf_path(pid).stat().st_size, pid))
    chosen, per_journal = [], collections.Counter()
    for pid in qualifying:  # smallest PDFs first, at most 4 per journal for diversity
        j = papers[pid].get("journal") or ""
        if per_journal[j] >= PER_JOURNAL_CAP:
            continue
        chosen.append(pid)
        per_journal[j] += 1
        if len(chosen) == args.n:
            break
    chosen.sort()

    out_papers, out_chunks, manifest = [], [], []
    pdf_bytes = 0
    fig_count = 0
    dropped = 0
    for i, pid in enumerate(chosen):
        p = papers[pid]
        m = assign_markings(pid)
        figs = usable[pid]
        fig_count += len(figs)
        pdf_bytes += pdf_path(pid).stat().st_size
        kept = 0
        for c in sorted(chunks[pid], key=lambda c: c.get("chunk_ordinal", 0)):
            if is_junk(c.get("content") or ""):
                dropped += 1
                continue
            out_chunks.append([i, int(c.get("page") or 1), (c.get("section") or "")[:80], clean(c["content"])])
            kept += 1
        out_papers.append({
            "id": pid, "t": p.get("doc_title"), "j": p.get("journal"), "y": p.get("year"),
            "lic": p.get("license_code"), "subj": p.get("subject"),
            "cls": m["classification"], "comps": m["compartments"], "cav": m["caveats"],
            "rel": m["releasability"], "src": m["source_type"],
            "figs": [[fn.split("/", 1)[1].rsplit(".", 1)[0] + ".jpg", page_from(fn)] for fn in figs],
            "nchunks": kept,
        })
        manifest.append({
            "pmcid": pid, "title": p.get("doc_title"), "journal": p.get("journal"), "year": p.get("year"),
            "licence": p.get("license_code"), "subject": p.get("subject"),
            "pdf_mb": round(pdf_path(pid).stat().st_size / 1e6, 2), "figures": len(figs),
            "marking": m, "source": f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pid}/",
        })

    kit = {"papers": len(papers), "chunks": all_chunks, "figures": all_images}
    stats = {"papers": len(chosen), "chunks": len(out_chunks), "figures": fig_count,
             "pdf_mb": round(pdf_bytes / 1e6, 1), "dropped_junk_chunks": dropped,
             "qualifying": len(qualifying), "journals": len(per_journal)}

    data_dir = MOCK / "data"
    data_dir.mkdir(exist_ok=True)
    (data_dir / "corpus-manifest.json").write_text(json.dumps({
        "note": "Practice subset of the kit's pmc-unstructured corpus (PubMed Central Open Access). "
                "Only CC BY / CC0 papers are included; each remains under its stated licence. "
                "Markings are FICTIONAL, assigned by demo/scripts/jina/markings.py exactly as on the kit.",
        "kit_corpus": kit, "subset": stats, "papers": manifest}, indent=1, ensure_ascii=False), encoding="utf-8")

    js = ("/* GENERATED by tools/pack_corpus.py. Do not edit by hand.\n"
          "   Practice subset of the kit corpus: CC BY / CC0 papers from PubMed Central Open Access.\n"
          "   Markings are fictional (demo/scripts/jina/markings.py). See data/corpus-manifest.json for attribution. */\n"
          "window.MOCK = window.MOCK || { data: {}, screens: {} };\n"
          "window.MOCK.corpus = " + json.dumps({"kit": kit, "stats": stats, "papers": out_papers, "chunks": out_chunks},
                                               ensure_ascii=False, separators=(",", ":")) + ";\n")
    (MOCK / "js" / "data-corpus.js").write_text(js, encoding="utf-8")

    if not args.no_media:
        pdf_dir, fig_dir = data_dir / "pdfs", data_dir / "figs"
        pdf_dir.mkdir(exist_ok=True)
        fig_dir.mkdir(exist_ok=True)
        have_sips = shutil.which("sips") is not None
        keep = set(chosen)
        for old in pdf_dir.glob("*.pdf"):  # drop media from an earlier, different selection
            if old.stem not in keep:
                old.unlink()
        for old in fig_dir.iterdir():
            if old.is_dir() and old.name not in keep:
                shutil.rmtree(old)
        for pid, p in zip(chosen, out_papers):
            dst = pdf_dir / f"{pid}.pdf"
            if not dst.exists() or dst.stat().st_size != pdf_path(pid).stat().st_size:
                shutil.copyfile(pdf_path(pid), dst)
            (fig_dir / pid).mkdir(exist_ok=True)
            for fn, (name, _pg) in zip(usable[pid], p["figs"]):
                s, d = src / "extracted_imgs" / fn, fig_dir / pid / name
                if d.exists() or not s.exists():
                    continue
                if have_sips:
                    r = subprocess.run(["sips", "-Z", str(FIG_PX), "-s", "format", "jpeg", "-s", "formatOptions", "70",
                                        str(s), "--out", str(d)], capture_output=True)
                    if r.returncode == 0:
                        continue
                shutil.copyfile(s, d)

    if args.zip:
        dist = MOCK / "dist"
        dist.mkdir(exist_ok=True)
        zpath = dist / "ddil-mock.zip"
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            for path in sorted(MOCK.rglob("*")):
                rel = path.relative_to(MOCK)
                if path.is_dir() or rel.parts[0] in ("dist", "tools") or path.name == ".DS_Store":
                    continue
                comp = zipfile.ZIP_STORED if path.suffix.lower() in (".pdf", ".jpg", ".png", ".woff2") else zipfile.ZIP_DEFLATED
                z.write(path, Path("ddil-mock") / rel, compress_type=comp)
        print(f"zip: {zpath} ({zpath.stat().st_size / 1e6:.1f} MB)")

    js_mb = (MOCK / "js" / "data-corpus.js").stat().st_size / 1e6
    print(json.dumps({"kit": kit, "subset": stats, "data_corpus_js_mb": round(js_mb, 2)}, indent=1))


if __name__ == "__main__":
    sys.exit(main())
