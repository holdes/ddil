"""Assemble the DDIL demo handoff deck from parts.

  python3 build.py   ->  ../ddil-handoff.html        instructor build: speaker notes (N), images linked from ../img/
                         ../ddil-handoff-share.html  single file for email: images and fonts inlined, no speaker notes

Engine copied from ../../deck/build (head, nav, helpers, tail) without the iso figures.
Kit markers are placed from ../../setup/src/hotspots.json, so a corrected hotspot there moves the marker here on rebuild.
Nothing loads from the network: fonts are embedded from ../../brand/fonts, images are local or inlined.
"""
import base64
import json
import pathlib
import re

B = pathlib.Path(__file__).parent
OUT = B.parent                      # handoff/
ROOT = OUT.parent                   # enablement/
p = lambda n: (B / n).read_text()

head = p("head.part").replace("<title>SOC Modernization Huntsville</title>", "<title>DDIL Demo Handoff</title>").rstrip()
imp = re.search(r"@import url\('https://fonts\.googleapis[^']*'\);", head).group(0)

# current Elastic logo (glyph plus wordmark, dark ink), cropped to its artwork; never the old colour mark, never typed text
logo = (ROOT / "brand/logo/logo-elastic-horizontal-dark-ink.svg").read_text().strip()
logo = re.sub(r'<svg width="600" height="300" viewBox="0 0 600 300"', '<svg viewBox="84.0 75.0 431.5 149.5"', logo)
assert 'viewBox="84.0' in logo
logo = logo.replace("'", "\\'").replace("\n", " ")
helpers = p("js_helpers.part")
m = re.search(r"const MARK='.*?';", helpers, re.S)
assert m
helpers = helpers[:m.start()] + "const MARK='" + logo + "';" + helpers[m.end():]
assert "${MARK}elastic" in helpers
helpers = helpers.replace("${MARK}elastic", "${MARK}")


# numbered markers from the setup guide's hotspot map
HS = json.loads((ROOT / "setup/src/hotspots.json").read_text())


def markers(mo):
    attrs = mo.group(0)
    hs_set = re.search(r'data-set="([^"]+)"', attrs).group(1)
    spec = re.search(r'data-mk="([^"]+)"', attrs).group(1)
    by = {h["id"]: h for h in HS[hs_set]}
    out = []
    for item in spec.split(","):
        hid, lab = item.split("=")
        cls = "mk"
        if lab.startswith("b:"):
            cls, lab = "mk bl", lab[2:]
        h = by[hid.strip()]          # KeyError here means the id is not in that hotspot set
        out.append(f'<i class="{cls}" style="left:{h["x"]}%;top:{h["y"]}%" title="{h["label"]}">{lab}</i>')
    return attrs + "".join(out)


slides = p("slides.html")
slides = re.sub(r'<div class="fig[^"]*"[^>]*data-set="[^"]+"[^>]*>\s*<img [^>]*>', markers, slides)

imgs = sorted(set(re.findall(r"\{\{IMG:([^}]+)\}\}", slides)))
for n in imgs:
    assert (OUT / "img" / n).exists(), "missing image " + n


def logo_uri(name):
    return "data:image/svg+xml;base64," + base64.b64encode((ROOT / "brand/logo" / name).read_bytes()).decode()


def embed(mo):
    f = ROOT / "brand/fonts" / mo.group(1)
    return "url(data:font/woff2;base64," + base64.b64encode(f.read_bytes()).decode() + ")"


faces = re.sub(r"url\(fonts/([^)]+)\)", embed, "".join(re.findall(r"@font-face\{.*?\}", (ROOT / "brand/fonts.css").read_text(), re.S)))


def assemble(sl):
    body = ("\n" + p("extra.css") + "\n</style>\n</head>\n<body>\n<div id=\"deck\">\n" + sl + "\n" + p("tail_html.part") + "\n" + helpers
            + "\n" + p("fx.js") + "\n" + p("js_nav.part"))
    return head.replace(imp, faces) + body


# instructor: notes kept, images linked next to the file
inst = slides
for n in imgs:
    inst = inst.replace("{{IMG:" + n + "}}", "img/" + n)
html = assemble(inst)
(OUT / "ddil-handoff.html").write_text(html)

# share: one file, images inlined, notes removed
share = slides
for n in imgs:
    mime = {"webp": "image/webp", "jpg": "image/jpeg", "png": "image/png"}[n.rsplit(".", 1)[1]]
    share = share.replace("{{IMG:" + n + "}}", f"data:{mime};base64," + base64.b64encode((OUT / "img" / n).read_bytes()).decode())
share = re.sub(r'\s*data-notes="[^"]*"', "", share)
shtml = assemble(share)
(OUT / "ddil-handoff-share.html").write_text(shtml)

assert "{{" not in html and "{{" not in shtml
fx = re.findall(r'data-fx="([^"]+)"', html)
assert len(fx) == len(set(fx)), "duplicate data-fx"
low = slides.lower()
for bad in ("\u2014", "&mdash;", "googleapis", "seamless", "leverage", "robust", "iso.mjs"):
    assert bad not in low and bad not in p("fx.js").lower(), "banned: " + bad
assert "http://" not in re.sub(r"http://192\.168\.1\.\d+", "", slides) and "https://" not in slides, "external URL in slides"
print("slides:", html.count('<section class="slide'), "| images:", len(imgs), "| sizes KB:", len(html) // 1024, len(shtml) // 1024)
