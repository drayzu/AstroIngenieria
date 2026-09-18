import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const port = 5189;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe', windowsHide: true });
let output = '', browser;
server.stdout.on('data', data => { output += data; });
server.stderr.on('data', data => { output += data; });
const artifactDir = join(tmpdir(), 'astro-cosmic-lab');
await mkdir(artifactDir, { recursive: true });
try {
  for (let i = 0; i < 100 && !output.includes('Local:'); i++) {
    if (server.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(output.includes('Local:'), 'Vite is ready');
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/AstroIngenieria/`, { waitUntil: 'networkidle' });
  await page.locator('.mo-root').waitFor();
  const panel = page.locator('[data-lab-ui]');
  assert.equal(await panel.count(), 0, 'No lab UI during normal browsing');
  await page.mouse.move(680, 320);
  await page.keyboard.down('KeyQ'); await page.keyboard.down('KeyE');
  await panel.waitFor({ state: 'visible', timeout: 10000 });
  await page.keyboard.up('KeyQ'); await page.keyboard.up('KeyE');
  assert.equal(await panel.locator('.mo-lab-tool').count(), 9);
  const choose = async tool => {
    await panel.locator(`.mo-lab-tool-${tool}`).click();
    assert.equal(await panel.getAttribute('data-tool'), tool);
  };
  const place = async (tool, x, y) => { await choose(tool); await page.mouse.click(x, y); };
  await choose('portal');
  await page.mouse.click(390, 320);
  assert.match(await panel.locator('[role="status"]').innerText(), /Primera boca/);
  await page.mouse.click(410, 320);
  assert.match(await panel.locator('[role="status"]').innerText(), /Separa/);
  await page.mouse.click(1030, 320);
  assert.equal(await panel.getAttribute('data-tool'), 'hand');
  assert.match(await panel.locator('[role="status"]').innerText(), /Puente conectado/);
  await page.mouse.move(390, 320); await page.mouse.down(); await page.mouse.move(430, 270, { steps: 15 }); await page.mouse.up();
  await place('hole', 740, 360);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(artifactDir, 'portals-and-gravity.png') });
  // Aiming uses empty sky, so the projectile can enter the first mouth.
  await page.mouse.move(230, 270); await page.mouse.down(); await page.waitForTimeout(1150);
  await page.mouse.move(130, 270, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(650);
  await page.keyboard.press('Digit8');
  await place('nebula', 560, 350);
  await page.mouse.move(670, 350); await page.mouse.down();
  for (let i = 0; i <= 100; i++) {
    const angle = i / 100 * Math.PI * 4;
    await page.mouse.move(560 + Math.cos(angle) * 110, 350 + Math.sin(angle) * 110);
    await page.waitForTimeout(45);
  }
  await page.mouse.up();
  await place('plasma', 980, 455);
  await page.mouse.move(902, 340); await page.mouse.down(); await page.mouse.move(1110, 305, { steps: 20 });
  await page.waitForTimeout(350); await page.mouse.up();
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(artifactDir, 'nebula-and-plasma.png') });
  await page.keyboard.press('Digit8');
  await place('galaxy', 700, 350);
  await page.mouse.move(565, 325); await page.mouse.down(); await page.mouse.move(615, 335, { steps: 10 }); await page.mouse.up();
  await place('sail', 1060, 500);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: join(artifactDir, 'galaxies-and-sails.png') });
  // Keyboard selection and wave gesture work alongside Shift constellations.
  await page.keyboard.press('Digit7');
  assert.equal(await panel.getAttribute('data-tool'), 'wave');
  await page.mouse.move(700, 350); await page.mouse.down(); await page.mouse.move(900, 460, { steps: 10 }); await page.mouse.up();
  assert.equal(await panel.getAttribute('data-tool'), 'hand');
  await page.keyboard.down('Shift');
  await page.mouse.click(200, 200); await page.mouse.click(300, 250); await page.mouse.click(350, 150);
  await page.keyboard.up('Shift');
  await place('echo', 280, 220);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(artifactDir, 'echo-and-wave.png') });
  await choose('portal'); await page.mouse.click(400, 300); await page.keyboard.press('Escape');
  assert.equal(await panel.count(), 1, 'First Escape cancels an unfinished tool');
  assert.equal(await panel.getAttribute('data-tool'), 'hand');
  await panel.getByRole('button', { name: 'Ocultar herramientas' }).click();
  assert.equal(await panel.locator('.mo-lab-tools').count(), 0);
  await panel.getByRole('button', { name: 'Mostrar herramientas' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const rect = await panel.boundingBox();
  assert.ok(rect.x >= 0 && rect.x + rect.width <= 390, 'Panel fits narrow viewports');
  for (const button of await panel.locator('button').all()) {
    const box = await button.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 391, 'Every control remains on screen');
  }
  await page.screenshot({ path: join(artifactDir, 'narrow-panel.png') });
  await panel.getByRole('button', { name: 'Salir del laboratorio' }).click();
  assert.equal(await panel.count(), 0);
  assert.equal(await page.locator('.is-cosmic-lab').count(), 0);
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('✓ Browser: local entry, 9 tools, gestures, portal validation, cancellation, responsive controls and exit');
  console.log(`Visual artifacts: ${artifactDir}`);
} finally {
  await browser?.close();
  server.kill();
}
