#!/usr/bin/env python3
"""Build the DDIL kit physical setup guide (out of the case to powered on, and pack-down).

Inputs (src/):
  content.py     packing list, the seven steps, indicator timeline, pack-down, troubleshooting
  hotspots.json  hotspot positions per view, in percent of the illustration box
  guide.css      screen and print styles
  guide.js       viewer, hotspots, callouts, checklists, fill-in blanks, copy buttons (classic script)
Images: see IMAGES below.

Outputs:
  index.html                          interactive guide; loads img/, assets/ and ../brand/ (fonts)
  ddil-setup-guide.html               the same page as one self-contained file (images, fonts, logo inlined)
  print/ddil-setup-guide-print.html   paginated Letter edition (one .page per sheet)
  pdf/ddil-setup-guide-print.pdf      rendered and checked with the hive preflight and pdf_verify

Usage: python3 build.py [--no-pdf]
Needs Google Chrome; PyMuPDF for pdf_verify. Set HIVE_PDF_SCRIPTS if hive-mind is elsewhere.
"""
import base64, html, importlib.util, json, os, re, subprocess, sys, tempfile
from pathlib import Path

# ------------------------------------------------------------------ image config (one place)
# Each view resolves to the first file that exists: img/<view>.png, then .webp, then .jpg.
# Drop in transparent PNGs exported at the same framing and rebuild; hotspots are in percent.
IMAGES = {"front": "img/front", "front-packed": "img/front-packed", "front-photo": "img/photo-front",
          "back": "img/back", "back-photo": "img/photo-back", "side": "img/side"}
IMAGE_EXTS = [(".png", "image/png"), (".webp", "image/webp"), (".jpg", "image/jpeg"), (".jpeg", "image/jpeg")]

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
BRAND = ROOT.parent / "brand"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SCRIPTS = Path(os.environ.get("HIVE_PDF_SCRIPTS",
    Path.home() / "Desktop/Elastic/hive-mind/skills/hive-elastic-brand-pdf/assets/scripts"))
# (key, tab, variant). The first variant of each tab opens by default.
VIEWS = [("front", "Front", "Set up"), ("front-packed", "Front", "Packed"), ("front-photo", "Front", "Photo of the kit"),
         ("back", "Back", "Illustration"), ("back-photo", "Back", "Photo of the kit"), ("side", "Side", "Illustration")]
MAIN_VIEWS = [("front", "Front"), ("back", "Back"), ("side", "Side")]
def is_photo(v): return v.endswith("photo")
def vtitle(v):
    k, tab, var = next(x for x in VIEWS if x[0] == v)
    return f"{tab} view · {var}"
def vcap(v):
    return "Photo of the kit, 13 Nov 2026" if is_photo(v) else "Illustration. Not to scale."
def dotnum(i): return re.sub(r"^[A-Z]+", "", i)
TITLE = "DDIL Kit Setup Guide"

spec = importlib.util.spec_from_file_location("content", SRC / "content.py")
C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)
HS = json.loads((SRC / "hotspots.json").read_text())
HS_BY_ID = {h["id"]: dict(h, view=v) for v, *_ in VIEWS for h in HS[v]}
e = html.escape


def image_file(view):
    for ext, mime in IMAGE_EXTS:
        p = ROOT / (IMAGES[view] + ext)
        if p.exists():
            return p, mime
    raise FileNotFoundError(f"no image for {view}: tried {IMAGES[view]}.png/.webp/.jpg")


# ------------------------------------------------------------------ text helpers
def subst(s):
    return s.replace("{UNC}", C.UNC).replace("{DOC}", C.DOC).replace("{USER}", C.USER)

def fills(s, interactive):
    def rep(m):
        fid, label = m.group(1), m.group(2)
        if interactive:
            return (f'<input class="fill" type="text" data-fill="{e(fid)}" placeholder="confirm on kit: {e(label)}" style="width:{len(label) + 19}ch" '
                    f'aria-label="Confirm on kit: {e(label)}">')
        return f'<span class="blank">confirm on kit: {e(label)} ________</span>'
    return re.sub(r"\[\[fill:([\w-]+):([^\]]+)\]\]", rep, s)

def rich(s, interactive=True):
    return fills(subst(s), interactive)

def h2(a, b):
    return f'{e(a)} <span class="hl">{e(b)}</span>'

ICONS = {
    "power": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8zM12 18v4"/></svg>',
    "eth": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16v10h-4v3H8v-3H4z"/><path d="M8 9v3M11 9v3M14 9v3M17 9v3" stroke-width="1.2"/></svg>',
    "hdmi": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8h18v5l-3 3H6l-3-3z"/><path d="M7 11h10" stroke-width="1.2"/></svg>',
    "usbc": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="9" width="16" height="6" rx="3"/><path d="M8 12h8" stroke-width="1.2"/></svg>',
    "usba": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="8" width="16" height="8"/><path d="M7 11h4v2H7zM13 11h4v2h-4z" stroke-width="1"/></svg>',
    "tablet": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/></svg>',
    "kvm": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="8" y="8" width="8" height="6"/></svg>',
    "key": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/></svg>',
    "Power": None, "Ethernet": None,
}
CABLE_ICON = {"Power": "power", "Ethernet": "eth", "HDMI": "hdmi", "USB-C power": "usbc", "USB Type-A": "usba"}


# ------------------------------------------------------------------ derived maps
def all_steps():
    out = {}
    for st in C.STEPS:
        out[st["id"]] = {"num": st["num"], "title": st["title"], "hs": st["hs"], "callouts": st["callouts"], "sec": "steps"}
    for i, st in enumerate(C.PACKDOWN, 1):
        out[st["id"]] = {"num": f"P{i}", "title": st["title"], "hs": st["hs"], "callouts": st["callouts"], "sec": "pack"}
    for tid, dev, hs, *_ in C.TIMELINE:
        out[tid] = {"num": "T", "title": dev, "hs": hs, "callouts": {h: dev.split(":")[0] for h in hs}, "sec": "steps"}
    return out

STEPS = all_steps()

def hs_steps():
    out = {}
    for hid in HS_BY_ID:
        out[hid] = [sid for sid, st in STEPS.items() if hid in st["hs"] and st["num"] != "T"]
    return out

def data_js(A):
    hs = {v: HS[v] for v, *_ in VIEWS}
    imgs = {v: str(image_file(v)[0].relative_to(ROOT)) for v, *_ in VIEWS}
    m = {"components": C.COMPONENTS, "steps": STEPS, "hsSteps": hs_steps()}
    return ("/* Component map, confirm on your kit. Hotspot x/y are percent of the illustration box.\n"
            "   Source of truth: setup/src/hotspots.json (positions) and IMAGES in setup/build.py (files). */\n"
            f"window.DDIL_IMAGES = {json.dumps(imgs)};\n"
            f"window.DDIL_VIEWS = {json.dumps([{'key': k, 'tab': t, 'variant': vr} for k, t, vr in VIEWS])};\n"
            f"window.DDIL_HOTSPOTS = {json.dumps(hs, indent=1)};\n"
            f"window.DDIL_MAP = {json.dumps(m)};")


# ------------------------------------------------------------------ assets
def b64(path, mime):
    return f"data:{mime};base64," + base64.b64encode(Path(path).read_bytes()).decode()

def fonts_css():
    css = ["@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;"
           f"src:url({b64(BRAND / 'fonts/Inter-400.woff2', 'font/woff2')}) format('woff2')}}"]
    for w in (400, 500, 600, 700):
        css.append("@font-face{font-family:'IBM Plex Mono';font-style:normal;"
                   f"font-weight:{w};src:url({b64(BRAND / f'fonts/IBMPlexMono-{w}.woff2', 'font/woff2')}) format('woff2')}}")
    return "\n".join(css)

class Assets:
    def __init__(self, single, prefix=""):
        self.single, self.p = single, prefix
    def pimg(self, view):
        """Paged edition: flattened JPEG made from the transparent source (white page ground)."""
        return f"{self.p}img/print/{view}.jpg"
    def img(self, view):
        f, mime = image_file(view)
        return b64(f, mime) if self.single else self.p + str(f.relative_to(ROOT))
    def ref(self, name):
        f = ROOT / "img" / name
        return b64(f, "image/jpeg") if self.single else f"{self.p}img/{name}"
    def logo(self, kind="dark-ink"):
        f = ROOT / "assets/logos" / f"elastic-horizontal-{kind}.svg"
        return b64(f, "image/svg+xml") if self.single else f"{self.p}assets/logos/elastic-horizontal-{kind}.svg"


# ------------------------------------------------------------------ fragments
def hsref(ids):
    return "".join(f'<button type="button" class="hsref" data-hs="{i}" title="{e(HS_BY_ID[i]["label"])}">{i}</button>' for i in ids)

def cables_html(cables, interactive):
    if not cables:
        return ""
    rows = []
    for ty, a, b in cables:
        ic = ICONS.get(CABLE_ICON.get(ty, ""), "") or ""
        rows.append(f'<div class="cable"><div class="ty">{ic}{e(ty)}</div><div class="ends"><span>{rich(e(a) if "[[" not in a else a, interactive)}</span>'
                    f'<span class="to">to</span><span>{rich(e(b) if "[[" not in b else b, interactive)}</span></div></div>')
    return '<div class="cables">' + "".join(rows) + "</div>"

def step_card(st, num, interactive, rev=None, cmds=(), A=None):
    figs = " · ".join(st["hs"])
    show = (f'<button type="button" class="show" data-step="{st["id"]}" title="Show on the figure">Show {figs}</button>'
            if interactive else f'<span class="figrefs">{figs}</span>')
    ck = (f'<label class="ck"><input type="checkbox" data-step="{st["id"]}" data-sec="{STEPS[st["id"]]["sec"]}">'
          f'<span class="num">{num}</span><h3>{e(st["title"])}</h3></label>') if interactive else \
         f'<div class="ck"><span class="box"></span><span class="num">{num}</span><h3>{e(st["title"])}</h3></div>'
    revs = f'<span class="rev">Reverses step{"s" if "," in str(rev) else ""} {rev}</span>' if rev else ""
    cmd_html = ""
    for c, x in cmds:
        btn = '<button type="button" aria-label="Copy command">Copy</button>' if interactive else ""
        cmd_html += f'<div class="cmd"><code>{e(c)}</code>{btn}</div><div class="exp">{e(x)}</div>'
    return (f'<article class="step" id="{st["id"]}"><header>{ck}{revs}{show}</header><div class="bd">{rich(st["body"], interactive)}'
            f'{cables_html(st["cables"], interactive)}{cmd_html}<div class="see">{rich(st["see"], interactive)}</div>'
            f'{refs_html(st.get("refs"), A) if A else ""}{st.get("after", "")}</div></article>')

PHOTO_TAG = '<span class="tag src">Kit photo</span>'
SRC_TAG = {"unc": C.UNC, "doc": C.DOC, "user": C.USER, "repo": '<span class="tag src">Repo</span>', "photo": PHOTO_TAG}

def refs_html(refs, A):
    if not refs:
        return ""
    return '<div class="refs">' + "".join(
        f'<figure class="ref"><img src="{A.ref(f)}" alt="{e(cap)}"><figcaption>{e(cap)}</figcaption></figure>' for f, cap in refs) + "</div>"

def timeline_items(interactive, A):
    items = []
    for tid, dev, hs, what, src, photos in C.TIMELINE:
        ck = (f'<input type="checkbox" data-step="{tid}" data-sec="steps" aria-label="Seen: {e(dev)}">' if interactive
              else '<span class="box" style="width:12px;height:12px;border:1.2px solid #1D1E24;display:block"></span>')
        refs = hsref(hs) if interactive else " · ".join(hs)
        items.append(f'<li id="{tid}"><span class="dot"></span>{ck}<div><h4>{e(dev)} {SRC_TAG[src]} {refs}</h4>'
                     f'<p>{rich(what, interactive)}</p>{refs_html(photos, A)}</div></li>')
    return items

TL_HEAD = '<div class="th">Indicator lights and what you should see after master power</div>'

def timeline_html(interactive, A):
    return f'<div class="timeline" id="timeline">{TL_HEAD}<ol>{"".join(timeline_items(interactive, A))}</ol></div>'

def timeline_blocks(A):
    """Paged edition: one block per item so the timeline can break across sheets."""
    items = timeline_items(False, A)
    out = []
    for k, it in enumerate(items):
        top = TL_HEAD if k == 0 else ""
        style = "" if k == 0 else ' style="border-top:0"'
        out.append(f'<div class="timeline"{style}>{top}<ol>{it}</ol></div>')
    return out

RUNBOOK = {"index": "../docs/pdf/02-kit-configuration-runbook.pdf", "paged": "../../docs/pdf/02-kit-configuration-runbook.pdf"}

def after_html(where="index"):
    rows = "".join(f'<tr><td class="k">{e(a)}</td><td><code>{e(b)}</code></td></tr>' for a, b in C.AFTER["rows"])
    return (f'<div class="afterbox" id="after"><div class="k">{e(C.AFTER["title"])}</div>{C.AFTER["body"].replace("{RUNBOOK}", RUNBOOK[where])}'
            f'<table class="t">{rows}</table></div>')

def packing_html(interactive):
    rows = []
    for pid, icon, item, conn, src in C.PACKING:
        tag = {"user": C.USER, "photo": PHOTO_TAG}.get(src, C.UNC)
        if interactive:
            outb = f'<input type="checkbox" data-step="{pid}-out" data-sec="pack-out" aria-label="Out: {e(item)}">'
            inb = f'<input type="checkbox" data-step="{pid}-in" data-sec="pack-in" aria-label="Back in: {e(item)}">'
        else:
            outb = inb = '<span style="display:inline-block;width:12px;height:12px;border:1.2px solid #1D1E24"></span>'
        rows.append(f'<tr><td class="ic">{ICONS[icon]}</td><td><b>{e(item)}</b> {tag}<br><span style="color:var(--grey)">{rich(conn, interactive)}</span></td>'
                    f'<td class="cb">{outb}</td><td class="cb">{inb}</td></tr>')
    return ('<div class="tscroll"><table class="t pack"><tr><th style="width:36px"></th><th>Item and where it connects</th>'
            '<th style="text-align:center">Out</th><th style="text-align:center">Back in</th></tr>' + "".join(rows) + "</table></div>")

def trouble_html():
    rows = "".join(f'<tr><td>{e(a)}</td><td>{e(b)}</td><td>{e(c)}</td></tr>' for a, b, c in C.TROUBLE)
    return ('<div class="tscroll"><table class="t"><tr><th style="width:30%">Symptom</th><th style="width:30%">Likely cause</th>'
            '<th>Fix</th></tr>' + rows + '</table></div>')

SECTION_HEADS = {
    "pack-list": ("01", "What comes out of the case", ("What comes out of the case.", "And what stays in the kit."),
                  "Tick <b>Out</b> as you unpack and <b>Back in</b> as you stow. The JetKVM leads and the UniFi power lead stay in the kit and only change state. Tags show the source: Kit lead (the kit lead's steps), Kit photo (photos of 13 Nov 2026), Confirm on kit (likely but not recorded)."),
    "steps": ("02", "Out of the case to powered on", ("Out of the case.", "Seven steps to powered on."),
              "Follow the steps in order. Tap a step to light its parts on the figure; the pink rings and labels show exactly where each cable goes. Blanks marked confirm on kit are not recorded anywhere yet: fill them in once and they are saved in this browser."),
    "pack": ("03", "Pack-down", ("Pack-down.", "The same steps in reverse."),
             "Shut down the software first, then master power, then unplug in reverse order of steps 7 to 2, and lift the kit back into the case face down."),
    "trouble": ("04", "If something does not come up", ("If something does not come up.", "Check the cable first."),
                "Physical faults only. Software checks are in the kit configuration runbook."),
}

def head(key, interactive=True):
    num, eb, (a, b), intro = SECTION_HEADS[key]
    return (f'<div class="eyebrow{" or" if key == "trouble" else ""}">{num} · {e(eb)}</div><h2>{h2(a, b)}</h2>'
            f'<p class="intro">{intro}</p>')


# ------------------------------------------------------------------ interactive page
def legend(view):
    return "".join(f'<li data-hs="{h["id"]}"><b>{h["id"]}</b><span>{e(h["label"])}</span></li>' for h in HS[view])

def print_figs(A):
    out = ['<div class="printfigs">']
    for v, *_ in VIEWS:
        name = vtitle(v)
        dots = "".join(f'<span class="hs" style="left:{h["x"]}%;top:{h["y"]}%">{dotnum(h["id"])}</span>' for h in HS[v])
        rows = "".join(f'<tr><td class="k">{h["id"]}</td><td>{e(h["label"])}</td></tr>' for h in HS[v])
        src = f'src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-copy="{v}"' if A.single else f'src="{A.img(v)}"'
        out.append(f'<div class="pfig"><div><div class="fig"><div class="view on" style="position:relative">'
                   f'<img {src} alt="{name} view illustration">{dots}</div></div>'
                   f'<div class="cap">{name} · {vcap(v)}</div></div>'
                   f'<div><h3>{name}: legend</h3><table class="t"><tr><th>#</th><th>Part</th></tr>{rows}</table>'
                   f'<p style="font-size:10px;color:#69707D">Component map, confirm on your kit.</p></div></div>')
    out.append('</div><div class="pagebrk"></div>')
    return "".join(out)

def render_index(single):
    A = Assets(single)
    head_fonts = f"<style>{fonts_css()}</style>" if single else '<link rel="stylesheet" href="../brand/tokens.css">'
    rail_items = [("pack-list", "01", "Out of the case: items", "pack-out"),
                  ("steps", "02", "Seven steps", "steps"),
                  ("pack", "03", "Pack-down", "pack"),
                  ("trouble", "04", "Troubleshooting", "")]
    rail = "".join(f'<li><a href="#{a}" data-sec="{s}"><span class="n">{n}</span><span>{e(t)}</span><span class="c"></span></a></li>'
                   for a, n, t, s in rail_items)
    tabs = "".join(f'<button type="button" role="tab" data-tab="{t.lower()}" aria-selected="false">{t}<span class="badge"></span></button>' for _, t in MAIN_VIEWS)
    variants = "".join(
        f'<div class="variants" data-tab="{t.lower()}">' + "".join(
            f'<button type="button" data-view="{k}" aria-pressed="false">{e(vr)}<span class="vb"></span></button>'
            for k, tt, vr in VIEWS if tt == t) + "</div>" for _, t in MAIN_VIEWS)
    views = "".join(
        f'<div class="view{" photo" if is_photo(v) else ""}" data-view="{v}"><div class="vtitle">{e(vtitle(v))}</div><div class="stage" style="position:relative">'
        f'<img src="{A.img(v)}" alt="{e(vtitle(v))}: {"photo of the DDIL kit" if is_photo(v) else "pencil illustration of the DDIL kit"}"></div></div>'
        for v, *_ in VIEWS)
    legends = "".join(f'<ul class="legend" data-view="{v}">{legend(v)}</ul>' for v, *_ in VIEWS)

    steps_html = []
    for st in C.STEPS:
        steps_html.append(step_card(st, st["num"], True, A=A))
        if st["id"] == "s6":
            steps_html.append(timeline_html(True, A))
    steps_html.append(after_html())
    pack_html = [step_card(st, f"P{i}", True, st.get("rev"), st.get("cmds", ()), A) for i, st in enumerate(C.PACKDOWN, 1)]

    secs = (f'<section class="sec" id="pack-list">{head("pack-list")}{packing_html(True)}</section>'
            f'<section class="sec" id="steps">{head("steps")}{"".join(steps_html)}</section>'
            f'<section class="sec" id="pack">{head("pack")}{"".join(pack_html)}</section>'
            f'<section class="sec" id="trouble">{head("trouble")}{trouble_html()}</section>')
    css = (SRC / "guide.css").read_text()
    js = (SRC / "guide.js").read_text()
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{TITLE}</title>
{head_fonts}
<style>
{css}
</style>
</head>
<body>
<div class="topbar"><div class="in">
  <img src="{A.logo()}" alt="Elastic" width="90" height="30">
  <span class="t">DDIL kit · setup and pack-down · 13 Nov 2026</span>
  <span class="sp"></span>
  <span class="prog" id="prog">0 / 0</span>
  <button type="button" class="btn" data-action="reset">Reset checklist</button>
  <button type="button" class="btn pri" data-action="print">Print</button>
</div><div class="bar"><i id="bar"></i></div></div>

<header class="hero">
  <div class="eyebrow">DDIL demo kit · SA enablement · Physical setup</div>
  <h1>Out of the case. <span class="hl">Powered on in seven steps.</span></h1>
  <p class="lead">Lift the kit out, seat the JetKVM, plug in the cables, switch on master power and join the kit network. Then reverse it to pack down. Tap any step to see exactly where each cable goes on the drawings.</p>
  <div class="meta">
    <span class="chip">Status as of 13 Nov 2026</span>
    <span class="chip">Steps from the kit lead</span>
    <span class="chip">Component map, confirm on your kit</span>
    <span class="chip">Illustrations. Not to scale.</span>
  </div>
</header>

{print_figs(A)}

<div class="layout">
  <nav class="rail" aria-label="Progress">
    <div class="k">Progress</div>
    <ol>{rail}</ol>
    <div class="tot"><b id="railtot">0%</b>of checkboxes ticked</div>
    <button type="button" class="btn" data-action="reset">Reset checklist</button>
  </nav>

  <main class="main">
    {secs}
  </main>

  <aside class="viewer" aria-label="Kit illustrations">
    <div class="card">
      <div class="tabs" role="tablist">{tabs}</div>
      {variants}
      <div class="fig" id="fig">{views}<div class="tip" id="tip" role="dialog" aria-live="polite"></div></div>
      <div class="cap"><span id="figname">Front view</span><span id="figcap">Illustration. Not to scale.</span></div>
      <div class="hint">Hover or tap a number. Tap a step to light its parts. <button type="button" class="clear" id="clearhl">Clear highlight</button></div>
      {legends}
    </div>
  </aside>
</div>

<footer class="src">
  <img src="{A.logo()}" alt="Elastic" width="80" height="27">
  <span>Steps from the kit lead, 13 Nov 2026. Supporting facts from enablement/FACTS.md (commit 5114c3a), docs runbook 02, 01-HARDWARE-INVENTORY.md, 05-NETWORK-CONFIG.md and the kiosk notes. The illustrations are drawings, not photographs; positions on them are a component map to confirm on your kit. Software checks: <a href="../docs/pdf/02-kit-configuration-runbook.pdf">kit configuration runbook</a>.</span>
</footer>

<script>
{data_js(A)}
</script>
<script>
{js}
/* print figures reuse the viewer images (the single-file build stores each image once) */
Array.prototype.forEach.call(document.querySelectorAll('img[data-copy]'), function (im) {{
  var src = document.querySelector('.viewer .view[data-view="' + im.getAttribute('data-copy') + '"] img');
  if (src) im.src = src.src;
}});
</script>
</body>
</html>
"""


# ------------------------------------------------------------------ paginated print edition
PAGED_CSS = """
@page { size: letter; margin: 0; }
.page{width:8.5in;height:11in;padding:0.55in 0.75in 0.8in;overflow:hidden;break-after:page;position:relative;background:#fff}
.page:last-child{break-after:auto}
@media screen{ body{background:#E3E7EE} .page{margin:0 auto 32px;box-shadow:0 4px 24px rgba(0,0,0,.15)} }
body{font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rh{display:flex;justify-content:space-between;align-items:center;font:500 9px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--grey-l);padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:18px}
.pf{position:absolute;left:0.75in;right:0.75in;bottom:0.32in;height:22px;display:flex;align-items:center;justify-content:space-between;font:500 9px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--grey-l)}
.pf img{width:72px;height:24px;display:block}
.blk{margin-bottom:12px}
.blk.tl{margin-bottom:0}
.blk.tl .timeline{border-bottom:0}
.blk h2{font-weight:600;font-size:22px;line-height:1.12;letter-spacing:-.6px;margin:7px 0 7px}
.blk .intro{font-size:12px;line-height:1.5;color:var(--char);margin-bottom:4px}
.blk table.t{font-size:10.5px;margin:2px 0 4px}
.blk table.t th{font-size:8.8px;padding:5px 6px}
.blk table.t td{padding:4px 6px}
.blk table.t td.k{font-size:10px;white-space:normal}
.blk table.t code{font-size:9.5px}
table.pack .ic svg{width:18px;height:18px}
.step{box-shadow:none;margin:0}
.step header{padding:6px 10px;align-items:center}
.step .ck{display:flex;gap:9px;align-items:center}
.step .box{width:13px;height:13px;border:1.3px solid var(--ink);flex:none}
.step h3{font-size:13px}
.step .figrefs{font:600 9.5px var(--mono);color:var(--blue);white-space:nowrap;margin-left:8px}
.step .bd{padding:7px 10px 8px}
.step .bd p{font-size:11.5px;line-height:1.48;margin-bottom:5px}
.cmd{box-shadow:none;margin:5px 0 1px}
.cmd code{font-size:9.6px;padding:5px 9px;line-height:1.5}
.exp{font-size:10.8px;padding:2px 0 3px 10px;margin:2px 0 5px}
.see{font-size:11px;padding:5px 8px;margin-top:4px}
.cable{font-size:11px;padding:3px 0;grid-template-columns:110px 1fr}
.cable .ty{font-size:9.5px}
.cable .ty svg{width:15px;height:15px}
.timeline,.afterbox{box-shadow:none;margin:0}
.timeline li{padding:5px 0;grid-template-columns:18px 20px 1fr}
.timeline li h4{font-size:12px}
.timeline li p{font-size:11px}
.afterbox p{font-size:11.5px}
.tag{font-size:8.4px;padding:1px 5px}
.blank{font-size:9.5px}
code{font-size:.88em}
.cover{padding:0;display:flex;flex-direction:column}
.cover .top{padding:0.7in 0.75in 0 0.75in;flex:1}
.cover h1{font-weight:600;font-size:40px;line-height:1.06;letter-spacing:-1.4px;margin-top:16px}
.cover .sub{font-size:15px;line-height:1.5;color:var(--char);margin-top:14px;max-width:600px}
.cover .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.cover .chip{font-size:10px;padding:5px 9px}
.cover .fig3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:22px}
.cover .fig3 img{width:100%;height:auto;display:block;filter:none}
.cover .fig3 .c{font:500 9px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--grey);margin-top:5px;border-top:1px solid var(--ink);padding-top:5px}
.cover .band{background:var(--blue);color:#fff;padding:0.36in 0.75in 0.4in;display:grid;grid-template-columns:1.2fr 1fr;gap:28px}
.cover .band .k{font:600 9.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:#CFE0FA;margin-bottom:8px}
.cover .band p,.cover .band li{color:#fff;font-size:11px;line-height:1.5}
.cover .band ol{margin-left:16px}
.cover .band img{width:120px;height:40px;display:block;margin-top:14px}
.figpage{display:grid;grid-template-columns:400px 1fr;gap:22px;align-items:start}
.figpage .fig{position:relative;border-bottom:1px solid var(--ink)}
.figpage .fig img{display:block;width:100%;height:auto;filter:none}
.figpage .hs{width:22px;height:22px;font-size:9.5px;box-shadow:0 0 0 1px var(--ink)}
.figpage .cap{font:500 9px var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-top:6px}
.figpage h3{font-size:14px;margin:0 0 6px}
.figpage table.t{font-size:10.5px}
.figpage table.t td{padding:4px 6px}
.figpage .note{font-size:10.5px;color:var(--grey);margin-top:8px;line-height:1.45}
.rule{width:64px;height:3px;background:var(--teal);margin:6px 0 10px}
"""

def paged_head(measure=False):
    link = '' if measure else '<link rel="stylesheet" href="../../brand/tokens.css">'
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{TITLE}</title>
{link}
<style>
{fonts_css()}
{(SRC / 'guide.css').read_text()}
{PAGED_CSS}
</style></head><body>"""

def flow_blocks(A):
    """(kind, html, density weight) in reading order. Weight mirrors the preflight density score."""
    B = []
    B.append(("head", f'<div class="blk">{head("pack-list", False)}</div>', 1))
    B.append(("extra", f'<div class="blk">{packing_html(False)}</div>', 2))
    B.append(("head", f'<div class="blk">{head("steps", False)}</div>', 1))
    for st in C.STEPS:
        B.append(("step", f'<div class="blk">{step_card(st, st["num"], False, A=A)}</div>', 0))
        if st["id"] == "s6":
            for k, tb in enumerate(timeline_blocks(A)):
                B.append(("step", f'<div class="{"blk" if k == len(C.TIMELINE) - 1 else "blk tl"}">{tb}</div>', 0))
    B.append(("step", f'<div class="blk">{after_html("paged")}</div>', 2))
    B.append(("head", f'<div class="blk">{head("pack", False)}</div>', 1))
    for i, st in enumerate(C.PACKDOWN, 1):
        B.append(("step", f'<div class="blk">{step_card(st, f"P{i}", False, st.get("rev"), st.get("cmds", ()), A)}</div>', 0))
    B.append(("head", f'<div class="blk">{head("trouble", False)}</div>', 1))
    B.append(("extra", f'<div class="blk">{trouble_html()}</div>', 2))
    return B

def measure(blocks):
    body = "".join(f'<div class="mblk">{b}</div>' for _, b, _ in blocks)
    script = """<script>document.fonts.ready.then(function(){setTimeout(function(){
var d=[];document.querySelectorAll('.mblk').forEach(function(el){d.push(Math.ceil(el.getBoundingClientRect().height));});
document.body.setAttribute('data-h',JSON.stringify(d));},400);});</script>"""
    doc = paged_head(measure=True) + f'<div style="width:672px">{body}</div>{script}</body></html>'
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, dir=ROOT / "print") as f:
        f.write(doc); tmp = f.name
    try:
        r = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--dump-dom",
                            "--virtual-time-budget=6000", f"file://{tmp}"], capture_output=True, text=True, timeout=60)
    finally:
        os.unlink(tmp)
    m = re.search(r'data-h="([^"]+)"', r.stdout)
    if not m:
        raise RuntimeError("block measurement failed")
    return json.loads(m.group(1).replace("&quot;", '"'))

def paginate(blocks, heights, budget=860, max_weight=5):
    pages, cur, used, weight = [], [], 0, 0
    for i, (kind, b, w) in enumerate(blocks):
        h = heights[i]
        need = h + (heights[i + 1] if kind == "head" and i + 1 < len(blocks) else 0)
        if cur and (used + need > budget or weight + w > max_weight):
            pages.append(cur); cur, used, weight = [], 0, 0
        cur.append(b); used += h; weight += w
    if cur:
        pages.append(cur)
    return pages

FIG_NOTES = {
    "front": "Set-up state. Top to bottom: a blank strip, the touchscreen, two blank panels over the Framework Desktop, the DGX Spark, a row with the JetKVM and the UniFi Express 7, a row with the Switch Flex Mini, and the PDU with the master power switch. Handles on top.",
    "front-packed": "Transport state. The touchscreen is off and the JetKVM is out of its bay. Three leads hang from the empty bay: USB-C, USB-A and RJ45 Ethernet. The UniFi Express 7 USB-C power lead is unplugged and hangs to the lower row. An Elastic sticker sits under the touchscreen and the DGX Spark carries the NVIDIA logo.",
    "front-photo": "Photo of the kit, 13 Nov 2026. The PDU rocker glows red when on. The Switch Flex Mini shows a blue status LED next to its USB-C power lead.",
    "back": "Top to bottom: a metal grate, the Framework Desktop rear I/O and its Flex ATX PSU, the DGX Spark rear ports and cables, two lower grates, and a bottom unit. The mains cable leaves at the rear bottom right.",
    "back-photo": "Photo of the kit, 13 Nov 2026. Framework rear I/O from the left: HDMI, two USB-C, two USB-A, RJ45, a blue USB-A and an audio jack. The black mains cable exits at the rear bottom right.",
    "side": "Front at left, rear at right. Glass side panel, cables running up the rear post, handle on top. Lift by the handle and the rear grate.",
}

def fig_page(A, v, name=None):
    name = vtitle(v)
    dots = "".join(f'<span class="hs" style="left:{h["x"]}%;top:{h["y"]}%">{dotnum(h["id"])}</span>' for h in HS[v])
    rows = "".join(f'<tr><td class="k">{h["id"]}</td><td>{e(h["label"])}</td></tr>' for h in HS[v])
    kind = "Photo" if is_photo(v) else "Illustration"
    return (f'<div class="eyebrow">{kind} · {e(name)}</div><h2 style="font-size:22px;margin:8px 0 14px">'
            f'{e(name)}. <span class="hl">Component map, confirm on your kit.</span></h2>'
            f'<div class="figpage"><div><div class="fig"><img src="{A.pimg(v)}" alt="{e(name)}">{dots}</div>'
            f'<div class="cap">{vcap(v)}</div></div>'
            f'<div><h3>Legend</h3><div class="rule"></div><table class="t"><tr><th>#</th><th>Part</th></tr>{rows}</table>'
            f'<p class="note">{FIG_NOTES[v]}</p></div></div>')

def make_print_images():
    """Flatten each view onto white for the paged PDF (keeps the PDF small; drop shadows rasterise)."""
    try:
        from PIL import Image
    except ImportError:
        print("  PIL not available: keeping existing img/print/*.jpg")
        return
    (ROOT / "img/print").mkdir(exist_ok=True)
    for v, *_ in VIEWS:
        f, _ = image_file(v)
        im = Image.open(f).convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
        bg = bg.convert("RGB"); bg = bg.resize((900, round(900 * bg.height / bg.width)), Image.LANCZOS)
        bg.save(ROOT / "img/print" / f"{v}.jpg", quality=78)

def render_paged():
    make_print_images()
    A = Assets(False, prefix="../")
    blocks = flow_blocks(A)
    flow = paginate(blocks, measure(blocks))
    covers = "".join(f'<div><img src="{A.pimg(v)}" alt="{n} view"><div class="c">{n} view</div></div>' for v, n in MAIN_VIEWS)
    steps_list = "".join(f'<li><b>{s["num"]}</b> {e(s["title"])}</li>' for s in C.STEPS)
    pages = [f"""<div class="page cover"><div class="top">
<div class="eyebrow">DDIL demo kit · SA enablement · Physical setup</div>
<h1>Out of the case. <span class="hl">Powered on in seven steps.</span></h1>
<p class="sub">Unpack, cable, power on and join the kit network, then reverse it to pack down. Printed edition of <span class="m">setup/index.html</span>. Fill in each "confirm on kit" blank by hand.</p>
<div class="meta"><span class="chip">Status as of 13 Nov 2026</span><span class="chip">Steps from the kit lead</span><span class="chip">Illustrations. Not to scale.</span></div>
<div class="fig3">{covers}</div></div>
<div class="band"><div><div class="k">The seven steps</div><ul style="list-style:none;margin-left:0">{steps_list}</ul></div>
<div><div class="k">Read with care</div><p>The illustrations are drawings. Numbered positions are a component map: confirm each one on your kit. Software checks after power-on are in the kit configuration runbook.</p>
<img src="{A.logo('white')}" alt="Elastic" width="120" height="40"></div></div></div>"""]
    for v, *_ in VIEWS:
        pages.append(f'<div class="page"><div class="rh"><span>DDIL kit · setup guide</span><span>{e(vtitle(v))}</span></div>{fig_page(A, v)}<!--foot--></div>')
    for blks in flow:
        pages.append(f'<div class="page"><div class="rh"><span>DDIL kit · setup guide</span><span>Setup and pack-down</span></div>{"".join(blks)}<!--foot--></div>')
    total = len(pages)
    out = [p.replace("<!--foot-->", f'<div class="pf"><img src="{A.logo()}" alt="Elastic" width="72" height="24">'
                                    f'<span>DDIL kit · setup guide · Page {n} of {total}</span></div>')
           for n, p in enumerate(pages, 1)]
    return paged_head() + "\n".join(out) + "</body></html>", total


# ------------------------------------------------------------------ main
def main(argv):
    (ROOT / "print").mkdir(exist_ok=True); (ROOT / "pdf").mkdir(exist_ok=True)
    (ROOT / "index.html").write_text(render_index(False), encoding="utf-8")
    (ROOT / "ddil-setup-guide.html").write_text(render_index(True), encoding="utf-8")
    print("index.html, ddil-setup-guide.html written")
    if "--no-pdf" in argv:
        return 0
    doc, pages = render_paged()
    pth = ROOT / "print" / "ddil-setup-guide-print.html"
    pth.write_text(doc, encoding="utf-8")
    print(f"print/ddil-setup-guide-print.html: {pages} pages")
    r = subprocess.run([sys.executable, str(SCRIPTS / "preflight.py"), str(pth)], capture_output=True, text=True)
    flagged = [l.strip() for l in r.stdout.splitlines() if "[ERROR]" in l or "[WARN" in l or "[INFO" in l or "→" in l]
    print("preflight:", "PASS" if r.returncode == 0 else "FAIL", *flagged, sep="\n  ")
    if r.returncode:
        return 1
    r = subprocess.run([sys.executable, str(SCRIPTS / "pdf_verify.py"), str(pth), "--expected", str(pages)],
                       capture_output=True, text=True)
    print("pdf_verify:", "PASS" if r.returncode == 0 else "FAIL")
    if r.returncode:
        print(r.stdout)
    built = pth.with_suffix(".pdf")
    if built.exists():
        (ROOT / "pdf" / "ddil-setup-guide.pdf").write_bytes(built.read_bytes())
        built.unlink()
        print("pdf/ddil-setup-guide.pdf written")
    return r.returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
