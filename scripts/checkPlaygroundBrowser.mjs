/* global document, window */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

// Instrument the real canvas only in this test server. No test controls ship in the app.
const fixture = `
    Object.assign(window, { __playgroundFixture: {
      snapshot: () => ({ ...arcade.snapshot(), time, camera: { x: camX, y: camY, vx: camVX, vy: camVY },
        targets: playgroundTargets.map(t => ({ id: t.id, affinity: t.affinity, hp: t.hp,
          maxHp: t.maxHp, destroyed: t.destroyed, cruiseSpeed: t.cruiseSpeed,
          nextEvade: t.nextEvade, vx: t.vx, vy: t.vy, center: playgroundLetterCenter(t) })),
        sketchCharges: sketch?.segmentCharges ?? [],
        playerProjectiles: comets.filter(c => c.launchPower !== undefined && c.life > 0).length }),
      isolate: id => {
        comets = comets.filter(c => c.launchPower === undefined);
        camX = 0; camY = 0; camVX = 0; camVY = 0;
        playgroundTargets.forEach(t => {
          t.worldU = t.id === id ? 0 : 4 + t.id; t.worldV = 0;
          t.destinationU = t.worldU; t.destinationV = 0;
          t.roamVX = 0; t.roamVY = 0; t.vx = 0; t.vy = 0;
          t.offsetX = 0; t.offsetY = 0; t.floatRadiusX = 0; t.floatRadiusY = 0;
          t.cruiseSpeed = 0; t.acceleration = 0; t.nextWaypoint = Infinity;
          t.nextDart = Infinity; t.nextEvade = Infinity;
        });
      },
      line: (first, second) => {
        window.__playgroundFixture.isolate(first);
        const target = playgroundTargets.find(t => t.id === second);
        target.worldU = 160 / width; target.destinationU = target.worldU;
      },
      probe: (id, delay = 0, slowed = false) => {
        window.__playgroundFixture.isolate(id);
        const target = playgroundTargets.find(t => t.id === id);
        target.hp = target.maxHp;
        target.slowedUntil = slowed ? time + 10 : 0;
        target.nextEvade = time + delay;
        return target.nextEvade;
      },
      threat: (id, offsetY = 0, pointBlank = false) => {
        const center = playgroundLetterCenter(playgroundTargets.find(t => t.id === id));
        spawnComet({ x: center.x - (pointBlank ? 1 : 220), y: center.y + offsetY,
          vx: pointBlank ? 0.2 : 2, vy: 0, power: 0.15, projectileKind: 'rapid',
          sizeMul: 0.5, curve: 0, layer: 'museum' });
      },
      shoot: (id, kind, bounces = 0) => {
        const target = playgroundTargets.find(t => t.id === id);
        const center = playgroundLetterCenter(target);
        spawnComet({ x: center.x - 90, y: center.y, vx: 15, vy: 0, sizeMul: 0.5,
          power: kind === 'rapid' ? PLAYGROUND_RAPID_DAMAGE / PLAYGROUND_BASE_DAMAGE : 1,
          projectileKind: kind, curve: 0, layer: 'museum' });
        comets.at(-1).bounceCount = bounces;
      }
    } });
`;
const server = await createServer({
  server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
  plugins: [{ name: 'playground-test-fixture', enforce: 'pre', transform(code, id) {
    if (id.split('?')[0].replaceAll('\\', '/').endsWith('/StarfieldCanvas.tsx')) {
      assert(code.includes('    const frame = () => {'));
      return code.replace('    const frame = () => {', fixture + '\n    const frame = () => {')
        .replaceAll('performance.now()', '(performance.now() + (window.__clockOffset ?? 0))');
    }
  } }],
});
let browser;
const artifacts = join(tmpdir(), 'astro-playground');
await mkdir(artifacts, { recursive: true });
const oldRecords = JSON.stringify([{ id: 'legacy', durationMs: 123456, completedAt: '2026-10-01T00:00:00Z' }]);
const errors = [];
try {
  await server.listen();
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(legacy => {
    localStorage.setItem('mo-playground-best-times-v1', legacy);
    window.__clockOffset = 0;
    window.__testHidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__testHidden });
  }, oldRecords);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const base = `http://127.0.0.1:${server.httpServer.address().port}${server.config.base}`;
  await page.goto(base, { waitUntil: 'networkidle' });
  const ui = page.locator('.mo-playground-ui');
  const snapshot = () => page.evaluate(() => window.__playgroundFixture.snapshot());
  const isolate = id => page.evaluate(id => window.__playgroundFixture.isolate(id), id);
  const shoot = (id, kind, bounces = 0) => page.evaluate(({ id, kind, bounces }) => window.__playgroundFixture.shoot(id, kind, bounces), { id, kind, bounces });
  const hp = id => expect.poll(async () => (await snapshot()).targets[id].hp, { timeout: 5000 });

  await page.locator('.mo-hero-playground').click();
  await expect(ui).toHaveAttribute('data-playground-scene', 'arriving');
  await page.waitForTimeout(400);
  assert.equal((await snapshot()).elapsedMs, 0, 'Arrival does not consume the challenge clock');
  await expect(ui).toHaveAttribute('data-playground-scene', 'active', { timeout: 10_000 });
  await expect(ui).toHaveAttribute('data-playground-control-mode', 'pulsar');
  const initial = await snapshot();
  assert.equal(initial.total, 15);
  assert(initial.targets.every(t => t.cruiseSpeed >= 0.08 && t.cruiseSpeed <= 0.148), 'Desktop movement scale is four');
  const blue = initial.targets.find(t => t.affinity === 'rapid').id;
  const orange = initial.targets.find(t => t.affinity === 'charged').id;
  await expect(page.locator('.mo-playground-rule')).toHaveCount(0);

  // Exercise the real evasion loop independently of wandering and hit knockback.
  await page.mouse.move(5, 5);
  await page.evaluate(id => {
    window.__playgroundFixture.probe(id);
    window.__playgroundFixture.threat(id, 180);
  }, blue);
  await page.waitForTimeout(150);
  assert.equal((await snapshot()).targets[blue].vy, 0, 'Shots outside the collision lane do not trigger a dodge');
  const ready = await page.evaluate(id => {
    const ready = window.__playgroundFixture.probe(id);
    window.__playgroundFixture.threat(id);
    return ready;
  }, blue);
  await expect.poll(async () => (await snapshot()).targets[blue].nextEvade).toBeGreaterThan(ready);
  assert((await snapshot()).targets[blue].vy > 150, 'Incoming shots cause a visible sideways burst');
  const firstDodge = (await snapshot()).targets[blue].nextEvade;
  await expect.poll(async () => (await snapshot()).targets[blue].nextEvade).toBeGreaterThan(firstDodge);

  await isolate(orange);
  const cursorTarget = (await snapshot()).targets[orange].center;
  await page.mouse.move(cursorTarget.x - 70, cursorTarget.y);
  const cursorReady = await page.evaluate(id => window.__playgroundFixture.probe(id), orange);
  await expect.poll(async () => (await snapshot()).targets[orange].nextEvade).toBeGreaterThan(cursorReady);
  const cursorBurst = (await snapshot()).targets[orange].vx;
  assert(cursorBurst > 100, 'Letters flee a nearby cursor');
  const slowReady = await page.evaluate(id => window.__playgroundFixture.probe(id, 0, true), orange);
  await expect.poll(async () => (await snapshot()).targets[orange].nextEvade).toBeGreaterThan(slowReady);
  assert((await snapshot()).targets[orange].vx < cursorBurst * 0.7, 'Constellation slowdown still weakens dodges');

  await page.mouse.move(5, 5);
  const damageProbe = await page.evaluate(async id => {
    const ready = window.__playgroundFixture.probe(id, 0.25);
    for (let i = 0; i < 5; i++) {
      window.__playgroundFixture.threat(id, 0, true);
      await new Promise(resolve => setTimeout(resolve, 90));
    }
    return { ready, target: window.__playgroundFixture.snapshot().targets[id] };
  }, blue);
  assert(damageProbe.target.hp < 36 && damageProbe.target.hp > 0, 'Sustained Pulsar hits deal damage');
  assert(damageProbe.target.nextEvade > damageProbe.ready && damageProbe.target.vy > 20,
    'Repeated hits cannot postpone evasion indefinitely');
  await page.evaluate(id => window.__playgroundFixture.probe(id), blue);
  console.log('✓ Cursor escape, stronger repeated projectile dodges, constellation slowdown and no Pulsar stun lock');

  await isolate(blue);
  for (let hit = 1; hit <= 12; hit++) {
    await shoot(blue, 'rapid'); await hp(blue).toBe(36 - hit * 3);
  }
  await expect(ui).toHaveAttribute('data-playground-destroyed', '1');
  await expect(ui).toHaveAttribute('data-playground-score', '100');
  await shoot(blue, 'rapid'); await page.waitForTimeout(200);
  assert.equal((await snapshot()).score, 100, 'Destroyed targets cannot be farmed');
  await isolate(orange);
  await shoot(orange, 'charged'); await hp(orange).toBe(10);
  await shoot(orange, 'charged'); await hp(orange).toBe(0);
  assert.equal((await snapshot()).destroyed, 2);
  const otherBlue = initial.targets.find(t => t.affinity === 'rapid' && t.id !== blue).id;
  await isolate(otherBlue); await shoot(otherBlue, 'charged'); await hp(otherBlue).toBe(26);
  const otherOrange = initial.targets.find(t => t.affinity === 'charged' && t.id !== orange).id;
  await isolate(otherOrange); await shoot(otherOrange, 'rapid'); await hp(otherOrange).toBe(28.5);
  const piercingBlue = initial.targets.find(t => t.affinity === 'rapid' && t.id !== blue && t.id !== otherBlue).id;
  const piercingOrange = initial.targets.find(t => t.affinity === 'charged' && t.id !== orange && t.id !== otherOrange).id;
  await page.evaluate(({ first, second }) => window.__playgroundFixture.line(first, second), { first: piercingBlue, second: piercingOrange });
  await shoot(piercingBlue, 'charged', 1); await hp(piercingBlue).toBe(0); await hp(piercingOrange).toBe(2);
  console.log('✓ Real canvas collisions: twelve blue hits, two orange hits, cross-color damage and no duplicate points');

  // Real keyboard/pointer gestures still drive the Pulsar, catapult and constellations.
  await isolate(otherBlue);
  await page.mouse.move(600, 650);
  await page.keyboard.down('Space'); await page.mouse.move(1100, 650); await page.waitForTimeout(300);
  assert((await snapshot()).playerProjectiles > 0, 'Space fires the Pulsar');
  await page.keyboard.up('Space');
  await page.keyboard.down('Shift'); await page.mouse.click(400, 600); await page.mouse.click(700, 600); await page.keyboard.up('Shift');
  assert.equal((await snapshot()).sketchCharges.length, 1, 'Shift + click draws a constellation');
  await page.mouse.move(550, 600); await page.mouse.down(); await page.waitForTimeout(1300);
  await page.mouse.move(450, 600); await page.mouse.up();
  assert((await snapshot()).playerProjectiles > 0, 'Click + drag launches a Comet');

  for (const target of (await snapshot()).targets.filter(t => !t.destroyed)) {
    await isolate(target.id); await shoot(target.id, 'charged', 1);
    await expect.poll(async () => (await snapshot()).targets[target.id].destroyed).toBe(true);
  }
  await expect(ui).toHaveAttribute('data-playground-phase', 'complete');
  await expect(page.locator('.mo-playground-summary')).toContainText('Mejor combo');
  assert((await snapshot()).bestCombo > 1);
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem('mo-playground-arcade-records-v2-pulsar')));
  assert.equal(records.length, 1); assert.equal(records[0].score, (await snapshot()).score);
  assert.equal(await page.evaluate(() => localStorage.getItem('mo-playground-best-times-v1')), oldRecords);
  await expect(page.locator('#mo-playground-result-title span').last()).toHaveCSS('opacity', '1');
  await page.screenshot({ path: join(artifacts, 'desktop-complete.png') });

  await page.getByRole('button', { name: 'Jugar de nuevo', exact: true }).click();
  await expect(ui).toHaveAttribute('data-playground-phase', 'active');
  await expect(ui).toHaveAttribute('data-playground-score', '0');
  await expect(ui).toHaveAttribute('data-playground-destroyed', '0');
  await expect(ui).toHaveAttribute('data-playground-combo', '1');
  assert((await snapshot()).elapsedMs < 5000, 'Retry starts a fresh clock');
  assert((await snapshot()).targets.every(t => t.hp === t.maxHp));
  await expect(page.locator('.mo-playground-complete')).toHaveCount(0);
  await page.screenshot({ path: join(artifacts, 'desktop-active.png') });

  await page.keyboard.down('KeyW'); await page.waitForTimeout(120);
  await page.evaluate(() => {
    window.__testHidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    window.__clockOffset += 90_000;
  });
  await expect(ui).toHaveAttribute('data-playground-phase', 'timed-out');
  const timedOut = await snapshot();
  assert.equal(timedOut.elapsedMs, 90_000); assert.equal(timedOut.destroyed, 0);
  assert.deepEqual([timedOut.camera.vx, timedOut.camera.vy], [0, 0]);
  await page.evaluate(() => { window.__testHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await page.keyboard.up('KeyW');
  await expect(page.getByRole('heading', { name: 'Tiempo agotado', exact: true })).toBeVisible();
  await expect(page.locator('.mo-playground-complete')).toHaveCSS('opacity', '1');
  await shoot(0, 'charged', 1); await page.waitForTimeout(200);
  assert.equal((await snapshot()).score, 0, 'Shots after timeout cannot score');
  assert.deepEqual((await snapshot()).targets.map(t => t.hp), timedOut.targets.map(t => t.hp));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mo-playground-arcade-records-v2-pulsar')).length), 1);
  await page.screenshot({ path: join(artifacts, 'desktop-timeout.png') });
  console.log('✓ Completion, saved score, legacy records, retry reset, hidden-tab timeout and frozen damage');

  await page.getByRole('button', { name: 'Jugar de nuevo', exact: true }).click();
  await expect(ui).toHaveAttribute('data-playground-phase', 'active');
  await expect(page.locator('.mo-playground-complete')).toHaveCount(0);
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(250);
    for (const selector of ['.mo-playground-status', '.mo-playground-exit-corner', '.mo-playground-audio', '.mo-playground-controls']) {
      const rect = await page.locator(selector).boundingBox();
      assert(rect.x >= 0 && rect.x + rect.width <= width + 1, `${selector} fits at ${width}px`);
    }
    assert(await page.locator('.mo-playground-hint').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Control hints fit without clipping');
    await page.screenshot({ path: join(artifacts, `active-${width}.png`) });
  }
  // Reload proves the new ranking is loaded, and activation does not depend on RAF.
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.mo-hero-playground').click();
  await expect(ui).toHaveAttribute('data-playground-scene', 'arriving');
  await page.evaluate(() => { window.__testHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(ui).toHaveAttribute('data-playground-scene', 'active', { timeout: 10_000 });
  await expect.poll(async () => (await snapshot()).elapsedMs).toBeGreaterThan(0);
  await page.evaluate(() => { window.__clockOffset += 90_000; });
  await expect(ui).toHaveAttribute('data-playground-phase', 'timed-out');
  await expect(page.locator('.mo-playground-ranking')).toContainText(String(records[0].score));
  await page.evaluate(() => { window.__testHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.mo-playground-complete')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: join(artifacts, 'mobile-timeout.png') });
  console.log('✓ Reloaded ranking and clock activation while canvas rendering is suspended');
  await context.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touch = await touchContext.newPage(); touch.on('pageerror', error => errors.push(error.message));
  await touch.goto(base, { waitUntil: 'networkidle' }); await touch.locator('.mo-hero-playground').tap();
  const touchUi = touch.locator('.mo-playground-ui');
  await expect(touchUi).toHaveAttribute('data-playground-scene', 'active', { timeout: 10_000 });
  await expect(touchUi).toHaveAttribute('data-playground-control-mode', 'comet');
  assert((await touch.evaluate(() => window.__playgroundFixture.snapshot())).targets.every(t => t.affinity === 'charged' && t.hp === 30));
  await touch.locator('.mo-root').dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 180, clientY: 620, button: 0 });
  await touch.waitForTimeout(1300);
  await touch.locator('.mo-root').dispatchEvent('pointermove', { pointerType: 'touch', clientX: 100, clientY: 620, button: 0 });
  await touch.locator('.mo-root').dispatchEvent('pointerup', { pointerType: 'touch', clientX: 100, clientY: 620, button: 0 });
  assert((await touch.evaluate(() => window.__playgroundFixture.snapshot())).playerProjectiles > 0, 'Touch drag launches a Comet');
  for (let id = 0; id < 15; id++) {
    await touch.evaluate(id => { window.__playgroundFixture.isolate(id); window.__playgroundFixture.shoot(id, 'charged', 1); }, id);
    await expect.poll(async () => (await touch.evaluate(() => window.__playgroundFixture.snapshot())).targets[id].destroyed).toBe(true);
  }
  await expect(touchUi).toHaveAttribute('data-playground-phase', 'complete');
  assert.equal(await touch.evaluate(() => JSON.parse(localStorage.getItem('mo-playground-arcade-records-v2-comet')).length), 1);
  assert.equal(await touch.evaluate(() => JSON.parse(localStorage.getItem('mo-playground-arcade-records-v2-pulsar')).length), 0);
  await expect(touch.locator('#mo-playground-result-title span').last()).toHaveCSS('opacity', '1');
  await touch.screenshot({ path: join(artifacts, 'touch-complete.png') });
  await touchContext.close();

  const reduced = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  reduced.on('pageerror', error => errors.push(error.message));
  await reduced.goto(base, { waitUntil: 'networkidle' }); await reduced.locator('.mo-hero-playground').click();
  await expect(reduced.locator('.mo-playground-ui')).toHaveAttribute('data-playground-phase', 'complete');
  assert.equal(await reduced.evaluate(() => JSON.parse(localStorage.getItem('mo-playground-arcade-records-v2-comet')).length), 0);
  assert.equal(await reduced.evaluate(() => JSON.parse(localStorage.getItem('mo-playground-arcade-records-v2-pulsar')).length), 0);
  await reduced.screenshot({ path: join(artifacts, 'reduced-motion.png') });
  await reduced.close();
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('✓ Responsive HUD, touch-only records and reduced motion without automatic scores');
  console.log(`Visual artifacts: ${artifacts}`);
} catch (error) {
  console.error('Browser errors:', errors);
  for (const context of browser?.contexts() ?? []) for (const page of context.pages()) {
    console.error('Page:', page.url(), (await page.locator('body').innerText()).slice(0, 2000));
    await page.screenshot({ path: join(artifacts, 'failure.png') });
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
