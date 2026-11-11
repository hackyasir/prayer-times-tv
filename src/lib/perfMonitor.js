// ── perfMonitor — opt-in performance overlay (add ?perf to the URL) ─────────
//
// Smart-TV browsers rarely have developer tools, so this measures the
// dashboard from inside the page and shows the numbers on screen. It does
// nothing unless the URL contains `?perf` (e.g. http://tv-host/?perf).
//
// What it measures (rolling, since load or the last reset):
//   tick ms      — time from the 1-second clock tick to React finishing the
//                  update (render + commit). Avg and 95th percentile.
//   DOM changes  — DOM mutation records per second under #root (text,
//                  attributes, added/removed nodes) — work the browser must
//                  then restyle / repaint.
//   formatters   — Intl.DateTimeFormat objects created per second (these
//                  are slow to construct, especially on TV browsers).
//   frames       — frame rate and frames slower than 50 ms (visible jank).
//   long tasks   — main-thread tasks over 50 ms (where supported).
//   DOM nodes    — total elements on the page.
//
// window.__perf.snapshot() returns the same numbers as an object, and
// window.__perf.reset() starts a new measurement window.

const enabled =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf');

let tickStart = 0;
const tickDurations = [];
let mutations = 0;
let formatters = 0;
let frames = 0;
let slowFrames = 0;
let longTasks = 0;
let longTaskMs = 0;
let windowStart = 0;

/** Called by the 1-second clock tick, just before it updates state. */
export function perfTickStart() {
  if (enabled) tickStart = performance.now();
}

/** Called after App commits; records the tick → commit time once per tick. */
export function perfCommit() {
  if (!enabled || !tickStart) return;
  tickDurations.push(performance.now() - tickStart);
  if (tickDurations.length > 600) tickDurations.shift();
  tickStart = 0;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function snapshot() {
  const secs = Math.max(0.001, (performance.now() - windowStart) / 1000);
  const avg = tickDurations.reduce((a, b) => a + b, 0) / (tickDurations.length || 1);
  return {
    seconds: Math.round(secs),
    ticks: tickDurations.length,
    tickAvgMs: +avg.toFixed(2),
    tickP95Ms: +percentile(tickDurations, 95).toFixed(2),
    domChangesPerSec: +(mutations / secs).toFixed(1),
    formattersPerSec: +(formatters / secs).toFixed(1),
    fps: +(frames / secs).toFixed(1),
    slowFrames,
    longTasks,
    longTaskMs: Math.round(longTaskMs),
    domNodes: document.getElementsByTagName('*').length,
  };
}

function reset() {
  tickDurations.length = 0;
  mutations = 0;
  formatters = 0;
  frames = 0;
  slowFrames = 0;
  longTasks = 0;
  longTaskMs = 0;
  windowStart = performance.now();
}

function start() {
  windowStart = performance.now();

  // Count Intl.DateTimeFormat constructions (called with or without `new`).
  const Original = Intl.DateTimeFormat;
  Intl.DateTimeFormat = new Proxy(Original, {
    construct(target, args) {
      formatters++;
      return Reflect.construct(target, args);
    },
    apply(target, thisArg, args) {
      formatters++;
      return Reflect.apply(target, thisArg, args);
    },
  });

  // Frame timing.
  let last = performance.now();
  const onFrame = (t) => {
    frames++;
    if (t - last > 50) slowFrames++;
    last = t;
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);

  // Long tasks, where the browser supports them.
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks++;
        longTaskMs += entry.duration;
      }
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    // Not supported (many TV browsers) — the other numbers still work.
  }

  // DOM mutations under the app root (the overlay itself is outside it).
  const observeRoot = () => {
    const root = document.getElementById('root');
    if (!root) return void setTimeout(observeRoot, 100);
    new MutationObserver((records) => {
      mutations += records.length;
    }).observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  };
  observeRoot();

  // On-screen overlay, refreshed every 2 seconds.
  const box = document.createElement('pre');
  box.id = 'perf-overlay';
  box.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:8px 10px;' +
    'background:rgba(0,0,0,.85);color:#7CFC9A;font:12px/1.4 monospace;' +
    'border:1px solid #2e7d32;border-radius:6px;pointer-events:none;white-space:pre';
  const paint = () => {
    const s = snapshot();
    box.textContent =
      `perf (${s.seconds}s)\n` +
      `tick      ${s.tickAvgMs} ms avg · ${s.tickP95Ms} p95\n` +
      `DOM       ${s.domChangesPerSec} changes/s\n` +
      `formatter ${s.formattersPerSec} new/s\n` +
      `frames    ${s.fps} fps · ${s.slowFrames} slow\n` +
      `longtask  ${s.longTasks} (${s.longTaskMs} ms)\n` +
      `nodes     ${s.domNodes}`;
  };
  const mount = () => {
    if (!document.body) return void setTimeout(mount, 100);
    document.body.appendChild(box);
    paint();
    setInterval(paint, 2000);
  };
  mount();

  window.__perf = { snapshot, reset };
}

if (enabled) start();
