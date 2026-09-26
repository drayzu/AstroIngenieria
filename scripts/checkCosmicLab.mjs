import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Transpile the actual module graph; type-only imports disappear before recursion.
const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const source = await readFile(url, 'utf8');
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
  for (const match of [...compiled.matchAll(/from ['"](\.[^'"]+)['"]/g)]) {
    const dependency = await load(new URL(match[1] + '.ts', url));
    compiled = compiled.replace(match[0], `from '${dependency}'`);
  }
  const result = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  modules.set(url.href, result); return result;
}
const { CosmicLab, circleEntry, holeAcceleration, LAB_TOOLS } = await import(await load(new URL('../src/designs/museo-orbital/CosmicLab.ts', import.meta.url)));
let checks = 0;
function check(label, fn) { fn(); checks++; console.log(`✓ ${label}`); }
function engine() {
  let seed = 41;
  const messages = [], jets = [];
  const lab = new CosmicLab(state => messages.push(state), (p, v) => jets.push({ p, v }), () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
  return { lab, messages, jets };
}
function place(lab, tool, x, y) { lab.select(tool); lab.down({ x, y }); lab.up(); }
function advance(lab, seconds, body, fps = 60) {
  for (let i = 0; i < seconds * fps; i++) {
    lab.step(1 / fps, body ? [body] : []);
    if (body) lab.moveBody(body, 1 / fps);
  }
}
const projectile = (x, y, vx = 10, vy = 0) => ({ x, y, vx, vy, size: 3, life: 1, layer: 'museum' });

check('Swept entry catches fast crossings, tangents, and starts inside; misses stay misses', () => {
  assert.equal(circleEntry({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10), 0.4);
  assert.equal(circleEntry({ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 50, y: 0 }, 10), 0.5);
  assert.equal(circleEntry({ x: 50, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 0 }, 10), 0);
  assert.equal(circleEntry({ x: 0, y: 11 }, { x: 100, y: 11 }, { x: 50, y: 0 }, 10), null);
});
check('Gravity acts beyond the old 360px radius, stays radial, and fades continuously', () => {
  const hole = { x: 700, y: 400 };
  const a = holeAcceleration({ x: 200, y: 400 }, hole, 760);
  assert.ok(a.x > 20); assert.equal(a.y, 0);
  const b = holeAcceleration({ x: 1200, y: 400 }, hole, 760);
  assert.equal(a.x, -b.x);
  assert.ok(holeAcceleration({ x: hole.x - 759.99, y: 400 }, hole, 760).x < 0.001);
  assert.deepEqual(holeAcceleration({ x: hole.x - 760, y: 400 }, hole, 760), { x: 0, y: 0 });
});
check('Gravity produces consistent flybys at 30, 60 and 120 fps', () => {
  const results = [30, 60, 120].map(fps => {
    const { lab } = engine(); place(lab, 'hole', 650, 400);
    const body = projectile(100, 210, 10, 0); advance(lab, 1.5, body, fps); return body;
  });
  assert.ok(results[0].y > 230, 'An offset flyby must visibly bend');
  assert.ok(results[0].life > 0 && results[0].x > 750, 'A flyby can escape');
  for (const body of results.slice(1)) assert.ok(Math.hypot(body.x - results[0].x, body.y - results[0].y) < 1);
});
check('Only horizon crossings capture; captured matter disappears on a real-time spiral', () => {
  const { lab } = engine(); place(lab, 'hole', 650, 400);
  const body = projectile(550, 400, 8); advance(lab, 0.15, body);
  const size = body.size; advance(lab, 0.4, body); assert.ok(body.size < size);
  advance(lab, 0.5, body); assert.equal(body.life, 0);
});
check('Portals use deliberate placement, reject overlap, and cancel incomplete pairs', () => {
  const { lab } = engine(); lab.select('portal'); lab.down({ x: 250, y: 300 });
  assert.equal(lab.portal, null); assert.ok(lab.pending);
  lab.down({ x: 260, y: 300 }); assert.equal(lab.portal, null); assert.ok(lab.pending);
  lab.down({ x: 850, y: 300 }); assert.ok(lab.portal); assert.equal(lab.pending, null);
  const previous = lab.portal; lab.select('portal'); lab.down({ x: 400, y: 200 }); lab.cancel();
  assert.equal(lab.portal, previous); assert.equal(lab.pending, null);
});
check('Fast portal crossings preserve momentum, break trails, and return an exit collision origin', () => {
  const { lab } = engine(); lab.select('portal'); lab.down({ x: 300, y: 350 }); lab.down({ x: 850, y: 350 });
  const body = projectile(150, 365, 100, 0);
  lab.step(1 / 30, [body]); const previous = lab.moveBody(body, 1 / 30);
  assert.ok(body.x > 900); assert.ok(previous.x > 850, 'No collision segment across the teleportation gap');
  assert.equal(body.vx, 100); assert.equal(body.vy, 0);
  assert.ok(Math.abs(body.y - 365) < 0.001, 'Keep the lateral offset');
  // Intercept drawing to verify there is no luminous line bridging the mouths.
  const segments = []; let start;
  lab.drawTrail({ save() {}, restore() {}, beginPath() {}, moveTo(x, y) { start = { x, y }; }, lineTo(x, y) { segments.push(Math.hypot(x - start.x, y - start.y)); }, stroke() {} }, body, [255, 255, 255]);
  assert.ok(segments.every(length => length < 250));
  const back = projectile(950, 350, -60, 0); lab.step(1 / 30, [back]); lab.moveBody(back, 1 / 30);
  assert.ok(back.x < 250, 'Both mouths work as entries');
});
check('Portal relocation is bounded, prevents overlap, and rolls back on cancellation', () => {
  const { lab } = engine(); lab.select('portal'); lab.down({ x: 250, y: 300 }); lab.down({ x: 850, y: 300 });
  assert.ok(lab.down({ x: 250, y: 300 })); lab.move({ x: -100, y: -100 });
  assert.equal(lab.portal.a.x, 54); assert.equal(lab.portal.a.y, 54);
  lab.cancel(); assert.deepEqual(lab.portal.a, { x: 250, y: 300 });
  lab.down(lab.portal.a); lab.move(lab.portal.b); assert.deepEqual(lab.portal.a, { x: 250, y: 300 }); lab.up();
});
check('A circular molding gesture condenses an actual star; an untouched cloud does not', () => {
  const { lab } = engine(); place(lab, 'nebula', 600, 350);
  advance(lab, 8); assert.equal(lab.babyStars.length, 0);
  lab.down({ x: 710, y: 350 });
  for (let i = 1; i <= 540; i++) {
    lab.step(1 / 60, []);
    const angle = i / 540 * Math.PI * 4;
    lab.move({ x: 600 + Math.cos(angle) * 110, y: 350 + Math.sin(angle) * 110 });
  }
  lab.up(); advance(lab, 3);
  assert.ok(lab.babyStars.length > 0, 'Circulation and density should ignite a star');
});
check('A supernova pushes existing gas and launches an echo from its own origin', () => {
  const { lab } = engine(); place(lab, 'nebula', 600, 350);
  const gas = lab.clouds[0].particles[0], before = { ...gas };
  lab.blast({ x: 400, y: 350 }, 1);
  assert.ok(gas.vx > before.vx); assert.equal(lab.echoes[0].x, 400);
});
check('Crossing plasma loops emits a bounded directional jet with a cooldown', () => {
  const { lab, jets } = engine(); place(lab, 'plasma', 600, 450);
  const plasma = lab.plasmas[0]; lab.down(plasma.tips[0]); lab.move({ x: 730, y: 300 });
  advance(lab, 0.1); assert.equal(jets.length, 9);
  advance(lab, 0.5); assert.equal(jets.length, 9);
  assert.ok(jets.every(jet => Math.hypot(jet.v.x, jet.v.y) >= 7 - 1e-9));
  lab.cancel();
});
check('Galactic encounter geometry changes with the chosen launch direction', () => {
  const launch = (dy) => {
    const { lab } = engine(); place(lab, 'galaxy', 640, 350);
    const core = lab.galaxies[0].cores[0]; lab.down(core); lab.step(1 / 60, []);
    lab.move({ x: core.x + 12, y: core.y + dy }); lab.up(); advance(lab, 2);
    return lab.galaxies[0].particles[0];
  };
  const headOn = launch(0), tangent = launch(14);
  assert.ok(Math.hypot(headOn.x - tangent.x, headOn.y - tangent.y) > 30);
});
check('Gravitational waves alternate strain, respect orientation, and fully restore geometry', () => {
  const { lab } = engine(); lab.select('wave'); lab.down({ x: 400, y: 400 }); lab.move({ x: 700, y: 400 }); lab.up();
  const p = { x: 600, y: 400 }; const samples = [];
  for (let i = 0; i < 100; i++) { lab.step(1 / 60, []); samples.push(lab.project(p).x - p.x); }
  assert.ok(Math.min(...samples) < -2 && Math.max(...samples) > 2);
  advance(lab, 8); assert.deepEqual(lab.project(p), p);
});
check('Solar-sail acceleration depends on illumination and sail orientation', () => {
  const speed = angle => {
    const { lab } = engine(); place(lab, 'sail', 600, 350);
    const sail = lab.sails[0]; sail.x = 600; sail.y = 350; sail.angle = angle;
    advance(lab, 1); return Math.hypot(sail.vx, sail.vy);
  };
  assert.ok(speed(0) > speed(Math.PI / 2) * 20);
});
check('The same portal transport works for solar sails', () => {
  const { lab } = engine(); place(lab, 'sail', 600, 350);
  lab.select('portal'); lab.down({ x: 300, y: 350 }); lab.down({ x: 850, y: 350 });
  const sail = lab.sails[0]; sail.x = 200; sail.y = 350; sail.vx = 60;
  lab.step(1 / 30, []); assert.ok(sail.x > 900);
});
check('Clear, resize, limits and expiration leave finite, bounded state', () => {
  const { lab } = engine();
  for (let i = 0; i < 12; i++) { place(lab, 'hole', 200 + i * 30, 200); place(lab, 'nebula', 500, 300); place(lab, 'plasma', 600, 400); }
  assert.equal(lab.holes.length, 3); assert.equal(lab.clouds.length, 2); assert.equal(lab.plasmas.length, 2);
  lab.select('portal'); lab.down({ x: 250, y: 300 }); lab.down({ x: 950, y: 300 });
  lab.resize(400, 600); assert.ok(lab.portal.a.x > 0 && lab.portal.b.x < 400);
  advance(lab, 95); assert.equal(lab.holes.length + lab.clouds.length + lab.plasmas.length, 0); assert.equal(lab.portal, null);
  lab.clear(); assert.equal(lab.tool, 'hand'); assert.equal(lab.pending, null);
});
check('Registry exposes 24 unique new experiments and preserves all eight shortcuts', () => {
  assert.equal(LAB_TOOLS.length, 33);
  assert.equal(new Set(LAB_TOOLS.map(t => t.id)).size, 33);
  assert.equal(LAB_TOOLS.filter(t => t.fresh).length, 24);
  assert.deepEqual(LAB_TOOLS.filter(t => t.key).map(t => t.key), ['0', '1', '2', '3', '4', '5', '6', '7', '9']);
});
for (const tool of LAB_TOOLS.filter(t => t.fresh)) check(`${tool.name}: creation, manipulation, rollback, resize, cleanup`, () => {
  const { lab } = engine();
  place(lab, tool.id, 500, 300);
  const f = lab.collection.effects[0]; assert.equal(f.id, tool.id); assert.equal(lab.tool, 'hand');
  lab.step(1 / 60, []);
  const handle = { ...f.handles[0] };
  const before = JSON.stringify(f);
  assert.ok(lab.down(handle)); lab.move({ x: handle.x + 37, y: handle.y + 29 });
  assert.notEqual(JSON.stringify(f), before, 'Gesture changes actual phenomenon state');
  assert.ok(lab.cancel()); assert.equal(JSON.stringify(f), before, 'Escape rolls back manipulation');
  lab.down(handle); lab.move({ x: handle.x + 37, y: handle.y + 29 }); lab.up(); lab.step(1 / 60, []);
  assert.notEqual(JSON.stringify(f), before);
  lab.resize(390, 844); assert.ok(Number.isFinite(f.x + f.y));
  lab.clear(); assert.equal(lab.collection.effects.length, 0); assert.equal(lab.collection.beams.length, 0);
});
check('Drag creation cancels cleanly, and repeat retains the chosen tool', () => {
  const { lab } = engine(); lab.select('asteroids'); lab.down({ x: 300, y: 300 }); lab.move({ x: 600, y: 350 });
  assert.ok(lab.collection.effects.length); lab.cancel(); assert.equal(lab.collection.effects.length, 0); assert.equal(lab.lastTool, 'asteroids');
});
check('Asteroids and meteors share fast portal transport and broad gravity', () => {
  for (const tool of ['asteroids', 'meteors']) {
    const { lab } = engine(); place(lab, tool, 180, 300); lab.select('portal'); lab.down({ x: 300, y: 300 }); lab.down({ x: 900, y: 300 });
    const g = lab.collection.effects[0].grains[0]; Object.assign(g, projectile(200, 300, 90));
    lab.step(1 / 30, []); assert.ok(g.x > 950, `${tool} crosses a portal during a fast step`);
    lab.clear(); place(lab, tool, 180, 300); place(lab, 'hole', 700, 400);
    const rock = lab.collection.effects[0].grains[0]; Object.assign(rock, projectile(190, 250, 0));
    lab.step(1 / 30, []); assert.ok(rock.vx > 0 && rock.vy > 0, `${tool} feels distant gravity`);
  }
});
check('Split and reflected light accelerate sails, with bounded ray paths', () => {
  const { lab } = engine(); place(lab, 'prism', 300, 300); lab.step(1 / 60, []);
  assert.equal(lab.collection.beams.length, 6);
  const ray = lab.collection.beams[2], p = { x: (ray.a.x + ray.b.x) / 2, y: (ray.a.y + ray.b.y) / 2 };
  const sail = projectile(p.x, p.y, 0); lab.collection.pressure(sail, 1); assert.ok(Math.hypot(sail.vx, sail.vy) > 0);
  lab.clear(); place(lab, 'mirrors', 300, 300); lab.step(1 / 60, []);
  assert.ok(lab.collection.beams.length > 1); assert.ok(lab.collection.beams.length <= 5);
  const reflected = lab.collection.beams[1]; assert.ok(Math.abs(reflected.b.y - reflected.a.y) > 100);
});
check('Impacts illuminate auroras, excite networks, open ring gaps and feed quasars', () => {
  for (const tool of ['aurora', 'web', 'rings', 'quasar']) {
    const { lab } = engine(); place(lab, tool, 500, 300);
    lab.step(1 / 30, [projectile(300, 300, 150)]);
    const f = lab.collection.effects[0]; assert.ok(f.energy > 0 || f.pulses.length > 0, tool);
  }
});
check('Plasma arcs light auroras and bow shocks transfer momentum to existing gas', () => {
  const { lab } = engine(); place(lab, 'aurora', 500, 300); place(lab, 'plasma', 500, 400); lab.step(1 / 60, []);
  assert.ok(lab.collection.effects[0].energy > 0);
  lab.clear(); place(lab, 'nebula', 500, 300); place(lab, 'bow', 500, 300);
  lab.down({ x: 500, y: 300 }); lab.move({ x: 535, y: 300 }); lab.up();
  const momentum = () => lab.clouds[0].particles.reduce((s, p) => s + p.vx, 0);
  const before = momentum(); lab.step(.05, []); assert.ok(momentum() > before + 100);
});
check('Kilonova merges, tidal moon breaks, accretion grows and a pinched vortex releases bounded jets', () => {
  const { lab, jets } = engine(); place(lab, 'kilonova', 500, 300);
  let f = lab.collection.effects[0]; lab.down(f.handles[0]); lab.move(f.handles[1]); lab.up(); lab.step(.05, []); assert.equal(f.values[0], 1);
  lab.clear(); place(lab, 'tidal', 500, 300); f = lab.collection.effects[0]; lab.down(f.handles[0]); lab.move({ x: 550, y: 300 }); lab.up(); lab.step(.05, []); assert.equal(f.values[1], 1);
  lab.clear(); place(lab, 'accretion', 500, 300); f = lab.collection.effects[0]; lab.down(f); lab.move(f.grains[0]); lab.up(); lab.step(.05, []); assert.ok(f.values[1] > 0);
  lab.clear(); place(lab, 'vortex', 500, 300); f = lab.collection.effects[0]; lab.down(f.handles[0]); lab.move({ x: 527, y: 300 }); lab.up(); lab.step(.05, []); assert.ok(jets.length > 0 && jets.length <= 12);
  advance(lab, 2); assert.ok(jets.length <= 12, 'Release emits once');
});
check('Ten simulated minutes keep allocation, ray paths and coordinates bounded', () => {
  const { lab } = engine(); const tools = LAB_TOOLS.filter(t => t.fresh);
  for (let frame = 0; frame < 7500; frame++) {
    if (frame % 80 === 0) place(lab, tools[(frame / 80 | 0) % tools.length].id, 300 + frame % 500, 300);
    lab.step(.08, []);
    assert.ok(lab.collection.particleCount <= 1600); assert.ok(lab.collection.effects.length <= 12); assert.ok(lab.collection.beams.length <= 200);
    for (const f of lab.collection.effects) for (const p of [f, ...f.grains, ...f.handles]) assert.ok(Number.isFinite(p.x + p.y));
  }
  advance(lab, 95); assert.equal(lab.collection.effects.length, 0);
});
check('Asteroid impacts split into recycled fragments without increasing allocation', () => {
  const { lab } = engine(); place(lab, 'asteroids', 500, 300);
  const f = lab.collection.effects[0], rock = f.grains[0]; rock.size = 3;
  const slots = f.grains.length, live = f.grains.filter(g => g.life > 0).length;
  lab.step(.02, [projectile(rock.x, rock.y, 5)]);
  assert.equal(f.grains.length, slots); assert.ok(f.grains.filter(g => g.life > 0).length > live); assert.ok(rock.size < 2);
});
check('A captured meteor slot can emit again without retaining the old capture', () => {
  const { lab } = engine(); place(lab, 'meteors', 200, 300); place(lab, 'hole', 700, 300);
  const f = lab.collection.effects[0], g = f.grains[0]; Object.assign(g, projectile(700, 300, 0));
  lab.step(.05, []); advance(lab, 1);
  let escaped = false;
  for (let i = 0; i < 200; i++) { lab.step(.02, []); if (g.life > 0 && g.x < 400 && g.size > 1) escaped = true; }
  assert.ok(escaped, 'Recycled meteor leaves its emitter again');
});
check('Adaptive detail follows real frame duration, not the simulation speed control', () => {
  const { lab } = engine(); place(lab, 'vortex', 500, 300);
  for (let i = 0; i < 100; i++) lab.step(.08, [], 1 / 60);
  assert.equal(lab.collection.quality, 1);
  for (let i = 0; i < 60; i++) lab.step(.02, [], .06);
  assert.equal(lab.collection.quality, .5);
  for (let i = 0; i < 240; i++) lab.step(.02, [], 1 / 60);
  assert.equal(lab.collection.quality, 1);
});
console.log(`\n${checks} cosmic laboratory checks passed.`);
