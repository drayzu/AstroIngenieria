/* global document */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const origin = 'http://127.0.0.1:5188';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5188', '--strictPort'], { stdio: 'pipe', windowsHide: true });
let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    if (output.includes('Local:')) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Vite should start');
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/mask-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<html><body style="margin:0"><main id="fixture" style="position:fixed;inset:0;overflow:auto"></main></body></html>' }));
  await page.goto(`${origin}/mask-fixture`);
  const result = await page.evaluate(async () => {
    const { CursorConstellationLayer } = await import('/AstroIngenieria/src/designs/museo-orbital/CursorConstellationLayer.ts');
    const root = document.querySelector('#fixture');
    root.innerHTML = `
      <div class="mo-vitrina-card" style="position:absolute;left:80px;top:80px;width:320px;height:300px"></div>
      <div class="mo-vitrina-card" style="position:absolute;left:160px;top:80px;width:320px;height:300px"></div>
      <p style="position:absolute;left:100px;top:150px;margin:0;width:280px;font:20px/70px monospace">Short line<br>Second line</p>
      <button style="position:absolute;left:550px;top:100px;width:120px;height:40px">Control</button>`;
    const layer = new CursorConstellationLayer(root, () => {});
    const pause = () => new Promise(resolve => setTimeout(resolve, 150));
    const check = (condition, label) => { if (!condition) throw new Error(label); };
    layer.resize(800, 600, 1);
    await pause();
    layer.refresh();
    // Inspect the cached alpha mask without adding a debug API to the application.
    const pixel = (x, y) => layer.maskContext.getImageData(Math.floor(x / 2), Math.floor(y / 2), 1, 1).data[3];
    const range = document.createRange();
    range.selectNodeContents(root.querySelector('p').firstChild);
    const r = range.getBoundingClientRect();
    check(pixel(700, 450) === 255, 'Free space retains full intensity');
    check(Math.abs(pixel(120, 120) - 140) <= 1, 'Images retain 55% intensity');
    check(pixel(260, 120) === pixel(120, 120), 'Overlaps use maximum protection');
    check(pixel(r.x + r.width / 2, r.y + r.height / 2) === 0, 'Text is protected');
    check(pixel(200, 215) >= 130, 'Space between text lines remains available');
    check(pixel(580, 120) === 0, 'Controls are protected');
    check(pixel(535, 120) > 0 && pixel(535, 120) < 255, 'Control margins feather smoothly');
    check(pixel(85, 120) > pixel(105, 120), 'Image boundaries feather smoothly');
    let writes = 0;
    const put = layer.maskContext.putImageData.bind(layer.maskContext);
    layer.maskContext.putImageData = (...args) => { writes++; return put(...args); };
    layer.refresh();
    check(writes === 0, 'Unchanged geometry reuses the mask');
    const destination = document.createElement('canvas');
    destination.width = 800; destination.height = 600;
    const target = destination.getContext('2d');
    const bounds = { x: 90, y: 90, w: 630, h: 400 };
    for (const masked of [true, false]) {
      layer.clear(); target.clearRect(0, 0, 800, 600);
      layer.context.fillStyle = 'white'; layer.context.fillRect(0, 0, 800, 600);
      layer.composite(target, masked, bounds);
      check(Math.abs(target.getImageData(120, 120, 1, 1).data[3] - (masked ? 140 : 255)) <= 1,
        'Museum applies protection; playground bypasses it');
      check(target.getImageData(700, 450, 1, 1).data[3] === 255, 'Cropped compositing preserves free space');
    }
    root.innerHTML = '<section class="mo-chapter-intro" style="position:absolute;inset:0"><div class="mo-chapter-image" style="position:absolute;inset:0"><img alt="" style="width:100%;height:100%" src="data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E"></div></section>';
    await pause(); layer.refresh();
    check(pixel(400, 10) > pixel(400, 60) && pixel(400, 60) > pixel(400, 300), 'Chapter top fade restores intensity');
    check(pixel(400, 590) > pixel(400, 540), 'Chapter bottom fade restores intensity');
    root.firstElementChild.classList.add('is-image-focus'); await pause(); layer.refresh();
    check(layer.blocked, 'Contemplation suppresses cursor constellations');
    root.firstElementChild.classList.remove('is-image-focus');
    for (const className of ['mo-image-lightbox', 'mo-menu', 'mo-studio-panel']) {
      const overlay = document.createElement('div'); overlay.className = className; root.append(overlay);
      layer.refresh(); check(layer.blocked, `${className} suppresses constellations`); overlay.remove();
    }
    layer.resize(800, 600, 1.5); layer.refresh();
    check(layer.canvas.width === 1200 && Math.abs(pixel(400, 300) - 140) <= 1, 'DPR resize retains CSS-space mask alignment');
    layer.dispose(); check(layer.canvas.width === 0 && layer.observed.size === 0, 'Resources are released');
    return 'Mask, overlaps, text lines, feathering, caching, compositing, chapter fades, overlays, DPR and cleanup passed';
  });
  console.log(result);
  await page.goto(`${origin}/AstroIngenieria/`);
  await page.locator('.mo-chapter-intro').first().scrollIntoViewIfNeeded();
  await page.mouse.move(650, 400, { steps: 20 });
  await page.locator('.mo-chapter-view').first().click();
  await page.waitForTimeout(500);
  await page.locator('.mo-chapter-view').first().click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(500);
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  reduced.on('pageerror', error => errors.push(error.message));
  await reduced.goto(`${origin}/AstroIngenieria/`);
  await reduced.waitForTimeout(500);
  assert.deepEqual(errors, [], 'Museum and reduced motion should run without errors');
  console.log('Museum navigation, resize and reduced-motion smoke checks passed');
} finally {
  await browser?.close();
  server.kill();
}
