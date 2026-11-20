"""Build a single-file copy of the practice trainer: dist/ddil-trainer.html.

Inlines every stylesheet, script, font, logo and kit image, plus the corpus
figures re-encoded as small WebP. The 100 source PDFs (about 229 MB) are left
out; the document viewer says so and points at ddil-mock.zip.

Run from mock/:  python3 -I tools/build_single.py [--fig-width 720] [--fig-q 62]
Needs cwebp on PATH for the figures. Nothing is fetched from the network.
"""
import argparse, base64, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIME = {".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png"}


def uri(path: Path) -> str:
    return "data:" + MIME[path.suffix] + ";base64," + base64.b64encode(path.read_bytes()).decode()


def css_inline(path: Path) -> str:
    text = path.read_text()
    # @import url("fonts.css") -> the file itself
    text = re.sub(r'@import url\("([^"]+)"\);', lambda m: css_inline(path.parent / m.group(1)), text)
    # url(fonts/x.woff2) -> data URI
    return re.sub(r"url\(([^)\"']+\.(?:woff2|svg|webp|png))\)", lambda m: "url(" + uri(path.parent / m.group(1)) + ")", text)


def figures(width: int, q: int) -> dict:
    out, src = {}, ROOT / "data" / "figs"
    if not src.is_dir():
        print("data/figs not found: figures will show as not packed", file=sys.stderr)
        return out
    if not shutil.which("cwebp"):
        sys.exit("cwebp not found (brew install webp)")
    with tempfile.TemporaryDirectory() as tmp:
        for f in sorted(src.glob("*/*.jpg")):
            o = Path(tmp) / "f.webp"
            subprocess.run(["cwebp", "-quiet", "-q", str(q), "-resize", str(width), "0", str(f), "-o", str(o)], check=True)
            out[f.parent.name + "/" + f.name] = uri(o)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fig-width", type=int, default=720)
    ap.add_argument("--fig-q", type=int, default=62)
    a = ap.parse_args()

    html = (ROOT / "index.html").read_text()
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: "<style>\n" + css_inline(ROOT / m.group(1)) + "\n</style>", html)
    html = re.sub(r'<link rel="icon" href="([^"]+)"[^>]*>', lambda m: '<link rel="icon" href="' + uri(ROOT / m.group(1)) + '">', html)

    figs = figures(a.fig_width, a.fig_q)
    assets = "<script>window.MOCK_SINGLE=true;window.MOCK_FIGS=" + json.dumps(figs) + ";</script>\n"

    def script(m):
        name = m.group(1)
        js = (ROOT / name).read_text()
        for ref in ("brand/logo/logo-elastic-horizontal-white.svg", "img/kit-front.webp"):
            js = js.replace(ref, uri(ROOT / ref))
        if name.endswith("screens-jina.js"):
            js = js.replace('function figSrc(id, f) { return "data/figs/" + id + "/" + f; }',
                            'function figSrc(id, f) { return (window.MOCK_FIGS || {})[id + "/" + f] || ("data/figs/" + id + "/" + f); }')
            js = js.replace("if (S.media !== true) h += '<div class=\"vmissing\"><div><b>PDF not packed.</b><br>Run <span class=\"mono\">python3 -I tools/pack_corpus.py</span> in mock/ to copy the 100 source PDFs, or use the ddil-mock.zip build.</div></div>';",
                            "if (S.media !== true || window.MOCK_SINGLE) h += '<div class=\"vmissing\"><div><b>Source PDFs are not in the single-file trainer.</b><br>Open the paper from its PubMed Central id above, or use the ddil-mock.zip build for the full PDFs.</div></div>';")
            assert "MOCK_FIGS" in js and "MOCK_SINGLE" in js, "screens-jina.js changed: update the patches in build_single.py"
        return "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>"

    first = True
    def scr(m):
        nonlocal first
        s = script(m)
        if first:
            first = False
            return assets + s
        return s
    html = re.sub(r'<script src="([^"]+)"></script>', scr, html)

    markup = re.sub(r"<script>.*?</script>", "", html, flags=re.S)  # JS builds its own strings
    left = re.findall(r'(?:src|href)="(?!data:|#|https?:)([^"]+)"', markup)
    assert not left, left
    out = ROOT / "dist" / "ddil-trainer.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html)
    print(f"{out.relative_to(ROOT)}: {out.stat().st_size / 1e6:.1f} MB, {len(figs)} figures inlined")


if __name__ == "__main__":
    main()
