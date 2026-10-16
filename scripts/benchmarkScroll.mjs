/* global window, document, requestAnimationFrame */
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

// Follow-up benchmark of a full visit: plays the intro, then wheels through the
// whole museum at a steady pace and reports frame times per chapter, long
// animation frames and canvas memory. Run `npm run build` first.
// Usage: npm run benchmark:scroll -- [label] [outDir]
const label = process.argv[2] ?? 'current';
const outDir = process.argv[3] ?? 'dist';
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Use a simple report label');
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5198, strictPort: true }, logLevel: 'error' });
// Headless Chromium falls back to software GL; ANGLE on D3D11 reaches the real GPU on Windows
const gpuArgs = ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])];
let browser;
try {
  browser = await chromium.launch({ args: gpuArgs });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const bench = { phase: 'intro', frames: [], loaf: [] };
    window.__scrollBench = bench;
    const scrollTop = () => Math.round(document.querySelector('.mo-root')?.scrollTop ?? 0);
    let previous;
    const tick = now => {
      if (previous !== undefined && bench.phase) bench.frames.push([bench.phase, now - previous, scrollTop()]);
      previous = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        bench.loaf.push({
          phase: bench.phase,
          at: Math.round(entry.startTime),
          ms: Math.round(entry.duration),
          y: scrollTop(),
          scripts: entry.scripts.slice(0, 3).map(script => `${Math.round(script.duration)}ms ${script.invoker}`),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  });

  await page.goto('http://127.0.0.1:5198/AstroIngenieria/', { waitUntil: 'load' });
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  const canvasBytes = () => page.evaluate(() =>
    [...document.querySelectorAll('canvas')].reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0));
  // The first-visit intro (nebula flight) ends well within this window
  await page.waitForTimeout(14000);
  const canvasAfterIntro = await canvasBytes();

  await page.evaluate(() => { window.__scrollBench.phase = ''; });
  const sections = await page.evaluate(() => {
    const root = document.querySelector('.mo-root');
    return [...document.querySelectorAll('[id^="sala-"]')].map(section => {
      const rect = section.getBoundingClientRect();
      return { id: section.id.replace('sala-', ''), top: Math.round(rect.top + root.scrollTop), bottom: Math.round(rect.bottom + root.scrollTop) };
    }).sort((a, b) => a.top - b.top);
  });
  await page.mouse.move(1150, 540);
  await page.evaluate(() => { window.__scrollBench.phase = 'scroll'; });
  let peakCanvas = canvasAfterIntro;
  let lastTop = -1;
  // Native wheel input; the finale loops back to the start, so stop at the
  // bottom or as soon as the page wraps around
  for (let step = 1; step <= 4000; step++) {
    await page.mouse.wheel(0, 110);
    await page.waitForTimeout(45);
    if (step % 25) continue;
    const sample = await page.evaluate(() => {
      const root = document.querySelector('.mo-root');
      const canvas = [...document.querySelectorAll('canvas')].reduce((sum, item) => sum + item.width * item.height * 4, 0);
      return { top: root.scrollTop, max: root.scrollHeight - root.clientHeight, canvas };
    });
    peakCanvas = Math.max(peakCanvas, sample.canvas);
    if (sample.top >= sample.max - 2 || sample.top < lastTop - 5000) break;
    lastTop = sample.top;
  }
  await page.evaluate(() => { window.__scrollBench.phase = ''; });
  const bench = await page.evaluate(() => window.__scrollBench);
  const heapMb = await page.evaluate(() => Math.round((window.performance.memory?.usedJSHeapSize ?? 0) / 1e6));

  const summarize = deltas => {
    const sorted = [...deltas].sort((a, b) => a - b);
    const at = q => Number((sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0).toFixed(1));
    return {
      frames: sorted.length,
      p50: at(0.5),
      p95: at(0.95),
      slowPct: Number(((100 * sorted.filter(ms => ms > 20).length) / Math.max(1, sorted.length)).toFixed(1)),
      worst: Math.round(sorted[sorted.length - 1] ?? 0),
    };
  };
  const sectionOf = top => {
    if (!sections.length || top < sections[0].top) return 'hero';
    const last = sections[sections.length - 1];
    if (top >= last.bottom) return 'finale';
    return sections.filter(section => top >= section.top).pop().id;
  };
  const intro = bench.frames.filter(([phase]) => phase === 'intro').map(([, ms]) => ms);
  const scroll = bench.frames.filter(([phase]) => phase === 'scroll');
  const order = ['hero', ...sections.map(section => section.id), 'finale'];
  const perSection = order
    .map(id => ({ section: id, ...summarize(scroll.filter(([, , top]) => sectionOf(top) === id).map(([, ms]) => ms)) }))
    .filter(row => row.frames > 0);
  const report = {
    label,
    gpu,
    note: 'Headless Chromium at 1920x1080, DPR 1; wheel of 110 px every ~45 ms.',
    errors,
    intro: { ...summarize(intro), gapsOver100ms: intro.filter(ms => ms > 100).map(Math.round) },
    scroll: summarize(scroll.map(([, ms]) => ms)),
    perSection,
    canvasMb: { afterIntro: Math.round(canvasAfterIntro / 1e6), peak: Math.round(peakCanvas / 1e6) },
    heapMb,
    longFrames: bench.loaf.filter(entry => entry.ms >= 100).map(entry => ({ ...entry, section: entry.phase === 'scroll' ? sectionOf(entry.y) : entry.phase || 'idle' })),
  };
  await mkdir('output/museum-benchmark', { recursive: true });
  await writeFile(`output/museum-benchmark/scroll-${label}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(`${label} · ${gpu}`);
  console.log('intro', report.intro, 'canvas MB', report.canvasMb, 'heap MB', heapMb);
  console.table(perSection);
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
