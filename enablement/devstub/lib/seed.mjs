// Loads the trainer mock's canned data (enablement/mock/js/data-*.js) and the corpus search
// (corpus-search.js) into a sandbox, so the stub serves the same seed values as the practice mock.
// Nothing here is copied by hand: the files are evaluated as-is with a fake `window`.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ENABLEMENT = path.resolve(HERE, "..", "..");
export const REPO = path.resolve(ENABLEMENT, "..");
export const MOCK_DIR = path.join(ENABLEMENT, "mock");

const FILES = ["data-corpus.js", "corpus-search.js", "data-vineyard.js", "data-sec.js", "data-jina.js"];

export function loadMock() {
  const ctx = { window: {}, performance, console };
  ctx.window.MOCK = { data: {}, screens: {} };
  vm.createContext(ctx);
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(MOCK_DIR, "js", f), "utf8");
    vm.runInContext(src, ctx, { filename: f });
  }
  const M = ctx.window.MOCK;
  return M;
}
