/* global window, requestAnimationFrame */
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const label = process.argv[2] ?? 'current';
const outDir = process.argv[3] ?? 'dist';
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Use a simple report label');
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5197, strictPort: true }, logLevel: 'error' });
let browser;
const results = [];
try {
  browser = await chromium.launch();
  for (let pass = 1; pass <= 3; pass++) for (const profile of ['desktop', 'mobile']) {
    const context = await browser.newContext(profile === 'desktop'
      ? { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }
      : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    for (const scene of ['hero', 'gallery', 'reader']) {
      const base = 'http://127.0.0.1:5197/AstroIngenieria/';
      await page.goto(base + (scene === 'reader' ? '#obra-oneill-cylinder' : ''), { waitUntil: 'networkidle' });
      if (scene === 'gallery') await page.locator('#sala-habitats').scrollIntoViewIfNeeded();
      if (scene === 'reader') await page.locator('#article-oneill-cylinder-title').waitFor({ state: 'visible' });
      await page.waitForTimeout(scene === 'hero' ? 3200 : 1300);
      await page.mouse.move(profile === 'desktop' ? 1400 : 360, 400);
      await page.evaluate(scrolling => { window.__museumBenchmarkScrolling = scrolling; }, scene !== 'hero');
      const before = await metrics();
      const sampling = page.evaluate(() => new Promise(resolve => {
        const deltas = [], tasks = [];
        const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => e.duration)));
        observer.observe({ type: 'longtask', buffered: false });
        let start, previous;
        const tick = now => {
          start ??= now;
          if (previous !== undefined) deltas.push(now - previous);
          previous = now;
          if (now - start < 4000 || window.__museumBenchmarkScrolling) requestAnimationFrame(tick);
          else {
            observer.disconnect();
            deltas.sort((a, b) => a - b);
            resolve({ frames: deltas.length, p95Ms: deltas[Math.floor(deltas.length * .95)], longTasks: tasks.length });
          }
        };
        requestAnimationFrame(tick);
      }));
      // Use native input; writing scrollTop inside the sampling RAF makes the
      // harness force layout/paint and attributes that work to application JS.
      if (scene !== 'hero') {
        for (let i = 0; i < 16; i++) {
          await page.mouse.wheel(0, scene === 'reader' ? 65 : 150);
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        await page.evaluate(() => { window.__museumBenchmarkScrolling = false; });
      }
      const frames = await sampling;
      const after = await metrics(), seconds = after.Timestamp - before.Timestamp;
      const costs = Object.fromEntries(['ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration'].map(k => [k + 'MsPerSecond', Math.round((after[k] - before[k]) * 1000 / seconds)]));
      const row = { pass, profile, scene, ...frames, ...costs };
      results.push(row);
      console.log(JSON.stringify(row));
    }
    if (errors.length) throw new Error(errors.join('\n'));
    await context.close();
  }
  const medians = [];
  for (const profile of ['desktop', 'mobile']) for (const scene of ['hero', 'gallery', 'reader']) {
    const rows = results.filter(r => r.profile === profile && r.scene === scene);
    const median = key => rows.map(r => r[key]).sort((a, b) => a - b)[1];
    medians.push({ profile, scene, ...Object.fromEntries(['p95Ms', 'ScriptDurationMsPerSecond', 'LayoutDurationMsPerSecond', 'RecalcStyleDurationMsPerSecond', 'TaskDurationMsPerSecond'].map(key => [key, median(key)])) });
  }
  await mkdir('output/museum-performance', { recursive: true });
  await writeFile(`output/museum-performance/${label}.json`, JSON.stringify({ label, note: 'Headless Chromium; mobile emulation, not real-device FPS.', results, medians }, null, 2) + '\n');
  console.log(JSON.stringify({ label, medians }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
