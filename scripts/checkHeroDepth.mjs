/* global window, document, DOMMatrixReadOnly, requestAnimationFrame, PointerEvent */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const origin = process.env.HERO_DEPTH_PREVIEW_URL || 'http://127.0.0.1:5194/AstroIngenieria/';
const artifacts = resolve('output/hero-depth');
const server = process.env.HERO_DEPTH_PREVIEW_URL ? null : spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5194', '--strictPort'],
  { stdio: 'pipe', windowsHide: true });
let output = '', browser;
server?.stdout.on('data', chunk => { output += chunk; });
server?.stderr.on('data', chunk => { output += chunk; });
const checks = [];
const transforms = page => page.locator('.mo-hero-depth-layer').evaluateAll(nodes => nodes.map(node => {
  const matrix = new DOMMatrixReadOnly(window.getComputedStyle(node).transform);
  return { x: matrix.m41, y: matrix.m42 };
}));
const centered = page => expect.poll(async () => (await transforms(page)).every(p => Math.abs(p.x) < 0.05 && Math.abs(p.y) < 0.05), { timeout: 6000 }).toBe(true);

try {
  await mkdir(artifacts, { recursive: true });
  if (server) {
    for (let i = 0; i < 100 && !output.includes('Local:'); i++) {
      if (server.exitCode !== null) throw new Error(output);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(output.includes('Local:'), 'Vite is ready');
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  // Observe React commits without installing a dependency or changing the app.
  await page.addInitScript(() => {
    window.__heroDepthCommits = 0;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: new Map(),
      inject: () => 1,
      onCommitFiberRoot: (_id, root) => {
        const visit = fiber => {
          if (!fiber) return;
          if (fiber.type?.name === 'HeroDepth' && (fiber.flags & 1)) window.__heroDepthCommits++;
          visit(fiber.child);
          visit(fiber.sibling);
        };
        visit(root.current);
      },
      onCommitFiberUnmount: () => {},
    };
  });
  await page.goto(origin, { waitUntil: 'networkidle' });
  const bg = page.locator('.mo-hero-bg');
  await expect(bg).toHaveAttribute('data-depth', 'ready');
  await page.waitForTimeout(3500);
  assert.equal(await page.locator('.mo-hero-depth-layer').count(), 3);
  const commitsBefore = await page.evaluate(() => window.__heroDepthCommits);
  assert.ok(commitsBefore > 0, 'React commit observer is attached');
  const titleBefore = await page.locator('.mo-hero-title').boundingBox();
  await page.mouse.move(15, 180);
  await expect.poll(async () => (await transforms(page))[2].x, { timeout: 6000 }).toBeGreaterThan(15);
  const left = await transforms(page);
  for (const [index, amplitude] of [3, 8, 16].entries()) {
    assert.ok(Math.abs(left[index].x) <= amplitude + 0.05);
    assert.ok(Math.abs(left[index].y) <= amplitude * 0.6 + 0.05);
  }
  await page.screenshot({ path: resolve(artifacts, 'desktop-left.png') });
  // Brief gestures exercise motion separately from the sustained-load safeguard below.
  await page.mouse.move(1425, 180, { steps: 6 });
  await expect.poll(async () => (await transforms(page))[2].x, { timeout: 6000 }).toBeLessThan(-15);
  await page.screenshot({ path: resolve(artifacts, 'desktop-right.png') });
  assert.deepEqual(await page.locator('.mo-hero-title').boundingBox(), titleBefore, 'Copy remains fixed');
  assert.equal(await page.evaluate(() => window.__heroDepthCommits), commitsBefore, 'Pointer motion causes no React renders in HeroDepth');
  await page.mouse.move(1439, 999);
  await centered(page);
  checks.push('Three independent layers, bounded motion, fixed copy, smooth recentering, no pointer-driven React renders');

  await page.getByRole('button', { name: 'Ver imagen del hero', exact: true }).click();
  await expect(page.locator('.mo-hero')).toHaveClass(/is-image-focus/);
  await page.mouse.move(700, 450);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(artifacts, 'image-focus.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('.mo-hero')).not.toHaveClass(/is-image-focus/);
  await page.locator('.mo-root').evaluate(node => { node.scrollTop = 2200; });
  await centered(page);
  await page.locator('.mo-root').evaluate(node => { node.scrollTop = 0; });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Entrar al Playground', exact: true }).click();
  await expect(bg).toHaveAttribute('data-depth-paused', 'true');
  await centered(page);
  await expect(page.locator('.mo-root')).toHaveClass(/is-playground/, { timeout: 6000 });
  await page.getByRole('button', { name: /Volver al museo/ }).click();
  await expect(bg).toHaveAttribute('data-depth-paused', 'true');
  await expect(bg).toHaveAttribute('data-depth-paused', 'false', { timeout: 5000 });
  await page.mouse.move(100, 200);
  await expect.poll(async () => (await transforms(page))[2].x).toBeGreaterThan(10);
  checks.push('Image focus, offscreen suspension, Playground enter/leave and resumed response');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(bg).toHaveAttribute('data-depth', 'static');
  assert.equal(await page.locator('.mo-hero-depth-layer').count(), 0);
  await page.screenshot({ path: resolve(artifacts, 'reduced-motion.png') });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(bg).toHaveAttribute('data-depth', 'ready');
  assert.deepEqual(errors, []);
  await context.close();
  checks.push('Live reduced-motion changes use the original static image');

  for (const kind of ['mobile', 'reduced', 'failure', 'loading']) {
    const ctx = await browser.newContext(kind === 'mobile'
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 1000 }, reducedMotion: kind === 'reduced' ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage();
    let depthRequests = 0;
    p.on('request', request => { if (request.url().includes('/hero-depth/')) depthRequests++; });
    if (kind === 'failure') await p.route('**/hero-depth/middle.webp', route => route.abort());
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    if (kind === 'loading') await p.route('**/hero-depth/foreground.webp', async route => { await gate; await route.continue(); });
    await p.goto(origin, { waitUntil: 'domcontentloaded' });
    await expect(p.locator('.mo-hero-bg')).toHaveAttribute('data-depth', 'static');
    await expect.poll(() => p.locator('.mo-hero-depth-original').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await p.waitForTimeout(1000);
    assert.equal(await p.locator('.mo-hero-depth-layer').count(), 0);
    if (kind === 'mobile' || kind === 'reduced') assert.equal(depthRequests, 0, 'Static devices do not download depth assets');
    if (kind === 'mobile') {
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await p.screenshot({ path: resolve(artifacts, 'mobile.png') });
    }
    if (kind === 'loading') {
      release();
      await expect(p.locator('.mo-hero-bg')).toHaveAttribute('data-depth', 'ready');
    }
    await ctx.close();
    checks.push(`${kind}: original image is available, with no partial layers`);
  }
  const slowPage = await browser.newPage({ viewport: { width: 900, height: 650 } });
  await slowPage.goto(origin, { waitUntil: 'networkidle' });
  await expect(slowPage.locator('.mo-hero-bg')).toHaveAttribute('data-depth', 'ready');
  await slowPage.waitForTimeout(3600);
  // Simulate sustained main-thread contention, not a single delayed frame.
  await slowPage.evaluate(() => new Promise(resolve => {
    const hero = document.querySelector('.mo-hero');
    const start = performance.now();
    const tick = () => {
      const begin = performance.now();
      while (performance.now() - begin < 40) { /* deliberate frame pressure */ }
      hero.dispatchEvent(new PointerEvent('pointermove', {
        clientX: 450 + Math.sin(begin / 200) * 300, clientY: 200, pointerType: 'mouse', bubbles: true,
      }));
      if (performance.now() - start < 4200) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  }));
  await expect(slowPage.locator('.mo-hero-bg')).toHaveAttribute('data-depth-performance', 'limited');
  await expect(slowPage.locator('.mo-hero-bg')).toHaveAttribute('data-depth', 'static');
  assert.equal(await slowPage.locator('.mo-hero-depth-layer').count(), 0);
  await expect.poll(() => slowPage.locator('.mo-hero-depth-original').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await slowPage.mouse.move(120, 200);
  await slowPage.waitForTimeout(700);
  await expect(slowPage.locator('.mo-hero-bg')).toHaveAttribute('data-depth', 'static');
  await slowPage.close();
  checks.push('Sustained slow frames remove depth layers and keep the original, without oscillation');
  await writeFile(resolve(artifacts, 'checks.json'), JSON.stringify({ checks, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ passed: checks, artifacts }, null, 2));
} finally {
  await browser?.close();
  server?.kill();
}
