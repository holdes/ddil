#!/usr/bin/env node
// Headless walk of every in-scope screen against the dev stub, via the Chrome DevTools Protocol (stdlib only).
// Saves screenshots to ../shots/ and prints console errors and HTTP >= 400 responses.
// Usage: node tools/walk.mjs [--only vineyard|sec|jina] [--url http://127.0.0.1:5180] [--stub http://127.0.0.1:8010]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(HERE, "..", "shots");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const URL0 = arg("--url", "http://127.0.0.1:5180");
const STUB = arg("--stub", "http://127.0.0.1:8010");
const ONLY = arg("--only", "all");
const PACE = arg("--pace", "0.35");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "devstub-walk-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1440,900",
  "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });

let ws, nextId = 1;
const pending = new Map();
const problems = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* not up yet */ }
    await sleep(200);
  }
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); return; }
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      if (!/React Router|DevTools|Download the React|width\(-1\) and height\(-1\) of chart/.test(text)) problems.push(`[console.${msg.params.type}] ${text.slice(0, 300)}`);
    }
    if (msg.method === "Runtime.exceptionThrown") problems.push(`[exception] ${msg.params.exceptionDetails.exception?.description?.slice(0, 300) || msg.params.exceptionDetails.text}`);
    if (msg.method === "Network.responseReceived" && msg.params.response.status >= 400) problems.push(`[http ${msg.params.response.status}] ${msg.params.response.url}`);
    if (msg.method === "Network.loadingFailed" && !msg.params.canceled) problems.push(`[net fail] ${msg.params.errorText} ${msg.params.requestId}`);
  };
}
const send = (method, params = {}) => new Promise((res, rej) => { const id = nextId++; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
async function js(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
let shotN = 0;
async function shot(name) {
  shotN += 1;
  const r = await send("Page.captureScreenshot", { format: "png" });
  const f = path.join(SHOTS, `${name}.png`);
  fs.writeFileSync(f, Buffer.from(r.data, "base64"));
  console.log(`shot ${f}`);
}
// Click the first visible element whose trimmed text equals (or, failing that, starts with) `text`.
async function click(text, sel = "button, a, [role=button]") {
  const ok = await js(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.offsetParent !== null || e.getClientRects().length);
    const t = ${JSON.stringify(text)};
    const el = els.find(e => e.innerText.trim() === t) || els.find(e => e.innerText.trim().startsWith(t)) || els.find(e => e.innerText.includes(t));
    if (!el) return false; el.scrollIntoView({block:"center"}); el.click(); return true; })()`);
  if (!ok) { problems.push(`[walk] could not find "${text}"`); console.log(`  !! missing "${text}"`); }
  return ok;
}
async function waitFor(cond, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await js(cond)) return true; await sleep(500); }
  problems.push(`[walk] timeout waiting for ${label}`); console.log(`  !! timeout ${label}`); return false;
}
const bodyHas = (s) => `document.body.innerText.includes(${JSON.stringify(s)})`;
async function key(k, code) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: code || k, windowsVirtualKeyCode: { ArrowRight: 39, ArrowLeft: 37, Escape: 27, Enter: 13 }[k] || k.charCodeAt(0) });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || k });
}
async function typeInto(selector, text) {
  await js(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await send("Input.insertText", { text });
}
async function goChooser() {
  await send("Page.navigate", { url: URL0 });
  await sleep(2500);
  await js(`localStorage.clear()`);
}

async function vineyard() {
  await goChooser();
  await shot("00-chooser");
  await click("Vineyard Intelligence", "button, a, [role=button], div[class*=cursor]");
  await sleep(1500); await shot("v01-architecture");
  await click("Continue"); await sleep(1500); await shot("v02-race-intro");
  await click("Start the Race"); await sleep(8000); await shot("v03-race-mid");
  await waitFor(bodyHas("Continue to Demo"), 70000, "race complete"); await sleep(1500);
  await shot("v04-race-complete");
  await click("Continue to Demo"); await sleep(2500); await shot("v05-dashboard");
  await click("Vineyard", "nav button"); await sleep(3000); await shot("v06-map");
  await js(`(() => { const p=[...document.querySelectorAll('path.leaflet-interactive')]; p[2] && p[2].dispatchEvent(new MouseEvent('click',{bubbles:true})); return p.length })()`);
  await sleep(1200); await shot("v07-map-block");
  await click("AI Agronomist", "nav button"); await sleep(1500); await shot("v08-agent-start");
  await click("Why is La Rivière");
  await sleep(6000); await shot("v09-agent-running");
  await waitFor(`document.querySelectorAll('svg.animate-spin').length===0 && ${bodyHas("Action Plan")}`, 90000, "agent complete");
  await sleep(1500); await shot("v10-agent-complete");
  await js(`[...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)).forEach(e => e.scrollTop = e.scrollHeight)`); await sleep(500); await shot("v10b-agent-complete-bottom");
  await click("Search", "nav button"); await sleep(800);
  await typeInto("input", "potassium drainage La Rivière"); await click("Search", "main button"); await sleep(1500); await shot("v11-search-hybrid");
  await click("BM25"); await click("Search", "main button"); await sleep(1200); await shot("v12-search-bm25");
  await click("Crop Health", "nav button"); await sleep(800);
  const fig = path.resolve(HERE, "..", "..", "mock", "data", "figs", "PMC10500001", "figure-2-1.jpg");
  const { root } = await send("DOM.getDocument", {});
  const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[type=file]" });
  if (nodeId) await send("DOM.setFileInputFiles", { nodeId, files: [fig] }); else problems.push("[walk] no file input on Crop Health");
  await sleep(2500); await shot("v13-crop-health");
  await click("Indexing Race", "nav button"); await sleep(1500); await shot("v14-race-tab");
  await click("System", "nav button"); await sleep(1200); await shot("v15-system");
}

async function sec() {
  await goChooser();
  await click("SEC Findings", "button, a, [role=button], div[class*=cursor]"); await sleep(2000);
  await shot("s00-setup");
  await key("ArrowRight"); await sleep(1500);
  await click("Start Race"); await sleep(8000); await shot("s01-speed-mid");
  await waitFor(`!${bodyHas("Running…")}`, 70000, "sec race complete"); await sleep(2500);
  await js(`document.querySelectorAll('button').forEach(b=>{ if(/^(close|dismiss|×|continue)$/i.test(b.innerText.trim())) b.click(); })`);
  await shot("s01-speed-complete");
  await key("ArrowRight"); await sleep(1800); await shot("s02-side-by-side");
  await key("ArrowRight"); await sleep(1500); await shot("s025-elastic");
  await key("ArrowRight"); await sleep(1800); await shot("s03-interface");
  await click("AI model risk"); if (!(await js(bodyHas("ms")))) await sleep(500);
  await sleep(2000); await shot("s03-interface-search");
  await key("ArrowRight"); await sleep(1800); await shot("s04-agentic");
  await click("Compare AI risk disclosures"); await sleep(12000); await shot("s04-agentic-running");
  await waitFor(`${bodyHas("DONE")} || ${bodyHas("done")} && !${bodyHas("STREAMING")}`, 90000, "agent builder done");
  await sleep(2000); await shot("s04-agentic-done");
  await js(`document.querySelectorAll("details[open]").forEach(d => d.open = false); window.scrollTo(0, document.body.scrollHeight); [...document.querySelectorAll("*")].filter(e => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)).forEach(e => e.scrollTop = e.scrollHeight)`);
  await sleep(800); await shot("s04-agentic-answer");
  await key("ArrowRight"); await sleep(1500); await shot("s045-workflows");
  await key("ArrowRight"); await sleep(1500); await shot("s05-stack");
}

async function jina() {
  await goChooser();
  await click("Multimodal Intelligence", "button, a, [role=button], div[class*=cursor]"); await sleep(1800);
  await shot("j01-image-empty");
  await click("a red square"); await sleep(1500); await shot("j02-image-red-square");
  await click("Caption vectors"); await sleep(1500); await shot("j03-image-caption");
  await click("Need-to-Know"); await sleep(2000); await shot("j04-ntk-public-browse");
  const q = "What is known about gut microbiome and immunity?";
  await click(q); await waitFor(`!document.querySelector('main svg.animate-spin')`, 40000, "public answer"); await sleep(1000);
  await shot("j05-ntk-public-answer");
  for (const [name, label] of [["secret_si", "Analyst A"], ["ts_hcs", "Analyst B"], ["ts_all", "Senior Analyst"]]) {
    await click(label); await sleep(1200);
    await click("Ask"); await sleep(1500);
    await waitFor(`!document.querySelector('main svg.animate-spin')`, 40000, `${name} answer`); await sleep(1200);
    await shot(`j06-ntk-${name}`);
  }
  const imgs = await js(`[...document.querySelectorAll('main img')].map(i=>[i.src.replace(location.origin,''), i.naturalWidth])`);
  console.log("figure images:", JSON.stringify(imgs));
  imgs.filter(([, w]) => !w).forEach(([s]) => problems.push(`[img] did not load ${s}`));
  const pdf = await js(`(document.querySelector('a[href^="/api/jina/pdf/"]')||{}).getAttribute ? document.querySelector('a[href^="/api/jina/pdf/"]').getAttribute('href') : null`);
  if (pdf) {
    const r = await js(`fetch(${JSON.stringify(pdf)}).then(r=>r.status+' '+r.headers.get('content-type')+' '+r.headers.get('content-length'))`);
    console.log("pdf link", pdf, r);
    await send("Page.navigate", { url: URL0 + pdf }); await sleep(3500); await shot("j07-pdf-viewer");
  } else problems.push("[walk] no PDF link found");
  const fig = imgs.find(([s]) => s.startsWith("/api/jina/figimg/"));
  if (fig) { await send("Page.navigate", { url: URL0 + fig[0] }); await sleep(1500); await shot("j08-figure"); }
}

try {
  await connect();
  for (const d of ["Runtime", "Network", "Page", "Log", "DOM"]) await send(`${d}.enable`);
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await fetch(`${STUB}/devstub/pace`, { method: "POST", body: JSON.stringify({ pace: Number(PACE) }) });
  if (ONLY === "all" || ONLY === "vineyard") await vineyard();
  if (ONLY === "all" || ONLY === "sec") await sec();
  if (ONLY === "all" || ONLY === "jina") await jina();
} catch (e) {
  problems.push(`[walk crash] ${e.stack || e}`);
} finally {
  await fetch(`${STUB}/devstub/pace`, { method: "POST", body: JSON.stringify({ pace: 1 }) }).catch(() => {});
  console.log(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.log("  " + p));
  try { ws.close(); } catch { /* */ }
  chrome.kill();
  await sleep(500); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* chrome still writing */ }
  process.exit(0);
}
