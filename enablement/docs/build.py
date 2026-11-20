#!/usr/bin/env python3
"""Build the DDIL SA documentation set.

  src/<name>.html  page bodies (one <div class="page"> per PDF page)
  src/style.css    shared stylesheet, inlined into every document
  figures/*.svg    iso figures, inlined where a body has <!--fig:NAME-->

Steps per document:
  1. Assemble html/<name>.html (inline CSS, embedded fonts, footers numbered "Page N of M").
  2. preflight.py (hive-elastic-brand-pdf). Stops on ERROR, prints every WARN.
  3. pdf_verify.py (renders pdf/<name>.pdf with headless Chrome, then checks
     bottom edge, DOM overflow and page count).

Usage:
  python3 build.py                 # all documents
  python3 build.py 03-scenario-vineyard
  python3 build.py --html-only     # assemble HTML, skip preflight and render

Requires Google Chrome and PyMuPDF (pip install pymupdf) for pdf_verify.
Set HIVE_PDF_SCRIPTS if hive-mind is not at ~/Desktop/Elastic/hive-mind.
"""
import base64, os, re, subprocess, sys
from pathlib import Path

DOCS = Path(__file__).resolve().parent
SRC, HTML, FIG = DOCS / "src", DOCS / "html", DOCS / "figures"
BRAND = DOCS.parent / "brand"
SCRIPTS = Path(os.environ.get("HIVE_PDF_SCRIPTS",
    Path.home() / "Desktop/Elastic/hive-mind/skills/hive-elastic-brand-pdf/assets/scripts"))

ORDER = [
    ("00-sa-training-guide", "SA training guide"),
    ("01-architecture-guide", "Architecture guide"),
    ("02-kit-configuration-runbook", "Kit configuration runbook"),
    ("03-scenario-vineyard", "Scenario runbook: Vineyard Intelligence"),
    ("04-scenario-sec", "Scenario runbook: SEC Findings"),
    ("05-scenario-multimodal", "Scenario runbook: Multimodal + Need-to-Know"),
    ("06-quick-reference", "Quick reference card"),
]


def fonts_css() -> str:
    """Embed the self-hosted fonts so the HTML renders identically anywhere (airgap safe)."""
    def b64(name):
        return base64.b64encode((BRAND / "fonts" / name).read_bytes()).decode()
    css = ["@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;"
           f"src:url(data:font/woff2;base64,{b64('Inter-400.woff2')}) format('woff2')}}"]
    for w in (400, 500, 600, 700):
        css.append("@font-face{font-family:'IBM Plex Mono';font-style:normal;"
                   f"font-weight:{w};src:url(data:font/woff2;base64,{b64(f'IBMPlexMono-{w}.woff2')}) format('woff2')}}")
    return "\n".join(css)


def figure(name: str) -> str:
    svg = (FIG / f"{name}.svg").read_text(encoding="utf-8")
    svg = re.sub(r"<\?xml[^>]*\?>", "", svg)
    return re.sub(r'\swidth="[^"]*"\s+height="[^"]*"', "", svg, count=1)


def assemble(name: str, title: str) -> tuple[Path, int]:
    body = (SRC / f"{name}.html").read_text(encoding="utf-8")
    body = re.sub(r"<!--fig:([\w-]+)-->", lambda m: figure(m.group(1)), body)
    total = len(re.findall(r'<div class="page[" ]', body))
    def foot(m):
        # page number = number of page divs opened before this footer
        n = len(re.findall(r'<div class="page[" ]', body[:m.start()]))
        return ('<div class="pf"><img src="../assets/logos/elastic-horizontal-dark-ink.svg" '
                f'alt="Elastic" width="72" height="24"><span>DDIL kit · {title} · Page {n} of {total}</span></div>')

    body = re.sub(r"<!--foot-->", foot, body)
    css = (SRC / "style.css").read_text(encoding="utf-8")
    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DDIL Kit {title}</title>
<link rel="stylesheet" href="../../brand/tokens.css">
<style>
{fonts_css()}
{css}
</style>
</head>
<body>
{body}
</body>
</html>
"""
    out = HTML / f"{name}.html"
    out.write_text(doc, encoding="utf-8")
    return out, total


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def main(argv):
    html_only = "--html-only" in argv
    wanted = [a for a in argv if not a.startswith("--")]
    HTML.mkdir(exist_ok=True)
    (DOCS / "pdf").mkdir(exist_ok=True)
    failed = []
    for name, title in ORDER:
        if wanted and name not in wanted:
            continue
        path, pages = assemble(name, title)
        print(f"== {name}: {pages} pages")
        if html_only:
            continue
        code, out = run([sys.executable, str(SCRIPTS / "preflight.py"), str(path)])
        flagged = [l.strip() for l in out.splitlines() if "[ERROR]" in l or "[WARN" in l or "→" in l]
        print("   preflight:", "PASS" if code == 0 else "FAIL")
        for l in flagged:
            print("     ", l)
        if code != 0:
            failed.append(name)
            continue
        code, out = run([sys.executable, str(SCRIPTS / "pdf_verify.py"), str(path), "--expected", str(pages)])
        status = "PASS" if code == 0 else "FAIL"
        print("   pdf_verify:", status)
        if code != 0:
            print(out)
            failed.append(name)
    if failed:
        print("FAILED:", ", ".join(failed))
        return 1
    print("All documents built and verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
