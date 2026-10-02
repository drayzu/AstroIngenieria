/* global window, requestAnimationFrame, getComputedStyle */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const server = await createServer({ server: { host: '127.0.0.1', port: 5196, strictPort: true }, logLevel: 'error' });
let browser;
const artifacts = 'output/museum-performance';
try {
  await server.listen();
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__museumPerf = { keyboardFrames: 0, readerRenders: 0 };
    const originalFrame = window.requestAnimationFrame.bind(window);
    const callbacks = new WeakMap();
    let lastReaderFiber;
    window.requestAnimationFrame = callback => {
      if (!callbacks.has(callback)) callbacks.set(callback, callback.toString().includes('holdStartedAt'));
      return originalFrame(now => {
        if (callbacks.get(callback)) window.__museumPerf.keyboardFrames++;
        callback(now);
      });
    };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true, renderers: new Map(), inject: () => 1,
      onCommitFiberRoot: (_id, root) => {
        const visit = fiber => {
          if (!fiber) return;
          if (fiber.type?.name === 'StudioRoom') {
            // Unaffected subtrees can retain PerformedWork from an old commit.
            // Count only a newly committed reader fiber, not that retained flag.
            if (fiber !== lastReaderFiber && (fiber.flags & 1)) window.__museumPerf.readerRenders++;
            lastReaderFiber = fiber;
          }
          visit(fiber.child); visit(fiber.sibling);
        };
        visit(root.current);
      },
      onCommitFiberUnmount: () => {},
    };
  });
  const base = 'http://127.0.0.1:5196/AstroIngenieria/';
  const counters = () => page.evaluate(() => ({ ...window.__museumPerf }));
  const root = page.locator('.mo-root');
  const top = () => root.evaluate(el => el.scrollTop);
  const framesSettle = () => expect.poll(async () => {
    const before = (await counters()).keyboardFrames;
    await page.waitForTimeout(200);
    return (await counters()).keyboardFrames - before;
  }, { timeout: 8000 }).toBe(0);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  assert.equal((await counters()).keyboardFrames, 0, 'Keyboard schedules no idle frames after mount');
  await page.screenshot({ path: `${artifacts}/desktop-hero.png` });
  await root.evaluate(el => { el.scrollTop = 700; });
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyS');
  const releasedTop = await top();
  assert(releasedTop > 700, 'S scrolls down');
  assert((await counters()).keyboardFrames > 0, 'Frame instrumentation recognizes the keyboard loop');
  await page.waitForTimeout(350);
  assert(await top() > releasedTop, 'Keyboard inertia continues after release');
  await framesSettle();
  const stopped = (await counters()).keyboardFrames;
  await page.waitForTimeout(500);
  assert.equal((await counters()).keyboardFrames, stopped, 'Keyboard loop stops after inertia settles');

  await root.evaluate(el => { el.scrollTop = 0; });
  await page.keyboard.down('Shift'); await page.keyboard.down('KeyW');
  await page.waitForTimeout(450);
  await expect(page.locator('.mo-hero-playground')).not.toHaveClass(/is-charging|is-entering/);
  await page.keyboard.up('KeyW'); await page.keyboard.up('Shift');
  await framesSettle();
  await page.keyboard.down('KeyW');
  await expect(page.locator('.mo-hero-playground')).toHaveClass(/is-charging/);
  await page.keyboard.press('Escape'); await page.keyboard.up('KeyW');
  await expect(page.locator('.mo-hero-playground')).toHaveClass(/is-idle/);
  await framesSettle();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(850);
  await expect(root).not.toHaveClass(/is-playground/);
  await expect(page.locator('.mo-hero-playground')).toHaveClass(/is-charging/);
  await expect(root).toHaveClass(/is-entering-playground/, { timeout: 3500 });
  await page.keyboard.up('KeyW');
  await expect(root).toHaveClass(/is-playground/, { timeout: 5000 });
  await expect(page.locator('.mo-playground-exit')).toBeVisible({ timeout: 6000 });
  await page.locator('.mo-playground-exit').click();
  await expect(root).not.toHaveClass(/is-playground/, { timeout: 6000 });
  console.log('Keyboard: idle suspension, scrolling, inertia, modifiers, cancellation and held-W entry passed.');

  for (const width of [1440, 390]) for (const reduced of [false, true]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.goto(base + '#obra-oneill-cylinder', { waitUntil: 'networkidle' });
    await expect(page.locator('#article-oneill-cylinder-title')).toBeVisible();
    await page.locator('.ar-reader').waitFor({ state: 'visible' });
    await page.waitForTimeout(1300);
    const before = await counters();
    assert(before.readerRenders > 0, 'React observer recognizes the study room');
    const scroll = page.locator('.mo-studio-scroll');
    for (const ratio of [.2, .45, .75, .3]) {
      await scroll.evaluate((el, ratio) => { el.scrollTop = (el.scrollHeight - el.clientHeight) * ratio; }, ratio);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect.poll(async () => Number(await page.locator('.mo-read-progress').getAttribute('aria-valuenow'))).toBeCloseTo(ratio * 100, 0);
    }
    assert.equal((await counters()).readerRenders, before.readerRenders, 'Reading progress does not rerender the study room');
    const expected = await scroll.evaluate(el => Number((100 * el.scrollTop / (el.scrollHeight - el.clientHeight)).toFixed(1)));
    assert.equal(await page.locator('.mo-read-progress').evaluate(el => parseFloat(el.style.width)), expected, 'Bar matches normalized reading position');
    const backgroundTop = await top();
    const keyboardBefore = (await counters()).keyboardFrames;
    await page.keyboard.down('KeyS'); await page.waitForTimeout(250); await page.keyboard.up('KeyS');
    assert.equal(await top(), backgroundTop, 'Study room blocks museum scrolling');
    assert.equal((await counters()).keyboardFrames, keyboardBefore, 'Blocked keyboard schedules no frames');
    await page.screenshot({ path: `${artifacts}/reader-${width}-${reduced ? 'reduced' : 'normal'}.png` });
    await page.locator('.mo-studio-nav button').last().click();
    await expect(page.locator('#article-bishop-ring-title')).toBeVisible();
    await expect.poll(async () => Number(await page.locator('.mo-read-progress').getAttribute('aria-valuenow'))).toBe(0);
    console.log(`${width}px ${reduced ? 'reduced' : 'normal'}: direct progress, no reader renders, navigation reset and blocked keys passed.`);
  }

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(base, { waitUntil: 'networkidle' });
  await root.evaluate(el => { el.scrollTop = 900; });
  await expect.poll(() => page.locator('.mo-marquee').evaluate(el => Math.abs(parseFloat(el.style.getPropertyValue('--marquee-skew'))))).toBeGreaterThan(0);
  assert.equal(await root.evaluate(el => el.style.getPropertyValue('--marquee-skew')), '', 'Marquee variable is scoped locally');
  assert(await page.locator('.mo-marquee').evaluate(el => Math.abs(parseFloat(el.style.getPropertyValue('--marquee-skew'))) <= 5), 'Skew retains its bounds');
  await page.screenshot({ path: `${artifacts}/mobile-gallery.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.locator('.mo-marquee').evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
  assert.deepEqual(errors, [], 'No browser errors');
  console.log('Marquee: local CSS updates, bounded effect and live reduced-motion cleanup passed.');
} finally {
  await browser?.close();
  await server.close();
}
