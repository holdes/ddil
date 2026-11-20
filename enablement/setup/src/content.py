"""Content for the DDIL kit physical setup guide: out of the case to powered on, and pack-down.

Spine: the kit lead's own seven steps (13 Nov 2026), tightened into declarative instructions.
Other sources: enablement/FACTS.md, docs runbook 02, 01-HARDWARE-INVENTORY.md, 05-NETWORK-CONFIG.md,
CLAUDE.md (kiosk modes). Anything not in those sources is a visible "confirm on kit" blank.

Markup available in body strings:
  {UNC}   tag: not recorded in any source
  {DOC}   tag: from a planning document, not verified on the kit
  [[fill:ID:Label]]  a fill-in blank, saved in the browser and printed as a line
"""

MOCK_NOTE = '<div class="callout-box"><b>The kiosk probes are simulated.</b> <code>demo/kiosk/src/lib/health.ts</code> sets <code>MOCK = true</code>: each probe returns after a random delay and has a 5 % random chance of showing FAIL. A green board does not prove the services are up, and an occasional pink FAIL is noise. Use the checks in the kit configuration runbook for real status until <code>MOCK</code> is set to false.</div>'

UNC = '<span class="tag unc">Confirm on kit</span>'
DOC = '<span class="tag doc">Doc-only</span>'
USER = '<span class="tag usr">Kit lead</span>'

COMPONENTS = {
    "kiosk": {"name": "Touchscreen panel",
              "addr": "HDMI and USB Type-A to the Framework · kiosk app on :3100",
              "role": "DeskPi 7.84 in 1280x400 panel in a 2U mount, with an Elastic sticker on the panel below it. Shows the kiosk: Boot Diagnostics, then the Sovereign AI branding page with a QR code."},
    "framework": {"name": "Framework Desktop",
                  "addr": "192.168.1.10 · frontend :3000 · kiosk :3100",
                  "role": "Ryzen AI Max+ 395, 64 GB. Runs the CPU Elasticsearch node, Kibana, the demo app and the kiosk. Flex ATX PSU at the rear."},
    "spark": {"name": "DGX Spark",
              "addr": "192.168.1.20",
              "role": "GB10 Blackwell, 128 GB, metal-foam face with the NVIDIA logo. Runs the GPU Elasticsearch node, Ollama and the Jina embedding server."},
    "jetkvm": {"name": "JetKVM",
               "addr": "Ethernet, HDMI and USB-C power",
               "role": "Remote console on the front face of the kit. Removed from its bay for transport; its leads stay in the bay."},
    "ux7": {"name": "UniFi Express 7",
            "addr": "192.168.1.1 · serves Wi-Fi DDIL",
            "role": "Gateway, DHCP (192.168.1.100-199 per the network plan) and Wi-Fi for the kit. Its white USB-C power lead is unplugged for transport."},
    "switch": {"name": "Switch Flex Mini",
               "addr": "5-port GbE",
               "role": "Connects the UniFi, the Framework and the DGX Spark. A blue status LED is visible next to its USB-C power lead in the kit photo."},
    "pdu": {"name": "PDU",
            "addr": "Kit Master Power switch",
            "role": "10 in rack PDU, 4 outlets, surge protection (per the inventory). The rocker glows red when on. The black mains cable exits at the rear bottom right of the kit."},
    "frame": {"name": "Frame, handle and grates",
              "addr": "Lift points: handle on top, metal grate on the back",
              "role": "10 in mini rack with a glass side panel and perforated metal grates on the rear. Travels face down in a Pelican Air 1615 case."},
}

# ------------------------------------------------------------------ packing list
# (id, icon, item, connects, source) ; icon in power|eth|hdmi|usbc|usba|tablet|key
PACKING = [
    ("pk-pdu", "power", "PDU power cable (long, black)", "Exits the kit at the rear bottom right; plug end to a wall outlet", "user"),
    ("pk-kvm", "kvm", "JetKVM unit", "Lifted out of its bay on the front face for transport", "photo"),
    ("pk-kvm-leads", "eth", "JetKVM leads: USB-C, USB-A, RJ45 Ethernet", "Stay in the kit, hanging in the empty bay. Tuck them in, do not pull them out", "photo"),
    ("pk-ux7", "usbc", "UniFi Express 7 USB-C power lead (white)", "Stays in the kit, unplugged from the UniFi and hanging to the lower row", "photo"),
    ("pk-ts-hdmi", "hdmi", "Touchscreen HDMI cable", "Touchscreen to the Framework HDMI port (rear, leftmost)", "user"),
    ("pk-ts-usba", "usba", "Touchscreen USB Type-A cable", "Touchscreen to a Framework USB Type-A port (rear)", "user"),
    ("pk-fw-eth", "eth", "Framework Ethernet cable", "Framework RJ45 (rear) to [[fill:fw-eth-end:other end]]", "user"),
    ("pk-client", "tablet", "Presenter iPad or laptop and its charger", "Joins Wi-Fi DDIL", "confirm"),
    ("pk-pass", "key", "Wi-Fi passphrase card", "Kept with the kit lead, not in the repo", "confirm"),
]

# ------------------------------------------------------------------ the seven steps
# Each: id, title, body, cables [(type, end_a, end_b)], see, hs, callouts {hs: short label}
STEPS = [
    {"id": "s1", "num": "1", "title": "Lift the kit out of the case",
     "hs": ["K1", "S1", "B1", "B7", "S9"], "callouts": {"K1": "Handle", "S1": "Handle", "B1": "Grate", "B7": "Grate", "S9": "Grate side"},
     "body": "<p>The kit sits face down in the Pelican case. Grip the handle on top of the kit with one hand and the metal grate on the back of the kit with the other. Lift the kit straight out and stand it upright on a flat, hard surface with the touchscreen facing you. The front now looks like the <b>Packed</b> view.</p>"
             "<p>Keep the front face and the rear grates clear. The side view shows a solid glass side panel and the back view shows perforated grates, so air moves through the front and the rear. Do not lift by the touchscreen, the glass panel or a cable.</p>",
     "cables": [], "see": "The kit stands upright and level, the touchscreen faces you, and nothing is caught on the case foam."},
    {"id": "s2", "num": "2", "title": "Plug in the PDU power cable",
     "hs": ["B9", "K12", "BP8"], "callouts": {"B9": "Mains cable", "K12": "Leave OFF", "BP8": "Mains cable"},
     "body": "<p>Take the long PDU power cable out of the case. Check that the Kit Master Power switch on the PDU is off. The black mains cable exits at the rear bottom right of the kit (from the kit photo, 13 Nov 2026). Plug its other end into a wall outlet.</p>",
     "cables": [("Power", "PDU, exit at the rear bottom right", "Wall outlet")],
     "see": "The cable reaches the outlet without strain. The kit stays dark because master power is still off."},
    {"id": "s3a", "num": "3a", "title": "Find the JetKVM leads in the empty bay",
     "hs": ["K6", "K7", "K8", "K9"], "callouts": {"K6": "Empty bay", "K7": "USB-C", "K8": "USB-A", "K9": "RJ45"},
     "body": "<p>In transport the JetKVM is out of its bay on the front face. Three leads hang from the empty bay: a USB-C lead, a USB-A lead and an RJ45 Ethernet lead. Take the JetKVM out of the case.</p>",
     "cables": [], "see": "Three leads in the empty bay, matching the Packed view and the kit photo."},
    {"id": "s3b", "num": "3b", "title": "Plug in the JetKVM on the front face",
     "hs": ["F5", "FP6"], "callouts": {"F5": "Ethernet · HDMI · USB-C", "FP6": "JetKVM bay"},
     "body": "<p>Connect the JetKVM on the front face of the kit: Ethernet, HDMI and USB-C power. Then seat it in its bay.</p>"
             "<p>The bay also holds a USB-A lead that the kit lead's steps do not mention. Which lead carries HDMI, and what the USB-A lead connects to: [[fill:kvm-leads:which lead carries HDMI / what the USB-A lead connects to]] {UNC}</p>",
     "cables": [("Ethernet", "RJ45 lead from the bay", "JetKVM"),
                ("USB-C power", "USB-C lead from the bay", "JetKVM"),
                ("HDMI", "The lead named in the blank above", "JetKVM")],
     "see": "The JetKVM sits in its bay with its leads seated, as in the Set up view. Its screen comes up after master power (step 6).",
     "refs": [("ref-jetkvm.jpg", "JetKVM standard screen. IP and MAC blurred; your IP will differ.")]},
    {"id": "s3c", "num": "3c", "title": "Reconnect the UniFi Express 7 power lead",
     "hs": ["K11", "K10", "F6"], "callouts": {"K11": "Unplugged lead", "K10": "UniFi Express 7", "F6": "Plugged in"},
     "body": "<p>The white USB-C power lead of the UniFi Express 7 is unplugged for transport and hangs down to the lower row. Plug it back into the USB-C port in the middle of the UniFi Express 7.</p>",
     "cables": [("USB-C power", "White lead hanging to the lower row", "UniFi Express 7 USB-C port")],
     "see": "The lead loops from the UniFi down and back, as in the Set up view."},
    {"id": "s4", "num": "4", "title": "Plug the touchscreen into the back of the Framework",
     "hs": ["B2", "B3", "F2", "BP2", "BP3"], "callouts": {"B2": "HDMI", "B3": "USB-A", "F2": "Touchscreen", "BP2": "HDMI", "BP3": "USB-A"},
     "body": "<p>Connect the touchscreen to the back of the Framework PC with two cables: USB Type-A and HDMI. The HDMI carries the picture. The USB Type-A cable carries touch input; the kiosk launcher maps the touch device to the touchscreen output.</p>"
             "<p>The HDMI port is the leftmost port on the rear I/O plate, labelled HDMI. To its right sit two USB-C ports, two USB-A ports, the RJ45 port, a blue USB-A port and an audio jack (from the kit photo, 13 Nov 2026). Use one of the two USB-A ports.</p>",
     "cables": [("HDMI", "Touchscreen", "Framework HDMI (rear, leftmost)"),
                ("USB Type-A", "Touchscreen", "Framework USB Type-A (rear)")],
     "see": "Both plugs are seated at the Framework rear I/O and at the panel. The panel stays dark until master power is on.",
     "after": MOCK_NOTE},
    {"id": "s5", "num": "5", "title": "Connect the Ethernet cable to the Framework",
     "hs": ["B4", "BP4", "F7"], "callouts": {"B4": "Ethernet", "BP4": "Ethernet", "F7": "Switch"},
     "body": "<p>Connect the Ethernet cable to the RJ45 port on the back of the Framework PC.</p>"
             "<p>The network plan puts the Framework on switch port P2 {DOC}. Other end on this kit: [[fill:fw-eth-end:other end]]</p>",
     "cables": [("Ethernet", "Framework RJ45 (rear)", "[[fill:fw-eth-end:other end]]")],
     "see": "The RJ45 plug clicks into place. The link light comes on after master power is on."},
    {"id": "s6", "num": "6", "title": "Turn on Kit Master Power at the PDU",
     "hs": ["F8", "FP9"], "callouts": {"F8": "Master power ON", "FP9": "Glows red"},
     "body": "<p>Switch Kit Master Power on at the PDU. The rocker glows red when on (from the kit photo, 13 Nov 2026). Every device fed by the PDU receives power together. Watch the JetKVM come up and the boot sequence start on the touchscreen.</p>"
             "<p>The indicator timeline below lists what each device shows. If a node does not start by itself: [[fill:node-start:how to start it]] {UNC}</p>",
     "cables": [], "see": "The rocker glows red, the JetKVM shows its standard screen, the UniFi display reads Plug in Cable, and the touchscreen starts its boot sequence. Follow the timeline below.",
     "refs": [("ref-jetkvm.jpg", "JetKVM standard screen. IP and MAC blurred; your IP will differ."), ("ref-ux7.jpg", "UniFi Express 7 with no WAN uplink. Expected on the kit.")]},
    {"id": "s7", "num": "7", "title": "Connect to DDIL",
     "hs": ["F6"], "callouts": {"F6": "Wi-Fi DDIL"},
     "body": "<p>On the presenter iPad or laptop, join the Wi-Fi network <b>DDIL</b>, served by the UniFi gear in the kit.</p>"
             "<p>Passphrase: [[fill:passphrase:from the kit lead]]. The passphrase is not stored in the repo. Do not write it into this guide if the guide leaves the kit.</p>"
             "<p class=\"small\">The network plan document names the SSID DDIL-Demo {DOC}. The kit lead's name for it is DDIL.</p>",
     "cables": [],
     "see": "The device joins DDIL and receives an address in 192.168.1.100-199 (DHCP range per the network plan). The UniFi display still reads Plug in Cable; that is expected with no WAN uplink."},
]

# ------------------------------------------------------------------ indicator timeline after step 6
# (id, device, hs, what you should see (HTML), source tag)
TIMELINE = [
    ("t-pdu", "PDU master switch", ["F8", "FP9"],
     "The rocker glows red when on (from the kit photo, 13 Nov 2026).", "photo", []),
    ("t-kvm", "JetKVM", ["F5"],
     "Shows its standard screen: the JetKVM logo top left, \"N active\" sessions top right, the device IP address in large type with the MAC address below, and two status tiles at the bottom, USB and HDMI. The IP appears once Ethernet has a link. USB and HDMI read Disconnected until the Framework is up, then Connected. Your IP will differ from the photo.",
     "user", [("ref-jetkvm.jpg", "JetKVM standard screen. IP and MAC blurred.")]),
    ("t-ux7", "UniFi Express 7", ["F6"],
     "The front display reads <b>Plug in Cable / Ethernet Disconnected</b> in white-blue text on a dark pill-shaped screen, with a blue icon below. The kit has no WAN uplink, so this is the expected state for DDIL operation. The kit network still runs. It is not a fault.",
     "user", [("ref-ux7.jpg", "UniFi Express 7 display with no WAN uplink.")]),
    ("t-sw", "Switch Flex Mini", ["F7", "FP8"],
     "A blue status LED is visible next to its USB-C power lead (from the kit photo, 13 Nov 2026). The network plan says the port LEDs initialise and a link light shows on each connected port. Port link light colour: [[fill:t-sw:link light colour]]", "photo", []),
    ("t-spark", "DGX Spark", ["F4", "B6"],
     "Boots; Ollama starts under systemd. Power indicator: [[fill:t-spark:what shows]]", "unc", []),
    ("t-fw", "Framework Desktop", ["F3", "B5"],
     "Power indicator: [[fill:t-fw:what shows]]. If the branding script (<code>branding/deploy-splash.sh</code>) was deployed on this kit, the touchscreen shows the GRUB menu over an Elastic splash for about 3 s (<code>GRUB_TIMEOUT=3</code>), then the Plymouth boot splash, theme \"DDIL Vineyard Intelligence\". No record shows the script ran on this kit.",
     "repo", []),
    ("t-launch", "Touchscreen: kiosk launch", ["F2"],
     "<code>ddil-kiosk.service</code> runs <code>kiosk-launch.sh</code>: it sets the 1280x400 mode on the touchscreen output, maps touch input, disables blanking, hides the cursor and opens Chromium in kiosk mode at <code>http://localhost:3100/</code>, served by <code>ddil-kiosk-server.service</code>.",
     "repo", []),
    ("t-boot", "Touchscreen: Boot Diagnostics", ["F2"],
     "A dark screen with a monospace log on the right: \"booting sovereign-ai kernel...\", an ASCII banner, \"mounting airgapped service mesh...\", \"loading runtime registry... ok\", \"initializing service probes...\", then a probe line and an [ OK ] or [FAIL] line per service, \"all subsystems checked.\" and \"kit ready · awaiting demo handoff...\". The left panel lists six services: Elasticsearch (GPU), Elasticsearch (CPU), Ollama LLM, Ollama Embeddings, Demo Backend, Field Sensor Bus. Status dots: pulsing yellow while probing, teal with a glow for OK, pink with a glow for FAIL, dim white for not yet probed. The progress bar fills teal, or pink if any probe failed." + MOCK_NOTE,
     "repo", []),
    ("t-idle", "Touchscreen: Idle carousel", ["F2"],
     "About 2.2 s after \"kit ready\" the kiosk advances to Idle. Page 1, Branding: Elastic and DGX Spark identity either side of a QR code and the headline \"Sovereign AI / Context Engineering Anywhere\". Page 2, Diagnostics: hardware cards for the Framework and the DGX Spark. Swipe or use the page dots. Time from master power to Idle: [[fill:t-idle:minutes]]",
     "repo", []),
]

AFTER = {
    "title": "After power-on",
    "body": "<p>The kiosk health tiles use mock data (<code>MOCK = true</code>), so a healthy-looking touchscreen does not prove the services are up. The Jina embedding server needs a manual start after every boot. Run the software checks in the <a href=\"{RUNBOOK}\">kit configuration runbook</a> (<code>enablement/docs/pdf/02-kit-configuration-runbook.pdf</code>) (pages 4 to 7) before the first demo.</p>",
    "rows": [("Demo app (Adventure Chooser)", "http://192.168.1.10:3000"),
             ("Kiosk on the touchscreen", "port 3100 on the Framework (192.168.1.10:3100)")],
}

# ------------------------------------------------------------------ pack-down
PACKDOWN = [
    {"id": "p1", "title": "Shut down the demos", "hs": ["F2"], "callouts": {"F2": "Demos off"}, "rev": None,
     "body": "<p>Vineyard: sidebar Reset Demo. SEC Findings: Chapter 04 Reset conversation, then Esc. Multimodal: Exit to chooser. Close the browser on the presenter device.</p>",
     "cmds": [], "cables": [], "see": "The Adventure Chooser, then the browser closed."},
    {"id": "p2", "title": "Power off the Framework, then the DGX Spark", "hs": ["F3", "F4"], "callouts": {"F3": "1st", "F4": "2nd"}, "rev": None,
     "body": "<p>Shut down in this order: Framework first, then the DGX Spark. On the Spark, stop the Jina server with Ctrl-C in its session before the commands. Never add <code>-v</code> to <code>docker compose down</code>; it removes volumes that can hold index data.</p>",
     "cmds": [("cd ~/ddil/demo && docker compose down && sudo shutdown -h now", "Framework: four containers removed, then the OS powers off."),
              ("cd ~/ddil/docker && sg docker -c \"docker compose down\" && sudo shutdown -h now", "DGX Spark: es-gpu removed, then the OS powers off.")],
     "cables": [], "see": "Both nodes have finished shutting down. How to tell: [[fill:p-off:sign that a node is off]]"},
    {"id": "p3", "title": "Turn off Kit Master Power at the PDU", "hs": ["F8", "FP9"], "callouts": {"F8": "Master power OFF", "FP9": "Red glow goes out"}, "rev": "6",
     "body": "<p>Switch Kit Master Power off at the PDU only after both nodes have finished shutting down.</p>",
     "cmds": [], "cables": [], "see": "The red glow on the rocker goes out and everything fed by the PDU goes dark."},
    {"id": "p4", "title": "Disconnect the presenter device from DDIL", "hs": ["F6"], "callouts": {"F6": "Leave DDIL"}, "rev": "7",
     "body": "<p>Forget or leave the DDIL network on the iPad or laptop if it will join another network next.</p>",
     "cmds": [], "cables": [], "see": "The device is off the kit network."},
    {"id": "p5", "title": "Unplug the Framework Ethernet cable", "hs": ["B4", "BP4"], "callouts": {"B4": "Unplug", "BP4": "Unplug"}, "rev": "5",
     "body": "<p>Press the RJ45 latch and pull the plug from the Framework. Unplug the other end. Coil the cable loosely and stow it.</p>",
     "cmds": [], "cables": [("Ethernet", "Framework RJ45 (rear)", "[[fill:fw-eth-end:other end]]")], "see": "Cable coiled and in the case."},
    {"id": "p6", "title": "Unplug the touchscreen cables", "hs": ["B2", "B3", "BP2", "BP3"], "callouts": {"B2": "HDMI", "B3": "USB-A", "BP2": "HDMI", "BP3": "USB-A"}, "rev": "4",
     "body": "<p>Unplug the HDMI and the USB Type-A cables at the Framework and at the panel. Coil each one and stow it.</p>",
     "cmds": [], "cables": [("HDMI", "Touchscreen", "Framework HDMI (rear)"), ("USB Type-A", "Touchscreen", "Framework USB Type-A (rear)")],
     "see": "Two cables coiled and in the case."},
    {"id": "p7", "title": "Unplug the UniFi Express 7 power lead", "hs": ["F6", "K11"], "callouts": {"F6": "Unplug", "K11": "Let it hang"}, "rev": "3c",
     "body": "<p>Unplug the white USB-C power lead from the UniFi Express 7 and let it hang down to the lower row.</p>",
     "cmds": [], "cables": [("USB-C power", "White lead", "UniFi Express 7 USB-C port")], "see": "The lead hangs to the lower row, as in the Packed view."},
    {"id": "p7b", "title": "Lift the JetKVM out of its bay", "hs": ["F5", "K6", "K7", "K8", "K9"], "callouts": {"F5": "Unplug", "K6": "Empty bay", "K7": "USB-C", "K8": "USB-A", "K9": "RJ45"}, "rev": "3a, 3b",
     "body": "<p>Unplug the JetKVM's leads at the JetKVM, lift it out of its bay and pack it in the case. Leave the USB-C, USB-A and RJ45 leads hanging in the bay.</p>",
     "cmds": [], "cables": [], "see": "Three leads hang in the empty bay, as in the Packed view."},
    {"id": "p8", "title": "Unplug the PDU power cable", "hs": ["B9", "BP8"], "callouts": {"B9": "Coil", "BP8": "Coil"}, "rev": "2",
     "body": "<p>Pull the plug from the wall outlet. Coil the long black cable that leaves the rear bottom right of the kit and stow it in the case.</p>",
     "cmds": [], "cables": [("Power", "PDU, exit at the rear bottom right", "Wall outlet")], "see": "Long cable coiled and in the case."},
    {"id": "p9", "title": "Check the stow list", "hs": ["S7"], "callouts": {"S7": "Nothing loose"}, "rev": None,
     "body": "<p>Tick every item in the \"Back in\" column of the transport list. Look through the glass side panel and check that no internal cable has worked loose.</p>",
     "cmds": [], "cables": [], "see": "Every item ticked Back in."},
    {"id": "p10", "title": "Lift the kit back into the case, face down", "hs": ["K1", "S1", "B1", "B7"], "callouts": {"K1": "Handle", "S1": "Handle", "B1": "Grate", "B7": "Grate"}, "rev": "1",
     "body": "<p>Check the front matches the <b>Packed</b> view. Grip the handle on top and the metal grate on the back. Lower the kit into the Pelican case face down, the way it came out. Close and latch the lid.</p>",
     "cmds": [], "cables": [], "see": "Kit face down in the case, lid latched."},
]

TROUBLE = [
    ("Master power on, rocker not red, nothing lights", "PDU cable not plugged in, or the outlet is dead", "Step 2: reseat the plug; try another outlet."),
    ("JetKVM stays dark", "USB-C power lead not seated", "Step 3b: reseat the USB-C lead at the JetKVM."),
    ("No DDIL Wi-Fi and the UniFi display is dark", "UniFi USB-C power lead still unplugged", "Step 3c: plug the white lead into the UniFi Express 7."),
    ("Touchscreen stays dark", "HDMI not seated at the Framework, or the Framework is off", "Step 4; check the Framework powered on (timeline)."),
    ("Touchscreen picture stretched", "The panel reports a 1920x1080 EDID", "The kiosk launcher forces 1280x400; restart the kiosk on the Framework."),
    ("Touchscreen looks healthy but demos fail", "Kiosk health uses mock data", "Run the software checks in runbook 02."),
    ("DDIL network not visible", "UniFi not ready yet", "Wait for the status ring (about two minutes on first start)."),
    ("Joined DDIL, app does not load", "Services not started yet", "Runbook 02, pages 4 to 7. The Jina server needs a manual start."),
]
