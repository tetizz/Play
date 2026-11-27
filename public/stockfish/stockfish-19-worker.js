/* Stockfish 19 UCI Worker adapter for @lichess-org/stockfish-web 0.5.0.
 * GPL-3.0-or-later. See STOCKFISH-SOURCE.md and upstream notices.
 * Use new Worker(url, { type: 'module' }).
 */
const variants = {
  lite: { module: 'sf_19_smallnet.js', network: 'nn-61e7af4bb97d.nnue' },
};
const selected = new URL(self.location.href).searchParams.get('variant') || 'lite';
let engine;
let failed = false;
const pending = [];

function fail(error) {
  if (failed) return;
  failed = true;
  pending.length = 0;
  // A real Worker error reaches existing consumers' onerror handlers.
  setTimeout(() => { throw error instanceof Error ? error : new Error(String(error)); }, 0);
}

self.onmessage = ({ data }) => {
  if (failed) return;
  if (typeof data !== 'string') return;
  if (engine) {
    try { engine.uci(data); } catch (error) { fail(error); }
  } else if (pending.length < 256) {
    pending.push(data);
  } else {
    fail(new Error('Stockfish initialization command queue is full.'));
  }
};

async function initialize() {
  const variant = variants[selected];
  if (!variant) throw new Error('Unknown Stockfish 19 variant.');
  if (!self.crossOriginIsolated || typeof SharedArrayBuffer !== 'function') {
    throw new Error('Stockfish 19 requires cross-origin isolation (COOP/COEP).');
  }
  const moduleUrl = new URL(variant.module, import.meta.url);
  const { default: createStockfish } = await import(moduleUrl.href);
  const instance = await createStockfish({
    mainScriptUrlOrBlob: moduleUrl.href,
    locateFile: (name) => new URL(name, moduleUrl).href,
    listen: (line) => self.postMessage(line),
    onError: (line) => self.postMessage(`info string ${line}`),
    onExit: (code) => {
      if (code) fail(new Error(`Stockfish exited with code ${code}.`));
      else self.close();
    },
  });
  if (instance.getRecommendedNnue(0) !== variant.network || instance.getRecommendedNnue(1)) {
    throw new Error('Stockfish neural network does not match the pinned distribution.');
  }
  const response = await fetch(new URL(variant.network, import.meta.url));
  if (!response.ok) throw new Error(`Stockfish network request failed (${response.status}).`);
  instance.setNnueBuffer(new Uint8Array(await response.arrayBuffer()), 0);
  if (failed) return;
  engine = instance;
  for (const command of pending.splice(0)) engine.uci(command);
}

initialize().catch(fail);
