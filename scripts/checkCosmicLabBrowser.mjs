/* global document */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
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
  assert.equal(await panel.locator('.mo-lab-tool').count(), 24);
  await panel.getByRole('button', { name: 'Todos', exact: true }).click();
  assert.equal(await panel.locator('.mo-lab-tool').count(), 32);
  const choose = async tool => {
    await panel.locator(`.mo-lab-tool-${tool}`).click();
    assert.equal(await panel.getAttribute('data-tool'), tool);
  };
  const place = async (tool, x, y) => { await choose(tool); await page.mouse.click(x, y); };
  const newTools = await page.evaluate(async () => {
    const { LAB_TOOLS } = await import('/AstroIngenieria/src/designs/museo-orbital/CosmicLab.ts');
    return LAB_TOOLS.filter(t => t.fresh);
  });
  await panel.getByRole('button', { name: 'Favorito: Aurora viva', exact: true }).click();
  assert.equal(await panel.getAttribute('data-tool'), 'hand', 'Favorite controls do not arm tools');
  await panel.getByRole('button', { name: 'Favoritos 1', exact: true }).click();
  assert.equal(await panel.locator('.mo-lab-tool').count(), 1);
  await panel.getByRole('button', { name: 'Todos', exact: true }).click();
  await panel.getByRole('searchbox').fill('pulsar');
  assert.equal(await panel.locator('.mo-lab-tool').count(), 1, 'Search ignores accents');
  await panel.getByRole('searchbox').fill('');
  for (const category of ['Materia', 'Estrellas', 'Estructuras']) {
    await panel.getByRole('button', { name: category, exact: true }).click();
    assert.equal(await panel.locator('.mo-lab-tool').count(), category === 'Materia' ? 7 : category === 'Estrellas' ? 8 : 10);
  }
  await panel.getByRole('button', { name: 'Nuevos', exact: true }).click();
  for (const tool of newTools) {
    await panel.getByRole('button', { name: `Probar solo: ${tool.name}`, exact: true }).click();
    assert.equal(await panel.getAttribute('data-tool'), tool.id);
    await page.mouse.move(700, 300); await page.mouse.down();
    if (tool.creation === 'drag') await page.mouse.move(850, 370, { steps: 10 });
    await page.mouse.up();
    assert.equal(await panel.getAttribute('data-tool'), 'hand');
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(artifactDir, `museum-${tool.id}.png`) });
    await panel.getByRole('button', { name: 'Repetir último', exact: true }).click();
    assert.equal(await panel.getAttribute('data-tool'), tool.id);
    await page.keyboard.press('Escape'); assert.equal(await panel.getAttribute('data-tool'), 'hand');
  }
  await panel.getByRole('button', { name: 'Salir del laboratorio' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.keyboard.down('KeyQ'); await page.keyboard.down('KeyE');
  await panel.waitFor({ state: 'visible', timeout: 10000 });
  await page.keyboard.up('KeyQ'); await page.keyboard.up('KeyE');
  assert.equal(await panel.getByRole('button', { name: 'Favorito: Aurora viva', exact: true }).getAttribute('aria-pressed'), 'true', 'Favorites persist after reloading');
  await panel.getByRole('button', { name: 'Todos', exact: true }).click();
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
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(250);
    const rect = await panel.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width, 'Panel fits viewport');
    assert.ok(rect.height <= 844 * .45 + 1, 'Panel never exceeds 45% of the screen');
    for (const button of await panel.locator('button').all()) {
      const box = await button.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1, 'Every control remains horizontally on screen');
    }
    await page.screenshot({ path: join(artifactDir, `panel-${width}.png`) });
  }
  await page.screenshot({ path: join(artifactDir, 'narrow-panel.png') });
  await panel.getByRole('button', { name: 'Salir del laboratorio' }).click();
  assert.equal(await panel.count(), 0);
  assert.equal(await page.locator('.is-cosmic-lab').count(), 0);
  // Render the actual engine on both museum palette backgrounds, before/after gestures.
  const review = await page.evaluate(async () => {
    const { CosmicLab, LAB_TOOLS } = await import('/AstroIngenieria/src/designs/museo-orbital/CosmicLab.ts');
    const artifacts = [];
    for (const category of ['Luz', 'Materia', 'Estrellas', 'Estructuras']) for (const background of ['#080d19', '#ded9cd']) {
      const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 840; const c = canvas.getContext('2d');
      c.fillStyle = background; c.fillRect(0, 0, canvas.width, canvas.height);
      const tools = LAB_TOOLS.filter(t => t.fresh && t.category === category);
      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i], x = i % 3 * 480, y = Math.floor(i / 3) * 420;
        const lab = new CosmicLab(() => {}, () => {}); lab.resize(480, 420); lab.select(tool.id); lab.down({ x: 220, y: 215 });
        if (tool.creation === 'drag') lab.move({ x: 360, y: 270 }); lab.up();
        const f = lab.collection.effects[0];
        // Exercise the characteristic gesture before the visual review.
        lab.down({ ...f.handles[0] });
        const target = tool.id === 'eclipse' ? { x: f.x + 6, y: f.y } : tool.id === 'kilonova' ? { ...f.handles[1] } : tool.id === 'tidal' ? { x: f.x + 55, y: f.y } : { x: f.handles[0].x + 15, y: f.handles[0].y - 20 };
        lab.move(target); lab.up(); for (let frame = 0; frame < 120; frame++) lab.step(1 / 60, []);
        const layer = document.createElement('canvas'); layer.width = 480; layer.height = 420; lab.draw(layer.getContext('2d')); c.drawImage(layer, x, y);
        c.globalCompositeOperation = 'source-over'; c.fillStyle = background === '#080d19' ? '#c9d4e5' : '#243147'; c.font = '14px sans-serif'; c.fillText(tool.name, x + 20, y + 28);
        c.strokeStyle = '#71819740'; c.strokeRect(x, y, 480, 420); lab.dispose();
      }
      artifacts.push({ name: `atlas-${category}-${background === '#080d19' ? 'dark' : 'light'}.png`, data: canvas.toDataURL().split(',')[1] });
    }
    const lab = new CosmicLab(() => {}, () => {}); const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 844; const ctx = canvas.getContext('2d');
    lab.resize(1440, 844);
    ['aurora', 'rings', 'pinwheel', 'web', 'vortex', 'meteors'].forEach((id, i) => { lab.select(id); lab.down({ x: 240 + i % 3 * 460, y: 210 + Math.floor(i / 3) * 390 }); if (id === 'meteors') lab.move({ x: 1200, y: 700 }); lab.up(); });
    const costs = [];
    for (let frame = 0; frame < 600; frame++) {
      const start = performance.now(); lab.step(1 / 60, []); ctx.clearRect(0, 0, 1440, 844); lab.draw(ctx); costs.push(performance.now() - start);
    }
    for (const background of ['#080d19', '#ded9cd']) {
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = background; ctx.fillRect(0, 0, 1440, 844); const layer = document.createElement('canvas'); layer.width = 1440; layer.height = 844; lab.draw(layer.getContext('2d')); ctx.drawImage(layer, 0, 0);
      artifacts.push({ name: `six-effects-${background === '#080d19' ? 'dark' : 'light'}.png`, data: canvas.toDataURL().split(',')[1] });
    }
    costs.sort((a, b) => a - b); lab.dispose();
    return { artifacts, medianMs: costs[300], p95Ms: costs[570] };
  });
  for (const artifact of review.artifacts) await writeFile(join(artifactDir, artifact.name), Buffer.from(artifact.data, 'base64'));
  console.log(`Six-effect update+draw CPU: median ${review.medianMs.toFixed(2)}ms, p95 ${review.p95Ms.toFixed(2)}ms (headless, excludes compositor)`);
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('✓ Browser: local entry, 32 tools, gestures, portal validation, cancellation, responsive controls and exit');
  console.log(`Visual artifacts: ${artifactDir}`);
} finally {
  await browser?.close();
  server.kill();
}
