#!/usr/bin/env node
// DDIL demo dev stub: a stand-in for demo/backend on a laptop with no kit.
// Node stdlib only (http, crypto, zlib). Binds 127.0.0.1. Makes no outbound network calls.
// Usage: node server.mjs [--port 8000]   env: DEVSTUB_PORT, DEVSTUB_PACE (agent/LLM delay multiplier, default 1)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { loadMock, MOCK_DIR, REPO } from "./lib/seed.mjs";
import { makeVineyard } from "./lib/vineyard.mjs";
import { makeSec } from "./lib/sec.mjs";
import { makeJina } from "./lib/jina.mjs";
import { makeRace } from "./lib/race.mjs";

const argPort = process.argv.indexOf("--port");
const PORT = Number(argPort > 0 ? process.argv[argPort + 1] : process.env.DEVSTUB_PORT || 8000);
const HOST = "127.0.0.1";
let PACE = Number(process.env.DEVSTUB_PACE || 1);
const pace = () => PACE;
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

const t0 = Date.now();
const M = loadMock();
const deps = { sleep, pace };
const vineyard = makeVineyard(M, deps);
const sec = makeSec(M, deps);
const jina = makeJina(M, deps);
const race = makeRace();

const TILE_DIR = path.join(REPO, "demo", "data", "tiles");
const FIG_DIR = path.join(MOCK_DIR, "data", "figs");
const PDF_DIR = path.join(MOCK_DIR, "data", "pdfs");

// ── helpers ──────────────────────────────────────────────────────────────────
function log(req, status, extra = "") {
  const ms = Date.now() - req._t0;
  console.log(`${new Date().toISOString().slice(11, 19)} ${status} ${req.method} ${req.url} ${ms}ms${extra ? " " + extra : ""}`);
}
function json(req, res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": body.length, "Access-Control-Allow-Origin": "*" });
  res.end(body);
  log(req, status);
}
const notFound = (req, res, detail = "Not Found") => json(req, res, 404, { detail });
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => resolve(Buffer.alloc(0)));
  });
}
async function readJson(req) {
  const b = await readBody(req);
  if (!b.length) return {};
  try { return JSON.parse(b.toString("utf8")); } catch { return null; }
}
function sendFile(req, res, file, type) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(req, res, "file not found");
    res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Cache-Control": "max-age=3600" });
    fs.createReadStream(file).pipe(res);
    log(req, 200);
  });
}
function safeJoin(base, rel) {
  const root = path.resolve(base);
  const target = path.resolve(root, rel);
  return target.startsWith(root + path.sep) ? target : null;
}
function startSse(req, res) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders?.();
  let closed = false;
  res.on("close", () => { closed = true; });
  const send = (event, data) => { if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  return { send, isClosed: () => closed, end: (note) => { if (!closed) res.end(); log(req, 200, `sse ${note || ""}`.trim()); } };
}

// Placeholder map tile (256x256, dark neutral) for any z/x/y the local tile set lacks.
const PLACEHOLDER_TILE = (() => {
  const w = 256, row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) row.set([0x1b, 0x1f, 0x26], 1 + x * 3);
  const raw = Buffer.concat(Array(w).fill(row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(w, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
})();

// ── routes ───────────────────────────────────────────────────────────────────
async function route(req, res) {
  const url = new URL(req.url, `http://${HOST}`);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const q = url.searchParams;
  const m = req.method;

  if (m === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Allow-Headers": "*" }); res.end(); return log(req, 204); }

  // health + stub control
  if (p === "/api/health") return json(req, res, 200, { status: "ok", service: "vineyard-intelligence", stub: true });
  if (p === "/devstub/pace" && m === "POST") { const b = await readJson(req); if (b && b.pace > 0) PACE = Number(b.pace); return json(req, res, 200, { pace: PACE }); }

  // tiles
  let mt = /^\/tiles\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(p);
  if (mt && m === "GET") {
    const f = path.join(TILE_DIR, mt[1], mt[2], `${mt[3]}.png`);
    if (fs.existsSync(f)) return sendFile(req, res, f, "image/png");
    res.writeHead(200, { "Content-Type": "image/png", "Content-Length": PLACEHOLDER_TILE.length });
    res.end(PLACEHOLDER_TILE);
    return log(req, 200, "placeholder");
  }

  // race
  if (p === "/api/race/start" && m === "POST") { await readBody(req); race.start(); return json(req, res, 200, { status: "started", index: "race-soil" }); }
  if (p === "/api/race/reset" && m === "POST") { await readBody(req); race.reset(); return json(req, res, 200, { status: "reset" }); }

  // vineyard
  if (p === "/api/vineyard/config" && m === "GET") return json(req, res, 200, vineyard.config());
  if (p === "/api/vineyard/dashboard" && m === "GET") return json(req, res, 200, vineyard.dashboard());
  mt = /^\/api\/vineyard\/blocks\/([^/]+)\/summary$/.exec(p);
  if (mt && m === "GET") return json(req, res, 200, vineyard.blockSummary(decodeURIComponent(mt[1])));
  if (p === "/api/chat/agent/stream" && m === "POST") {
    const body = await readJson(req);
    if (!body || typeof body.message !== "string") return json(req, res, 422, { detail: [{ loc: ["body", "message"], msg: "Field required", type: "missing" }] });
    const sse = startSse(req, res);
    await vineyard.agentStream(body, sse.send, sse.isClosed);
    return sse.end("agent");
  }
  if (p === "/api/chat" && m === "POST") return json(req, res, 200, vineyard.chat((await readJson(req)) || {}));
  if (p === "/api/search" && m === "POST") {
    const body = await readJson(req);
    if (!body || typeof body.query !== "string") return json(req, res, 422, { detail: [{ loc: ["body", "query"], msg: "Field required", type: "missing" }] });
    await sleep(40 * pace());
    return json(req, res, 200, vineyard.search(body));
  }
  if (p === "/api/images/search" && m === "POST") { await readBody(req); await sleep(700 * pace()); return json(req, res, 200, vineyard.leaf()); }
  if (p === "/api/sensors/latest" && m === "GET") return json(req, res, 200, vineyard.sensorLatest());

  // SEC
  if (p === "/api/finance/sectors" && m === "GET") return json(req, res, 200, sec.sectors());
  if (p === "/api/finance/agent/state" && m === "GET") return json(req, res, 200, sec.state());
  if (p === "/api/finance/search" && m === "POST") {
    const body = await readJson(req);
    if (!body || typeof body.query !== "string") return json(req, res, 422, { detail: [{ loc: ["body", "query"], msg: "Field required", type: "missing" }] });
    return json(req, res, 200, await sec.search(body));
  }
  if (p === "/api/finance/agent/chat" && m === "POST") {
    const body = await readJson(req);
    if (!body || typeof body.input !== "string") return json(req, res, 422, { detail: [{ loc: ["body", "input"], msg: "Field required", type: "missing" }] });
    const sse = startSse(req, res);
    await sec.agentChat(body, sse.send, sse.isClosed);
    return sse.end("agent-builder");
  }

  // Jina
  if (p === "/api/jina/analysts" && m === "GET") return json(req, res, 200, jina.analysts());
  if (p === "/api/jina/state" && m === "GET") return json(req, res, 200, jina.state());
  if (p === "/api/jina/multimodal/search" && m === "GET") {
    const text = q.get("q") || "";
    const space = q.get("space") || "image";
    const k = Math.max(1, Math.min(24, Number(q.get("k") || 6)));
    if (!text || !["image", "caption"].includes(space)) return json(req, res, 422, { detail: "invalid q or space" });
    return json(req, res, 200, await jina.multimodal(text, space, k));
  }
  if (p === "/api/jina/search" && m === "GET") return json(req, res, 200, await jina.search(q.get("q") || "", q.get("analyst") || "public"));
  if (p === "/api/jina/analyst/answer" && m === "GET") {
    const text = q.get("q") || "";
    if (!text) return json(req, res, 422, { detail: "q is required" });
    return json(req, res, 200, await jina.answer(text, q.get("analyst") || "public"));
  }
  mt = /^\/api\/jina\/figimg\/(.+)$/.exec(p);
  if (mt && m === "GET") {
    const f = safeJoin(FIG_DIR, decodeURIComponent(mt[1]));
    if (!f) return json(req, res, 400, { detail: "bad path" });
    return sendFile(req, res, f, f.endsWith(".png") ? "image/png" : "image/jpeg");
  }
  mt = /^\/api\/jina\/pdf\/([^/]+)$/.exec(p);
  if (mt && m === "GET") {
    const f = safeJoin(PDF_DIR, `${decodeURIComponent(mt[1])}.pdf`);
    if (!f) return json(req, res, 400, { detail: "bad path" });
    return sendFile(req, res, f, "application/pdf");
  }
  mt = /^\/api\/jina\/image\/([^/]+)$/.exec(p);
  if (mt && m === "GET") {
    const svg = jina.imageSvg(decodeURIComponent(mt[1]));
    if (!svg) return notFound(req, res, "image not found");
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Content-Length": Buffer.byteLength(svg) });
    res.end(svg);
    return log(req, 200);
  }

  // Out of scope: Edge Federation (CCS). The frontend handles errors on these.
  if (p.startsWith("/api/ccs")) return notFound(req, res, "CCS / Edge Federation is out of scope for the dev stub");
  return notFound(req, res);
}

const server = http.createServer((req, res) => {
  req._t0 = Date.now();
  route(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) json(req, res, 500, { detail: String(e && e.message || e) });
    else res.end();
  });
});

// ── WebSocket /api/race/status (RFC 6455, server side, text frames only) ─────
function wsFrame(str, opcode = 0x1) {
  const payload = Buffer.from(str);
  const n = payload.length;
  let head;
  if (n < 126) head = Buffer.from([0x80 | opcode, n]);
  else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([head, payload]);
}
server.on("upgrade", (req, socket) => {
  req._t0 = Date.now();
  const p = new URL(req.url, `http://${HOST}`).pathname;
  const key = req.headers["sec-websocket-key"];
  if (p !== "/api/race/status" || !key) {
    socket.end("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
    return log(req, 404, "ws");
  }
  const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  log(req, 101, "ws open");
  let open = true;
  const close = (code = 1000) => {
    if (!open) return;
    open = false;
    const b = Buffer.alloc(2); b.writeUInt16BE(code);
    try { socket.write(Buffer.concat([Buffer.from([0x88, 2]), b])); socket.end(); } catch { /* gone */ }
  };
  socket.on("data", (buf) => {
    const opcode = buf[0] & 0x0f;
    if (opcode === 0x8) close();
    else if (opcode === 0x9) { try { socket.write(Buffer.from([0x8a, 0])); } catch { /* gone */ } }
  });
  socket.on("close", () => { open = false; });
  socket.on("error", () => { open = false; });
  // Same loop as routers/race.py: send every 500 ms; on complete, send once more after 1 s and close.
  (async () => {
    while (open) {
      const d = race.toDict();
      socket.write(wsFrame(JSON.stringify(d)));
      if (d.status === "complete") {
        await sleep(1000);
        if (open) socket.write(wsFrame(JSON.stringify(race.toDict())));
        close();
        break;
      }
      await sleep(500);
    }
  })().catch(() => close(1011));
});

server.on("error", (e) => {
  console.error(`devstub: cannot listen on ${HOST}:${PORT}: ${e.message}`);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  const st = jina.stats();
  console.log(`devstub listening on http://${HOST}:${PORT} (pace ${PACE}, loaded in ${Date.now() - t0} ms)`);
  console.log(`  corpus ${st.papers} papers / ${st.chunks} chunks; markings.py drift vs packed corpus: ${jina.markingDrift}; reference-list chunks excluded: ${jina.refChunks}`);
  console.log(`  tiles ${fs.existsSync(TILE_DIR) ? TILE_DIR : "(none, placeholder only)"}`);
  console.log(`  figs ${fs.existsSync(FIG_DIR) ? "present" : "MISSING (run enablement/mock/tools/pack_corpus.py)"}; pdfs ${fs.existsSync(PDF_DIR) ? "present" : "MISSING"}`);
});
