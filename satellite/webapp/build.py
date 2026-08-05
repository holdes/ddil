#!/usr/bin/env python3
"""
build.py - assemble the CubeSat mission console into one self-contained page.

The operational picture IS the application. It fills the viewport, pans and
zooms, and every tracked entity in it is a control: hover one and its HUD
brackets light, click it and the view flies to it while a drawer opens with
everything known about that entity. All the other work - the 3D vehicle, the
drawings, the pinout, the bench guide, the power topology - lives behind the
thing in the drawing it belongs to, rather than in a list of pages.

Sources:

  comms/operational-picture-light.svg   the stage
  comms/satellite-explorer.html         3D vehicle, behind CUBESAT-1U
  satellite/diagrams/satellite-topology.svg  power + data, behind LINK & TRANSPORT
  cubesat-pinout.html, bench-guide.html      standalone pages, re-scoped
  cad/renders/blueprints/                    17 drawings taken off the meshes

Hotspots are not hand-placed. Each section of the drawing is tagged at build
time, and at runtime getBBox() gives its true bounds - so if the drawing is
edited, the controls move with it.

Run:  python3 build.py  ->  ./cubesat.html
"""
import base64
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SAT = os.path.dirname(HERE)
DDIL = os.path.dirname(SAT)
CAD = os.path.join(SAT, "cad")
BP = os.path.join(CAD, "renders", "blueprints", "web")
COMMS = os.path.join(DDIL, "comms")
SCRATCH = ("/private/tmp/claude-501/-Users-bholden-Desktop/"
           "96b442fb-8cba-43ba-bf48-52d2ff92dedd/scratchpad")

EXPLORER_SLOT = "@@EXPLORER_SRCDOC@@"


# ---------------------------------------------------------------- ported pages

def slice_file(path, style, body, script):
    """Pull the three regions out of a standalone page by line number."""
    L = open(path, encoding="utf-8").read().split("\n")
    cut = lambda r: "\n".join(L[r[0] - 1:r[1]])
    return cut(style), cut(body), cut(script)


BENCH_CSS, BENCH_BODY, _ = slice_file(
    os.path.join(SCRATCH, "bench-guide.html"), (3, 96), (98, 761), (763, 793))
PIN_CSS, PIN_BODY, PIN_JS = slice_file(
    os.path.join(SCRATCH, "cubesat-pinout.html"), (3, 94), (97, 133), (136, 293))


# The bench page's script is vestigial: it drew the 40-pin header, that diagram
# became static SVG, and its #odd / #even targets went with it. Left in, it
# throws on every load. Nothing on that sheet is interactive, so it is dropped.
#
# That diagram also printed on top of itself - each row drew BOTH destinations
# of a pin pair at the same y, so "PCA9685 VCC" (pin 1) landed on "PCA9685
# screw +" (pin 2). Rows are 32 px apart, so dropping the second label of each
# pair by 14 px separates them inside its own band.
def _unstack(body):
    seen = {}

    def fix(m):
        y = int(m.group(1))
        seen[y] = seen.get(y, 0) + 1
        return f'y="{y + 14}"' if seen[y] > 1 else m.group(0)

    return re.sub(r'(?<=<text x="905" )y="(\d+)"', fix, body)


BENCH_BODY = _unstack(BENCH_BODY)


# ------------------------------------------------------------------ the stage

def namespace_svg(svg, prefix):
    """
    Prefix every id in an inline SVG, and every url(#...) that refers to one.

    Inline SVG shares the host document's id space. The operational picture
    defines <pattern id="grid">, and the pinout page has <div id="grid"> - so
    getElementById('grid') was returning the SVG pattern and the pinout was
    quietly appending 20 rows of header into it.
    """
    svg = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{prefix}{m.group(1)}"', svg)
    svg = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{prefix}{m.group(1)})", svg)
    return svg


OPS = open(os.path.join(COMMS, "operational-picture-light.svg"),
           encoding="utf-8").read()
OPS = re.sub(r"^\s*<\?xml[^>]*\?>\s*", "", OPS)   # goes inline, not standalone

# The drawing has telemetry and commands the wrong way round. Three independent
# sources agree: telemetry is 5013, commands are 5012 - pisat_sim.py, the Zeek
# analyzer header, and the dst_port fields in the ground-station logs.
OPS = OPS.replace("TM &#183; CCSDS 5012", "@@TM@@").replace("TM · CCSDS 5012", "@@TM@@")
OPS = OPS.replace("TC &#183; UPLINK 5013", "TC · UPLINK 5012").replace(
    "TC · UPLINK 5013", "TC · UPLINK 5012")
OPS = OPS.replace("@@TM@@", "TM · CCSDS 5013")

# Tag each section group so the runtime can find it. The comment above each
# group is the anchor; the id goes on the <g> that follows it.
NODES = [
    ("TRK-001 &#183; CUBESAT", "cubesat"),
    ("TRK-002 &#183; GROUND STATION", "dish"),
    ("ORBITAL PICTURE", "orbital"),
    ("TRK-003 &#183; EDGE HUB", "edgehub"),
    ("OPERATOR AT CONSOLE", "operator"),
    ("TRK-002b &#183; 4U GROUND STATION RACK", "rack"),
    ("RIGHT RAIL &#183; DETECTION", "detection"),
    ("LEFT RAIL &#183; LINK", "linkrail"),
    ("THREAT COVERAGE MATRIX", "sparta"),
]
for _marker, _key in NODES:
    _plain = _marker.replace("&#183;", "·")
    _pat = re.compile(r"(<!--[^>]*?" + re.escape(_plain) + r"[^>]*?-->\s*<g)")
    OPS, _n = _pat.subn(lambda m: m.group(1) + f' data-node="{_key}"', OPS, count=1)
    if not _n:
        raise SystemExit(f"could not tag section {_key!r} - marker not found")

# The link vectors already carry a dasharray; giving them a class lets the
# stylesheet run packets along them.
OPS = OPS.replace('stroke-dasharray="14 10"', 'stroke-dasharray="14 10" class="flow"')
OPS = OPS.replace('stroke-dasharray="10 8"', 'stroke-dasharray="10 8" class="flow slow"')

OPS = namespace_svg(OPS, "ops-")
OPS = OPS.replace("<svg ", '<svg id="stage" preserveAspectRatio="xMidYMid meet" ', 1)


# ------------------------------------------------------- topology, recoloured

TOPO_MAP = {
    "#fef3c7": "#FBF3E3", "#b45309": "#A16207", "#78350f": "#6B4A0B",  # power
    "#e0e7ff": "#E8EFFB", "#4338ca": "#0B64DD", "#1e1b4b": "#10336B",  # compute
    "#dbeafe": "#EDF4FE", "#1d4ed8": "#1E6FD9", "#172554": "#123A6B",  # bus
    "#dcfce7": "#E7F5EE", "#15803d": "#147D57", "#052e16": "#0C4A32",  # actuation
    "#fce7f3": "#FCE9F1", "#be185d": "#D6206E", "#500724": "#7A1240",  # lighting
    "#ede9fe": "#F0EEFA", "#6b21a8": "#6B3FA0", "#2e1065": "#3A1E6B",  # ground
    "#333333": "#6A7183", "#ffffde": "#FFFFFF", "#000000": "#1C1E23",
    "#333": "#1C1E23",
}
TOPOLOGY = open(os.path.join(SAT, "diagrams", "satellite-topology.svg"),
                encoding="utf-8").read()
for _k, _v in TOPO_MAP.items():
    TOPOLOGY = TOPOLOGY.replace(_k, _v)
TOPOLOGY = TOPOLOGY.replace(".edgeLabel{", ".edgeLabel{color:#1C1E23;")
TOPOLOGY = namespace_svg(TOPOLOGY, "topo-")


# ------------------------------------------------------------------ drawings

SHEETS = [
    ("deck_b", "Deck B", "Avionics deck",
     "The busiest plate in the satellite. Camera bracket, both servo brackets and "
     "the Pi carrier all land here, and the two long slots are the wing pass-throughs."),
    ("deck_a", "Deck A", "Sensor deck",
     "PCA9685 foam-taped at (0, -25), sensors on the Qwiic chain. The 10 mm hole "
     "grid is what makes placement a decision rather than a commitment."),
    ("pi_carrier", "Pi carrier", "Adapter plate",
     "Eight holes and nothing else. Four M2.5 for the Pi, two M3 shared with the "
     "servo bracket bolts, two M2.5 into deck B's only free holes."),
    ("servo_bracket", "Servo bracket", "MG90S, vertical",
     "The servo drops in from outboard, so a wing can come off without disturbing "
     "the deck. Printed twice, mirrored."),
    ("camera_bracket", "Camera bracket", "Arducam UC-261",
     "Holds the OV5647 square to the camera panel's lens bore."),
    ("wing_panel", "Wing", "Solar-panel analogue",
     "80 mm, feathers about its own axis rather than deploying - a rotation reads "
     "from across a room and cannot jam."),
    ("wing_root_hub", "Wing root hub", "Double-ended horn",
     "Captures the servo horn on one side and the wing on the other."),
    ("panel_camera_lower", "Camera panel, lower", "Elastic glyph",
     "The satellite's one uninterrupted outer surface. The CUBESAT v1.0 wordmark "
     "was removed on 4 Aug - the glyph alone reads cleaner at this size."),
    ("panel_camera_upper", "Camera panel, upper", "Lens bore",
     "Split at deck B so the lower half can come off without pulling the camera."),
    ("panel_ports_upper", "Ports panel, upper", "55 x 12 aperture",
     "One rectangular cutout for every port, 34 mm above deck B."),
    ("panel_ports_lower", "Ports panel, lower", "Blank half",
     "The other side of the ports split."),
    ("panel_wing_pass_upper", "Wing-pass panel, upper", "Rotation clearance",
     "The wing turns through this face, so the aperture is a sweep, not a hole."),
    ("panel_wing_pass_lower", "Wing-pass panel, lower", "Rotation clearance", ""),
    ("cap_diffuser", "Cap + diffuser", "12 SK9822",
     "A 1.2 mm membrane over the LED seat. Thin enough to glow, thick enough to "
     "print without support."),
    ("pedestal_base", "Pedestal base", "Display stand",
     "150 mm square with a 20 degree socket. The socket was measured off the "
     "printed part, not the model."),
    ("pedestal_post_tube", "Post tube", "Bevelled both ends",
     "Both ends are cut square to world-up, not to the tube - which is why the "
     "bevels rotate by minus the tilt."),
    ("pedestal_post_plate", "Post plate", "Qi coil + join socket",
     "Thickened 6 to 9 mm so the coil pocket and the join socket both fit in one "
     "plate without meeting in the middle."),
]


def img(name):
    with open(os.path.join(BP, f"{name}.png"), "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


CARDS = "\n".join(f"""
  <figure class="bp" tabindex="0" data-title="{t}">
    <div class="bp-img"><img src="{img(n)}" alt="Orthographic drawing of {t}" loading="lazy"></div>
    <figcaption><h4>{t}</h4><span class="bp-sub">{s}</span>
      {f'<p>{d}</p>' if d else ''}<code>stl/{n}.stl</code></figcaption>
  </figure>""" for n, t, s, d in SHEETS)


# ------------------------------------------------------------ drawer contents

STATUS_ROWS = [
    ("Frame, decks, brackets", "ok", "FITTED", "All 17 parts printed and assembled."),
    ("Wings, both servos", "ok", "PROVEN",
     "&plusmn;45&deg; sweeps freely with no mechanical fouling. Both move together "
     "when eased; a 37-move stepped sweep held <code>throttled=0x0</code>."),
    ("PCA9685 driver", "ok", "PROVEN",
     "Answers at <code>0x40</code> on software bus 3. <code>VCC</code> is chip "
     "logic; the servos are fed from the screw terminal, a separate supply."),
    ("SK9822, 12 LEDs", "ok", "PROVEN",
     "All 12 addressed. 3.3&nbsp;V logic direct &mdash; no level shifter."),
    ("Pedestal", "ok", "FITTED",
     "Base, tube and plate. Both joints snug; comes apart for transport, no glue."),
    ("BME280", "no", "DEAD",
     "Powered, LED on, no acknowledgement at <code>0x76</code> or <code>0x77</code>. "
     "Replacement is a keyed Qwiic plug swap onto the proven chain."),
    ("Camera UC-261", "no", "BLOCKED",
     "CSI ribbon latch broke mechanically. The telemetry packet carries a "
     "<code>CameraAvailable</code> flag for exactly this case."),
    ("Modulino IMU", "wait", "UNTESTED",
     "Would settle whether SDA and SCL reach through the soldered chain. Power is "
     "already proven end to end."),
    ("Flight agent", "wait", "TO WRITE",
     "Unblocked. Framing, field layouts, ports and byte-verified reference packets "
     "are all local."),
]
STATUS = "\n".join(
    f'<tr><td>{a}</td><td><span class="pill {c}">{p}</span></td><td>{e}</td></tr>'
    for a, c, p, e in STATUS_ROWS)

PACKET_ROWS = [
    ("0", "2", "CCSDS_STREAMID", "BIG", "0x09AA"),
    ("2", "2", "CCSDS_SEQUENCE", "BIG", "0xC000"),
    ("4", "2", "CCSDS_LENGTH", "BIG", "85"),
    ("6", "4", "CCSDS_SECONDS", "BIG", "300"),
    ("10", "2", "CCSDS_SUBSECS", "BIG", "0"),
    ("12", "4", "CCSDS_SPARE", "LITTLE", "0"),
    ("16", "&hellip;", "body", "LITTLE", "&mdash;"),
]
PACKET = "\n".join(
    f"<tr><td>{o}</td><td>{s}</td><td>{f}</td><td>{e}</td><td>{v}</td></tr>"
    for o, s, f, e, v in PACKET_ROWS)


def panel(key, trk, title, sub, tabs):
    """tabs: list of (label, html). One tab renders without a tab strip."""
    strip = ""
    if len(tabs) > 1:
        strip = '<div class="tabs" role="tablist">' + "".join(
            f'<button role="tab" data-tab="{i}" aria-selected="{str(i == 0).lower()}">{lbl}</button>'
            for i, (lbl, _) in enumerate(tabs)) + "</div>"
    panes = "".join(
        f'<div class="pane" data-pane="{i}"{"" if i == 0 else " hidden"}>{html}</div>'
        for i, (_, html) in enumerate(tabs))
    return f"""<article class="drawer-panel" data-panel="{key}" hidden>
      <header><span class="trk">{trk}</span><h2>{title}</h2>
        <p class="sub">{sub}</p></header>{strip}
      <div class="panes">{panes}</div></article>"""


PANELS = "".join([
    panel("cubesat", "TRK-001", "CUBESAT-1U", "Vehicle &middot; in view of GND-01 &middot; ALERT", [
        ("Status", f"""
          <div class="note bad"><h4>Pi header pins 3 and 5 are dead</h4>
          <p>GPIO2 and GPIO3 no longer work open-drain. They still read high, drive
          as outputs, and measure 3.27&nbsp;V on a meter &mdash; which is exactly why
          four scans, two custom scripts and a full software audit all missed it.
          Nothing ever acknowledges on them.</p>
          <p>I&sup2;C runs on a <strong>software bus</strong> instead:
          <code>dtoverlay=i2c-gpio,i2c_gpio_sda=23,i2c_gpio_scl=24,bus=3</code> &mdash;
          that is <strong>pins 16 and 18</strong>, and <code>i2cdetect</code> must be
          given <code>-y 3</code>. If the SD card is ever reflashed, that line has to
          go back or it will look like a brand-new fault.</p></div>
          <table class="status"><tr><th>Subsystem</th><th>State</th><th>Evidence</th></tr>
          {STATUS}</table>
          <div class="note warn"><h4>The rule the flight agent must respect</h4>
          <p><strong>Glide, never jump, and release after every move.</strong> Eased
          motion never asks a motor for full speed from rest, which is why both wings
          can move together on one cell against the original one-at-a-time rule. The
          &plusmn;60&deg; reboot came from <em>holding</em> position back to back
          &mdash; duty cycle matters more than angle.</p></div>"""),
        ("Vehicle", """
          <p class="lede">Drag to orbit, scroll to zoom, click a part for its detail.
          The disassembly slider pulls the stack apart along its build axis, and
          <strong>Feather wings</strong> runs the rotation the servos actually
          perform.</p>
          <div class="bezel"><div class="bezel-hdr"><b></b> Vehicle model &middot;
          34,638 tri<span>Scale 1:1</span></div>
          <div class="iframe-slot" data-explorer></div></div>"""),
        ("Drawings", f"""
          <p class="lede">Every view is an orthographic projection taken straight off
          the mesh &mdash; the union of every triangle flattened onto a plane, which
          gives the true silhouette with its holes as interior rings. Nothing is drawn
          by hand, so if a part changes its drawing changes with it.</p>
          <div class="bpgrid">{CARDS}</div>"""),
        ("Pinout", f"""
          <p class="lede">Pick a component and the wires are drawn from the Pi's pins
          to it. Selecting <strong>PCA9685</strong> and then <strong>SENSORS</strong>
          lights the same four pins twice &mdash; that is I&sup2;C being a shared
          bus.</p><div class="port port-pin">{PIN_BODY}</div>"""),
        ("Bench", f"""
          <p class="lede">Everything here runs <strong>without the Qwiic pHAT</strong>
          &mdash; the Pi's hammer-header takes female jumpers directly. Build with
          power off and test one subsystem at a time.</p>
          <div class="port port-bench">{BENCH_BODY}</div>"""),
    ]),

    panel("dish", "TRK-002", "GND-01 &middot; DOWNLINK", "1.2 m dish &middot; mast-mounted on the 4U rack", [
        ("Link", f"""
          <p class="lede">The satellite talks to the ground station over plain WiFi,
          unicast UDP, carrying real CCSDS Space Packets &mdash; the same framing a
          real bus uses, which is what makes the Zeek analyzer meaningful.</p>
          <dl class="kv">
            <dt>Telemetry</dt><dd>UDP 5013 &middot; vehicle &rarr; ground</dd>
            <dt>Commands</dt><dd>UDP 5012 &middot; ground &rarr; vehicle</dd>
            <dt>Framing</dt><dd>CCSDS Space Packet &middot; 16-byte header</dd>
            <dt>Transport</dt><dd>WiFi, unicast &middot; no broadcast</dd>
          </dl>
          <h3>Packet layout</h3>
          <p class="lede">Verified byte-for-byte against real captures. Note the
          endianness change at offset 12 &mdash; the primary and secondary headers are
          big-endian, and everything from <code>CCSDS_SPARE</code> onward is
          little-endian. Getting that boundary wrong is the classic way to decode
          garbage that still looks plausible.</p>
          <table class="status packet"><tr><th>Offset</th><th>Size</th><th>Field</th>
          <th>Endian</th><th>Sample</th></tr>{PACKET}</table>"""),
    ]),

    panel("rack", "TRK-002b", "GROUND SEGMENT", "4U rack &middot; Raspberry Pi 5 &middot; 'groundation'", [
        ("Stack", """
          <p class="lede">A Pi 5 running the whole ground segment: command and
          telemetry, a protocol analyzer watching the wire, and the detections that
          come out of it.</p>
          <dl class="kv">
            <dt>Console</dt><dd>OpenC3 COSMOS 7.2.1 + pisat-gsw plugin</dd>
            <dt>Analyzer</dt><dd>Zeek, CCSDS protocol analyzer</dd>
            <dt>Detections</dt><dd>Elastic &middot; SPARTA space-cyber SOC</dd>
            <dt>Host</dt><dd>Pi 5, 8 GB &middot; Ubuntu 24.04</dd>
          </dl>
          <div class="note"><h4>Why a wire tap, not an agent</h4>
          <p>Nothing is installed on the satellite to catch the attack. Zeek decodes
          the CCSDS on the wire and ships it to Elastic, so the detection works
          against a vehicle you do not control and cannot instrument &mdash; which is
          the whole point of the demonstration.</p></div>"""),
    ]),

    panel("edgehub", "TRK-003", "EDGE-HUB-8U", "Sovereign AI kit &middot; 0 bytes out", [
        ("Kit", """
          <p class="lede">Two compute nodes in a Pelican case, one Elasticsearch
          cluster spanning both architectures, and a local LLM. Nothing leaves the
          case.</p>
          <dl class="kv">
            <dt>GPU node</dt><dd>DGX Spark &middot; GB10 Blackwell &middot; 128 GB &middot; aarch64</dd>
            <dt>CPU node</dt><dd>Framework Desktop &middot; Ryzen AI Max+ 395 &middot; 64 GB &middot; x86_64</dd>
            <dt>Cluster</dt><dd>One ES cluster across both nodes</dd>
            <dt>Inference</dt><dd>Local 120B &middot; no egress</dd>
            <dt>Posture</dt><dd>Sovereign &mdash; 0 bytes out</dd>
          </dl>"""),
    ]),

    panel("operator", "&mdash;", "MISSION OPERATOR", "Kibana &middot; Attack Discovery", [
        ("Detection", """
          <p class="lede">The operator never reads a packet. Attack Discovery
          correlates what Zeek decoded and names the thing that happened, in the
          language of the mission rather than the language of the wire.</p>
          <div class="note bad"><h4>Critical &middot; 3 alerts</h4>
          <p><strong>Rogue commanding source targeting CUBESAT-1U.</strong> Entities:
          CUBESAT-1U, GND-01, 10.0.0.75. Contributing detections: rogue commanding
          source, replayed sequence count.</p></div>
          <p class="lede">Then the loop closes: the detection issues a command back to
          the vehicle, and the wings move on the table in front of you. That visible
          response is the demonstration &mdash; a detection that does something,
          rather than a row in a table.</p>"""),
    ]),

    panel("orbital", "&mdash;", "ORBITAL PICTURE", "4 vehicles &middot; 3 planes &middot; LEO", [
        ("Constellation", """
          <p class="lede">Four tracked vehicles across three planes. Only one is real
          hardware on the table; the rest give the picture something to be a picture
          <em>of</em>.</p>
          <dl class="kv">
            <dt>Tracked</dt><dd>4 vehicles &middot; 3 planes</dd>
            <dt>Regime</dt><dd>Low Earth orbit</dd>
            <dt>CUBESAT-1U</dt><dd class="alert">ALERT &middot; in view of GND-01</dd>
          </dl>"""),
    ]),

    panel("detection", "&mdash;", "DETECTION STATUS", "What the SOC is doing right now", [
        ("Status", f"""
          <table class="status"><tr><th>Subsystem</th><th>State</th><th>Evidence</th></tr>
          {STATUS}</table>"""),
    ]),

    panel("linkrail", "&mdash;", "LINK &amp; TRANSPORT", "Power and data, as designed", [
        ("Topology", f"""
          <p class="lede">Two rails that must never meet, one I&sup2;C chain, and a
          WiFi link out to the ground segment. Drawn as designed &mdash; the pinout
          records what was actually built after the hardware I&sup2;C died.</p>
          <div class="frame" id="topoview">{TOPOLOGY}</div>"""),
    ]),

    panel("sparta", "&mdash;", "THREAT COVERAGE", "SPARTA v3.2 &middot; 104 analytics", [
        ("Coverage", """
          <p class="lede">SPARTA is the space-systems equivalent of ATT&amp;CK. The
          matrix in the drawing is the tactic row; the numbers are techniques with at
          least one mapped analytic.</p>
          <dl class="kv">
            <dt>Analytics</dt><dd>104 mapped &middot; 69 validated</dd>
            <dt>Techniques</dt><dd>86 covered</dd>
            <dt>Indicators</dt><dd>132 IoB</dd>
            <dt>Framework</dt><dd>SPARTA v3.2</dd>
          </dl>"""),
    ]),
])

# The order entities appear in the HUD list, with the label shown on the chip.
CHIPS = [
    ("cubesat", "TRK-001", "CUBESAT-1U", "alert"),
    ("dish", "TRK-002", "GND-01 downlink", ""),
    ("rack", "TRK-002b", "Ground segment", ""),
    ("edgehub", "TRK-003", "Edge hub 8U", ""),
    ("operator", "—", "Mission operator", ""),
    ("orbital", "—", "Orbital picture", ""),
    ("linkrail", "—", "Link &amp; transport", ""),
    ("detection", "—", "Detection status", ""),
    ("sparta", "—", "Threat coverage", ""),
]
CHIPHTML = "\n".join(
    f'<button class="chip {c}" data-go="{k}"><b>{t}</b><span>{n}</span></button>'
    for k, t, n, c in CHIPS)


# ------------------------------------------------------------------------ page
# A plain template with %%TOKEN%% slots rather than an f-string: the CSS and JS
# below are dense with braces, and doubling every one of them is a bug factory.

PAGE = r"""<title>CubeSat &mdash; mission console</title>
<style>
:root {
  /* straight off operational-picture-light.svg */
  --ground:#F5F7FA; --paper:#FFFFFF; --grid:#EDF1F7; --grid5:#E6EBF3;
  --ink:#1C1E23; --muted:#6A7183; --dim:#8A93A5;
  --blue:#0B64DD; --alert:#D6206E; --warn:#A16207; --good:#147D57;
  --rule:#C9D2DF; --rule-2:#DFE6F0;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
  --sans:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
  --rail-h:50px;
}
* { box-sizing:border-box; }
html, body { height:100%; }
body {
  margin:0; color:var(--ink); font:400 15px/1.6 var(--sans);
  background:var(--ground); overflow:hidden; -webkit-font-smoothing:antialiased;
}
@media (prefers-reduced-motion:reduce) { * { animation:none !important; } }

/* ================================================================ top rail */
.rail {
  position:fixed; inset:0 0 auto; z-index:40; display:flex; align-items:center;
  gap:15px; padding:0 18px; height:var(--rail-h);
  background:rgba(255,255,255,.94); border-bottom:1.5px solid var(--ink);
  backdrop-filter:blur(6px);
}
.rail .wm { font:700 15px/1 var(--mono); letter-spacing:.13em; white-space:nowrap; }
.rail .wm i { font-style:normal; color:var(--blue); }
.rail .sub { font:500 11px/1 var(--mono); letter-spacing:.15em; color:var(--muted);
  text-transform:uppercase; white-space:nowrap; }
.rail .sp { margin-left:auto; }
.tag { font:700 10.5px/1 var(--mono); letter-spacing:.14em; padding:7px 11px;
  border:1.5px solid var(--blue); color:var(--blue); white-space:nowrap; }
.tag.ghost { border-color:var(--rule); color:var(--muted); }
.clock { font:700 11px/1 var(--mono); letter-spacing:.1em; color:var(--muted);
  font-variant-numeric:tabular-nums; white-space:nowrap; }
@media (max-width:820px) { .rail .sub, .rail .tag.ghost { display:none; } }

/* ==================================================================== stage */
.stage {
  position:fixed; inset:var(--rail-h) 0 0; overflow:hidden; cursor:grab;
  background:
    linear-gradient(var(--grid) 1px, transparent 1px) 0 0/100% 50px,
    linear-gradient(90deg, var(--grid) 1px, transparent 1px) 0 0/50px 100%,
    var(--ground);
}
.stage.drag { cursor:grabbing; }
.stage > svg { display:block; width:100%; height:100%; }

/* packets running along the link vectors */
@keyframes flow { to { stroke-dashoffset:-48; } }
#stage .flow { animation:flow 1.5s linear infinite; }
#stage .flow.slow { animation-duration:2.6s; }

/* everything dims except the selected entity */
#stage .dimmable { transition:opacity .28s; }
.stage.focused #stage .dimmable { opacity:.22; }
.stage.focused #stage .dimmable.on { opacity:1; }

/* ------------------------------------------------------------- hotspot HUD */
.hot { fill:transparent; cursor:pointer; }
.hot:focus { outline:none; }
.brk { fill:none; stroke:var(--blue); stroke-width:2.5; opacity:0;
  transition:opacity .18s; pointer-events:none; }
.hotwrap.hover .brk, .hotwrap.sel .brk { opacity:.95; }
.hotwrap.sel .brk { stroke-width:3; }
.hot:focus-visible + .brk { opacity:.95; }
@keyframes ping { 0%{opacity:.9;stroke-width:2.5} 70%{opacity:0;stroke-width:9}
  100%{opacity:0;stroke-width:9} }
.hotwrap.sel .brk.ping { animation:ping 1.9s ease-out infinite; }
.hotlbl { font:700 11px var(--mono); letter-spacing:.14em; fill:var(--blue);
  opacity:0; transition:opacity .18s; pointer-events:none; }
.hotwrap.hover .hotlbl, .hotwrap.sel .hotlbl { opacity:1; }
/* the one entity in alert gets a standing marker, not just a hover state */
.hotwrap.warnnode .brk { stroke:var(--alert); }
.hotwrap.warnnode .idle { opacity:.5; }
@keyframes breathe { 0%,100%{opacity:.35} 50%{opacity:.9} }
.hotwrap.warnnode .idle { animation:breathe 2.4s ease-in-out infinite; }

/* ============================================================== entity list */
.hud { position:absolute; top:14px; left:14px; z-index:12; display:flex;
  flex-direction:column; gap:1px; width:224px; padding:12px 10px 10px;
  background:rgba(255,255,255,.96); border:1px solid var(--rule-2);
  box-shadow:0 6px 22px rgba(28,30,35,.07); }
.hud .lbl { font:700 9.5px/1 var(--mono); letter-spacing:.18em; color:var(--blue);
  text-transform:uppercase; padding:0 0 9px 4px;
  border-bottom:1px solid var(--rule-2); margin-bottom:6px; }
.chip { display:grid; grid-template-columns:52px 1fr; gap:8px; align-items:baseline;
  text-align:left; padding:7px 6px; border:0; cursor:pointer;
  background:none; border-left:2px solid transparent;
  font:inherit; color:var(--muted); }
.chip b { font:700 9.5px/1.3 var(--mono); letter-spacing:.08em; color:var(--dim); }
.chip span { font:600 11.5px/1.3 var(--mono); letter-spacing:.03em; }
.chip:hover { background:var(--ground); color:var(--ink); }
.chip[aria-current="true"] { border-left-color:var(--blue); color:var(--blue);
  background:#EDF4FE; }
.chip.alert b { color:var(--alert); }
@media (max-width:900px) { .hud { display:none; } }

/* ================================================================ controls */
.ctrls { position:absolute; right:16px; bottom:16px; z-index:12; display:flex;
  gap:1px; }
.ctrls button { width:36px; height:36px; border:0; background:rgba(255,255,255,.9);
  color:var(--muted); font:700 14px/1 var(--mono); cursor:pointer; }
.ctrls button:hover { background:#fff; color:var(--blue); }
.ctrls button.wide { width:auto; padding:0 13px; font-size:10px;
  letter-spacing:.14em; }
.tip { position:absolute; left:50%; bottom:18px; transform:translateX(-50%);
  z-index:11; font:600 10px/1 var(--mono); letter-spacing:.15em; color:var(--dim);
  text-transform:uppercase; pointer-events:none; white-space:nowrap;
  background:rgba(245,247,250,.8); padding:7px 12px; }
@media (max-width:760px) { .tip { display:none; } }

/* =================================================================== drawer */
.drawer {
  position:fixed; top:var(--rail-h); right:0; bottom:0; z-index:30;
  width:min(660px, 94vw); background:var(--paper);
  transition:transform .3s cubic-bezier(.4,0,.2,1), width .25s ease;
  border-left:1.5px solid var(--ink); display:flex; flex-direction:column;
  transform:translateX(101%);
  box-shadow:-18px 0 44px rgba(28,30,35,.07);
}
.drawer.open { transform:none; }
.drawer.wide { width:min(1180px, 96vw); }
@media (prefers-reduced-motion:reduce) { .drawer { transition:none; } }
.drawer-btns { position:absolute; top:12px; right:14px; z-index:3; display:flex;
  gap:6px; }
.drawer-btns button { height:30px; padding:0 9px; border:1px solid var(--rule);
  background:#fff; cursor:pointer; color:var(--muted);
  font:700 11px/1 var(--mono); letter-spacing:.1em; }
.drawer-btns button:hover { color:var(--blue); border-color:var(--blue); }
#dclose:hover { color:var(--alert); border-color:var(--alert); }
.drawer-panel { display:flex; flex-direction:column; min-height:0; flex:1; }
.drawer-panel[hidden] { display:none; }
.drawer-panel > header { padding:22px 56px 16px 26px;
  border-bottom:1.5px solid var(--ink); }
.trk { font:700 10px/1 var(--mono); letter-spacing:.2em; color:var(--blue); }
.drawer-panel h2 { margin:9px 0 0; font:700 21px/1.15 var(--mono);
  letter-spacing:.09em; text-transform:uppercase; }
.drawer-panel .sub { margin:7px 0 0; font:500 11px/1.5 var(--mono);
  letter-spacing:.1em; color:var(--dim); text-transform:uppercase; }
.tabs { display:flex; gap:1px; padding:0 26px; border-bottom:1px solid var(--rule-2);
  overflow-x:auto; flex:0 0 auto; }
.tabs button { border:0; background:none; cursor:pointer; padding:12px 13px;
  font:700 10.5px/1 var(--mono); letter-spacing:.14em; text-transform:uppercase;
  color:var(--dim); border-bottom:2px solid transparent; white-space:nowrap; }
.tabs button:hover { color:var(--ink); }
.tabs button[aria-selected="true"] { color:var(--blue); border-bottom-color:var(--blue); }
.panes { overflow-y:auto; padding:22px 26px 60px; flex:1; min-height:0; }
.pane[hidden] { display:none; }

/* ============================================================ drawer bits */
.lede { color:var(--muted); margin:0 0 18px; font-size:14.5px; }
h3 { font:700 12px/1.3 var(--mono); letter-spacing:.14em; text-transform:uppercase;
  margin:26px 0 10px; }
code { font:600 .88em/1 var(--mono); color:var(--blue); background:#EDF4FE;
  padding:2px 5px; }
.kv { display:grid; grid-template-columns:auto 1fr; gap:9px 18px; margin:0; }
.kv dt { font:700 9.5px/1.7 var(--mono); letter-spacing:.14em; color:var(--dim);
  text-transform:uppercase; }
.kv dd { margin:0; font:600 12.5px/1.6 var(--mono); color:var(--ink); }
.kv dd.alert { color:var(--alert); }
.note { border:1px solid var(--rule-2); border-left:3px solid var(--blue);
  padding:14px 17px; margin:0 0 16px; }
.note.bad { border-left-color:var(--alert); }
.note.warn { border-left-color:var(--warn); }
.note h4 { margin:0 0 6px; font:700 11.5px/1.3 var(--mono); letter-spacing:.13em;
  text-transform:uppercase; color:var(--blue); }
.note.bad h4 { color:var(--alert); } .note.warn h4 { color:var(--warn); }
.note p { margin:0; color:var(--muted); font-size:14px; }
.note p + p { margin-top:8px; }
.status { width:100%; border-collapse:collapse; font-size:13.5px; margin:0 0 18px; }
.status th { text-align:left; font:700 9.5px/1.5 var(--mono); letter-spacing:.16em;
  text-transform:uppercase; color:var(--dim); padding:0 12px 8px 0;
  border-bottom:1.5px solid var(--ink); }
.status td { padding:10px 12px 10px 0; border-bottom:1px solid var(--rule-2);
  color:var(--muted); vertical-align:top; }
.status td:first-child { color:var(--ink); font:600 12px/1.5 var(--mono); }
.status.packet td { font:600 12px/1.5 var(--mono); }
.status.packet td:nth-child(4) { color:var(--blue); }
.pill { display:inline-block; font:700 9px/1 var(--mono); letter-spacing:.13em;
  padding:5px 8px; white-space:nowrap; border:1.5px solid; }
.pill.ok { color:var(--good); border-color:#9BCDBA; }
.pill.no { color:var(--alert); border-color:#F0AFCB; }
.pill.wait { color:var(--warn); border-color:#DDC48A; }
.frame { border:1px solid var(--rule-2); padding:8px; overflow-x:auto; }
.frame > svg { display:block; min-width:900px; width:100%; height:auto; }
.bezel { background:var(--ink); padding:8px; }
.bezel-hdr { display:flex; align-items:center; gap:10px; padding:0 3px 8px;
  font:700 9.5px/1 var(--mono); letter-spacing:.16em; text-transform:uppercase;
  color:#8FA6C4; }
.bezel-hdr b { width:8px; height:8px; border-radius:50%; background:var(--blue); }
.bezel-hdr span { margin-left:auto; color:#5E6C82; }
.iframe-slot iframe { display:block; width:100%; height:min(62vh,620px); border:0;
  background:#111; }
.bpgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr));
  gap:14px; }
.bp { margin:0; border:1px solid var(--rule-2); display:flex; flex-direction:column;
  cursor:zoom-in; }
.bp:hover, .bp:focus-visible { border-color:var(--blue); outline:none; }
.bp-img { border-bottom:1px solid var(--rule-2); background:var(--ground); }
.bp-img img { display:block; width:100%; height:auto; aspect-ratio:3/2;
  object-fit:contain; }
.bp figcaption { padding:12px 13px 13px; display:flex; flex-direction:column;
  gap:4px; flex:1; }
.bp h4 { margin:0; font:700 12px/1.25 var(--mono); letter-spacing:.08em;
  text-transform:uppercase; }
.bp-sub { font:600 9.5px/1 var(--mono); letter-spacing:.14em; color:var(--blue);
  text-transform:uppercase; }
.bp p { margin:5px 0 0; font-size:12.5px; color:var(--muted); line-height:1.55; }
.bp code { margin-top:auto; padding:9px 0 0; background:none; color:var(--dim);
  font-size:10px; }

/* ================================================================= lightbox */
dialog#lb { border:1px solid var(--rule); padding:11px; background:var(--paper);
  max-width:96vw; max-height:96vh; }
dialog#lb::backdrop { background:rgba(28,30,35,.66); }
dialog#lb img { display:block; max-width:92vw; max-height:84vh; width:auto; }
dialog#lb .cap { display:flex; justify-content:space-between; gap:18px;
  padding:10px 2px 0; font:700 10px/1 var(--mono); letter-spacing:.16em;
  text-transform:uppercase; color:var(--dim); }

/* =========================================================== ported pages ===
   Two standalone documents dropped in whole and re-scoped with native CSS
   nesting. Their token names are rebound to the console palette here, so their
   markup and stylesheets stay untouched. */
.port { --bg:#FFFFFF; --panel:#FFFFFF; --ink:#1C1E23; --ink2:#6A7183;
  --ink3:#8A93A5; --rule:#DFE6F0; --accent:#0B64DD; --accent-soft:#0B64DD0E;
  --c-33:#6B3FA0; --c-5v:#D6206E; --c-gnd:#343741; --c-i2c:#0B64DD;
  --c-scl:#A16207; --c-spi:#147D57; --c-sck:#C2410C; --c-uart:#C2410C;
  --c-gpio:#0E7490; --c-eep:#A16207; --c-dead:#D6206E; --idle:#C9D2DF;
  --w-33:#6B3FA0; --w-5v:#D6206E; --w-gnd:#343741; --w-sda:#0B64DD;
  --w-scl:#A16207; --w-mosi:#147D57; --w-sck:#C2410C;
  --good:#147D57; --warn:#A16207; --danger:#D6206E;
}
.port .wrap { max-width:none; padding:0 !important; }
.port header { display:none; }
.port-pin > .wrap > .eyebrow, .port-pin > .wrap > h1,
.port-pin > .wrap > .lede { display:none; }
.port-pin { %%PIN_CSS%% }
.port-bench { %%BENCH_CSS%% }
</style>

<div class="rail">
  <span class="wm">1U <i>CUBESAT</i></span>
  <span class="sub">// Space-cyber operational picture</span>
  <span class="sp"></span>
  <span class="tag">AIRGAPPED</span>
  <span class="tag ghost">REV C</span>
  <span class="clock" id="clk">T+00:00:00</span>
</div>

<div class="stage" id="wrap">
  %%OPS%%

  <div class="hud">
    <div class="lbl">Tracked entities</div>
    %%CHIPS%%
  </div>

  <div class="ctrls">
    <button data-zoom="-1" title="Zoom out" aria-label="Zoom out">&minus;</button>
    <button data-zoom="1" title="Zoom in" aria-label="Zoom in">+</button>
    <button class="wide" data-fit title="Fit the whole picture">FIT</button>
  </div>
  <p class="tip">Click an entity to inspect &middot; drag to pan &middot; scroll to zoom</p>
</div>

<aside class="drawer" id="drawer" aria-label="Entity detail">
  <div class="drawer-btns">
    <button id="dwide" aria-pressed="false" title="Widen the panel">&#8596; WIDE</button>
    <button id="dclose" aria-label="Close">&times;</button>
  </div>
  %%PANELS%%
</aside>

<dialog id="lb"><img alt="">
  <div class="cap"><span id="lbt"></span><span>Esc or click to close</span></div>
</dialog>

<template id="explorer-tpl"><iframe title="Interactive 3D CubeSat explorer"
  srcdoc="%%EXPLORER%%"></iframe></template>

<script>
%%PIN_JS%%
</script>

<script>
(function () {
  var svg   = document.getElementById('stage');
  var wrap  = document.getElementById('wrap');
  var drawer= document.getElementById('drawer');
  var VB    = { x:0, y:0, w:2000, h:1120 };          /* the drawing's own box */
  var view  = Object.assign({}, VB);
  var sel   = null;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function apply () {
    svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
  }

  /* ---------------------------------------------------------- hotspot HUD
     Bounds come from getBBox(), so the controls sit wherever the artwork
     actually puts each entity. Edit the drawing and they follow. */
  var LABELS = %%LABELS%%;
  var layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(layer);
  var nodes = {};

  /*
    getBBox() answers in the element's OWN user space, and every section of this
    drawing carries a translate() - so bare bbox coordinates land the brackets
    somewhere else entirely. Walking the corners through the element's matrix
    relative to the root puts them back where the artwork is.
  */
  function rootBox (el) {
    var b;
    try { b = el.getBBox(); } catch (e) { return null; }
    if (!b || !b.width || !b.height) return null;
    var m = svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
    var xs = [], ys = [], pt = svg.createSVGPoint();
    [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height],
     [b.x + b.width, b.y + b.height]].forEach(function (c) {
      pt.x = c[0]; pt.y = c[1];
      var q = pt.matrixTransform(m);
      xs.push(q.x); ys.push(q.y);
    });
    var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
    return { x:x0, y:y0, w:Math.max.apply(null, xs) - x0,
             h:Math.max.apply(null, ys) - y0 };
  }

  function corner (x, y, w, h, k) {
    var L = Math.min(26, w * 0.28, h * 0.28);
    return 'M ' + (x) + ' ' + (y + L) + ' L ' + x + ' ' + y + ' L ' + (x + L) + ' ' + y +
           ' M ' + (x + w - L) + ' ' + y + ' L ' + (x + w) + ' ' + y + ' L ' + (x + w) + ' ' + (y + L) +
           ' M ' + (x + w) + ' ' + (y + h - L) + ' L ' + (x + w) + ' ' + (y + h) + ' L ' + (x + w - L) + ' ' + (y + h) +
           ' M ' + (x + L) + ' ' + (y + h) + ' L ' + x + ' ' + (y + h) + ' L ' + x + ' ' + (y + h - L);
  }

  [].forEach.call(svg.querySelectorAll('[data-node]'), function (g) {
    var key = g.dataset.node;
    g.classList.add('dimmable');
    var b = rootBox(g);
    if (!b) return;
    var pad = 12;
    var x = b.x - pad, y = b.y - pad, w = b.w + pad * 2, h = b.h + pad * 2;

    var wrapG = document.createElementNS(svg.namespaceURI, 'g');
    wrapG.setAttribute('class', 'hotwrap' + (key === 'cubesat' ? ' warnnode' : ''));

    var hot = document.createElementNS(svg.namespaceURI, 'rect');
    hot.setAttribute('class', 'hot');
    hot.setAttribute('x', x); hot.setAttribute('y', y);
    hot.setAttribute('width', w); hot.setAttribute('height', h);
    hot.setAttribute('tabindex', '0');
    hot.setAttribute('role', 'button');
    hot.setAttribute('aria-label', 'Inspect ' + (LABELS[key] || key));

    var d = corner(x, y, w, h);
    var brk = document.createElementNS(svg.namespaceURI, 'path');
    brk.setAttribute('class', 'brk'); brk.setAttribute('d', d);
    var ping = document.createElementNS(svg.namespaceURI, 'path');
    ping.setAttribute('class', 'brk ping'); ping.setAttribute('d', d);
    var idle = document.createElementNS(svg.namespaceURI, 'path');
    idle.setAttribute('class', 'brk idle'); idle.setAttribute('d', d);

    var lbl = document.createElementNS(svg.namespaceURI, 'text');
    lbl.setAttribute('class', 'hotlbl');
    lbl.setAttribute('x', x + 2);
    lbl.setAttribute('y', y - 9);
    lbl.textContent = (LABELS[key] || key).toUpperCase();

    wrapG.appendChild(idle); wrapG.appendChild(ping);
    wrapG.appendChild(hot); wrapG.appendChild(brk); wrapG.appendChild(lbl);
    layer.appendChild(wrapG);
    nodes[key] = { g:g, wrap:wrapG, box:{ x:x, y:y, w:w, h:h } };

    hot.addEventListener('mouseenter', function () { wrapG.classList.add('hover'); });
    hot.addEventListener('mouseleave', function () { wrapG.classList.remove('hover'); });
    hot.addEventListener('click', function (e) { e.stopPropagation(); select(key); });
    hot.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(key); }
    });
  });

  /* -------------------------------------------------------------- viewport */
  function tween (to, ms) {
    /* ms of 0 is a legitimate ask (resize, reduced motion). Feeding it to the
       easing divides by zero on the first frame, and a NaN viewBox is silently
       ignored by the browser - so the view sticks at its last good value and
       every later move looks broken. */
    if (reduce || !ms) { view = to; apply(); return; }
    var from = Object.assign({}, view), t0 = performance.now();
    (function step (t) {
      var k = Math.min(1, (t - t0) / ms);
      var e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      view = { x:from.x + (to.x - from.x) * e, y:from.y + (to.y - from.y) * e,
               w:from.w + (to.w - from.w) * e, h:from.h + (to.h - from.h) * e };
      apply();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /*
    Frame an entity into the part of the stage the drawer is NOT covering, then
    widen the viewBox back out so the covered strip still renders. Without this
    the thing you just selected sits underneath the panel describing it.
  */
  function frame (box, ms) {
    var full = wrap.clientWidth, tall = wrap.clientHeight;
    var hidden = drawer.classList.contains('open')
      ? Math.min(drawer.getBoundingClientRect().width, full * 0.8) : 0;
    var open = Math.max(240, full - hidden);
    var ar = open / tall, pad = 1.5;
    var w = box.w * pad, h = box.h * pad;
    if (w / h < ar) w = h * ar; else h = w / ar;
    var cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    var scale = full / open;                       /* user units per stage px */
    tween({ x:cx - w / 2, y:cy - h * scale / 2, w:w * scale, h:h * scale },
          ms === undefined ? 620 : ms);
  }

  function fit () { tween(Object.assign({}, VB), 520); }

  function zoom (f, cx, cy) {
    var w = Math.min(VB.w * 1.6, Math.max(VB.w * 0.12, view.w * f));
    var k = w / view.w;
    view = { x:cx - (cx - view.x) * k, y:cy - (cy - view.y) * k,
             w:w, h:view.h * k };
    apply();
  }

  function toSvg (px, py) {
    var r = wrap.getBoundingClientRect();
    /* preserveAspectRatio="xMidYMid meet" letterboxes; account for it */
    var s = Math.min(r.width / view.w, r.height / view.h);
    var ox = (r.width - view.w * s) / 2, oy = (r.height - view.h * s) / 2;
    return { x:view.x + (px - r.left - ox) / s, y:view.y + (py - r.top - oy) / s, s:s };
  }

  wrap.addEventListener('wheel', function (e) {
    e.preventDefault();
    var p = toSvg(e.clientX, e.clientY);
    zoom(e.deltaY > 0 ? 1.13 : 1 / 1.13, p.x, p.y);
  }, { passive:false });

  var drag = null;
  wrap.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.hud, .ctrls')) return;
    drag = { x:e.clientX, y:e.clientY, vx:view.x, vy:view.y, moved:0 };
    wrap.classList.add('drag'); wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var s = toSvg(0, 0).s;
    drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    view.x = drag.vx - (e.clientX - drag.x) / s;
    view.y = drag.vy - (e.clientY - drag.y) / s;
    apply();
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    wrap.addEventListener(ev, function () { drag = null; wrap.classList.remove('drag'); });
  });

  [].forEach.call(document.querySelectorAll('[data-zoom]'), function (b) {
    b.addEventListener('click', function () {
      zoom(+b.dataset.zoom > 0 ? 1 / 1.25 : 1.25,
           view.x + view.w / 2, view.y + view.h / 2);
    });
  });
  document.querySelector('[data-fit]').addEventListener('click', function () {
    deselect(); fit();
  });

  /* ---------------------------------------------------------------- drawer */
  var panels = {};
  [].forEach.call(drawer.querySelectorAll('[data-panel]'), function (p) {
    panels[p.dataset.panel] = p;
  });

  function select (key) {
    var p = panels[key];
    if (!p) return;
    sel = key;
    for (var k in panels) panels[k].hidden = (k !== key);
    for (var n in nodes) nodes[n].wrap.classList.toggle('sel', n === key);
    [].forEach.call(svg.querySelectorAll('.dimmable'), function (g) {
      g.classList.toggle('on', g.dataset.node === key);
    });
    wrap.classList.add('focused');
    drawer.classList.add('open');
    [].forEach.call(document.querySelectorAll('[data-go]'), function (c) {
      c.setAttribute('aria-current', c.dataset.go === key ? 'true' : 'false');
    });
    if (nodes[key]) frame(nodes[key].box);
    mount(p);
    /* the pinout draws its wires from live geometry, which is zero while the
       pane is hidden - a resize is its cue to redraw */
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  }

  function deselect () {
    sel = null;
    drawer.classList.remove('open');
    wrap.classList.remove('focused');
    for (var n in nodes) nodes[n].wrap.classList.remove('sel');
    [].forEach.call(document.querySelectorAll('[data-go]'), function (c) {
      c.setAttribute('aria-current', 'false');
    });
  }

  /* the explorer is 3/4 of this page's weight; it is only built if asked for */
  function mount (panel) {
    var slot = panel.querySelector('[data-explorer]');
    if (slot && !slot.firstChild) {
      slot.appendChild(document.getElementById('explorer-tpl').content.cloneNode(true));
    }
  }

  document.getElementById('dclose').addEventListener('click', function () {
    deselect(); fit();
  });
  document.getElementById('dwide').addEventListener('click', function () {
    var on = drawer.classList.toggle('wide');
    this.setAttribute('aria-pressed', String(on));
    if (sel && nodes[sel]) setTimeout(function () { frame(nodes[sel].box, 400); }, 260);
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sel && !document.getElementById('lb').open) {
      deselect(); fit();
    }
  });
  [].forEach.call(document.querySelectorAll('[data-go]'), function (c) {
    c.addEventListener('click', function () { select(c.dataset.go); });
  });

  /* tabs inside a panel */
  drawer.addEventListener('click', function (e) {
    var b = e.target.closest('.tabs button');
    if (!b) return;
    var panel = b.closest('.drawer-panel');
    [].forEach.call(panel.querySelectorAll('.tabs button'), function (x) {
      x.setAttribute('aria-selected', x === b ? 'true' : 'false');
    });
    [].forEach.call(panel.querySelectorAll('.pane'), function (p) {
      p.hidden = p.dataset.pane !== b.dataset.tab;
    });
    panel.querySelector('.panes').scrollTop = 0;
    mount(panel);
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  });

  /* --------------------------------------------------------------- drawings */
  var lb = document.getElementById('lb'), im = lb.querySelector('img'),
      ti = document.getElementById('lbt');
  drawer.addEventListener('click', function (e) {
    var fig = e.target.closest('.bp');
    if (!fig) return;
    im.src = fig.querySelector('img').src;
    im.alt = 'Enlarged drawing of ' + fig.dataset.title;
    ti.textContent = fig.dataset.title;
    lb.showModal();
  });
  lb.addEventListener('click', function () { lb.close(); });

  /* ------------------------------------------------------------ mission clock */
  var t0 = 14 * 60 + 22;                      /* the drawing opens at T+00:14:22 */
  var clk = document.getElementById('clk');
  setInterval(function () {
    t0++;
    var h = String(Math.floor(t0 / 3600)).padStart(2, '0');
    var m = String(Math.floor(t0 / 60) % 60).padStart(2, '0');
    var s = String(t0 % 60).padStart(2, '0');
    clk.textContent = 'T+' + h + ':' + m + ':' + s;
  }, 1000);

  apply();
  window.addEventListener('resize', function () { if (sel && nodes[sel]) frame(nodes[sel].box, 0); });
})();
</script>
"""


LABELS = {k: n.replace("&amp;", "&") for k, _t, n, _c in CHIPS}

HTML = (PAGE
        .replace("%%PIN_CSS%%", PIN_CSS)
        .replace("%%BENCH_CSS%%", BENCH_CSS)
        .replace("%%OPS%%", OPS)
        .replace("%%CHIPS%%", CHIPHTML)
        .replace("%%PANELS%%", PANELS)
        .replace("%%PIN_JS%%", PIN_JS)
        .replace("%%LABELS%%", repr(LABELS).replace("'", '"')))


# ----------------------------------------------------------------------- ascii
# The artifact wrapper supplies the <head>, so a <meta charset> of our own would
# land in the body and be ignored. Rather than depend on the server sending a
# charset, every non-ASCII character is escaped: numeric references in markup,
# \uXXXX in script, where HTML entities are not decoded at all.

def _ascii(text):
    parts = re.split(r"(<script>.*?</script>)", text, flags=re.S)
    for i, part in enumerate(parts):
        if part.startswith("<script>"):
            parts[i] = "".join(ch if ord(ch) < 127 else "\\u%04x" % ord(ch)
                               for ch in part)
        else:
            parts[i] = "".join(ch if ord(ch) < 127 else "&#%d;" % ord(ch)
                               for ch in part)
    return "".join(parts)


HTML = _ascii(HTML)

# The explorer is substituted after that pass, and escaped on its own terms: it
# carries <script> tags the split above would misread. Inside a srcdoc attribute
# every entity is decoded once when the iframe document is parsed, so numeric
# references are right even for its script content - but the attribute has to
# survive its enclosing quotes first.
explorer = open(os.path.join(COMMS, "satellite-explorer.html"),
                encoding="utf-8").read()
explorer = explorer.replace("&", "&amp;").replace('"', "&quot;")
explorer = "".join(ch if ord(ch) < 127 else "&#%d;" % ord(ch) for ch in explorer)
HTML = HTML.replace("%%EXPLORER%%", explorer)

out = os.path.join(HERE, "cubesat.html")
open(out, "w", encoding="utf-8").write(HTML)
print(f"  wrote {out}  ({len(HTML)/1024/1024:.2f} MB)")
