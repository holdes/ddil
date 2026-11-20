"""Assemble the DDIL demo kit deck from parts.

  python3 build.py   ->  ../ddil-deck.html (source, fonts linked from ../brand/fonts),
                         ../ddil-deck-bundle.html (fonts embedded, speaker notes),
                         ../ddil-deck-share.html (bundle without speaker notes)

Same engine as the Elastic Security and Anduril Lattice decks. No network loads at runtime:
fonts come from ../../brand/fonts/*.woff2, kit renderings and app screenshots from ../img/
(downscaled copies of setup/img and facelift-shots). The bundle and share builds inline both as data URIs.
"""
import base64
import pathlib
import re

B = pathlib.Path(__file__).parent
OUT = B.parent                      # deck/
ROOT = OUT.parent                   # enablement/
p = lambda n: (B / n).read_text()

head = p("head.part").replace("<title>SOC Modernization Huntsville</title>", "<title>DDIL Demo Kit</title>").rstrip()
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


def logo_uri(name):
    return "data:image/svg+xml;base64," + base64.b64encode((ROOT / "brand/logo" / name).read_bytes()).decode()


slides = p("slides.html")
for k, v in {"{{LOGO_H}}": "logo-elastic-horizontal-dark-ink.svg"}.items():
    slides = slides.replace(k, logo_uri(v))
assert "{{" not in slides

body = ("\n" + p("extra.css") + "\n</style>\n</head>\n<body>\n<div id=\"deck\">\n" + slides + "\n" + p("tail_html.part") + "\n" + helpers
        + "\n" + p("fx.js") + "\n" + p("js_nav.part"))

# source: fonts linked relative to deck/ (works offline next to the repo)
linked = "".join(re.findall(r"@font-face\{.*?\}", (ROOT / "brand/fonts.css").read_text(), re.S)).replace("url(fonts/", "url(../brand/fonts/")
html = head.replace(imp, linked) + body
(OUT / "ddil-deck.html").write_text(html)

# bundle: every face embedded as a data URI
def embed(mo):
    f = ROOT / "brand/fonts" / mo.group(1)
    return "url(data:font/woff2;base64," + base64.b64encode(f.read_bytes()).decode() + ")"
faces = re.sub(r"url\(fonts/([^)]+)\)", embed, "".join(re.findall(r"@font-face\{.*?\}", (ROOT / "brand/fonts.css").read_text(), re.S)))
MIME = {".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png"}
def img_uri(mo):
    f = OUT / "img" / mo.group(1)
    return 'src="data:' + MIME[f.suffix] + ";base64," + base64.b64encode(f.read_bytes()).decode() + '"'
bundle = head.replace(imp, faces) + re.sub(r'src="img/([^"]+)"', img_uri, body)
assert 'src="img/' not in bundle
(OUT / "ddil-deck-bundle.html").write_text(bundle)
share = re.sub(r'\s*data-notes="[^"]*"', "", bundle)
(OUT / "ddil-deck-share.html").write_text(share)

fx = re.findall(r'data-fx="([^"]+)"', html)
assert len(fx) == len(set(fx)), "duplicate data-fx"
for bad in ("\u2014", "&mdash;", "googleapis", "seamless", "leverage", "robust"):
    assert bad not in slides.lower() and bad not in p("fx.js").lower(), "banned: " + bad
assert "http://" not in slides and "https://" not in slides
print("slides:", html.count('<section class="slide'), "| font faces:", faces.count("@font-face"), "| images:", len(re.findall(r'src="img/', html)), "| sizes KB:", len(html) // 1024, len(bundle) // 1024, len(share) // 1024)
