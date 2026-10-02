import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/designs/museo-orbital/PlaygroundArcade.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
const {
  PlaygroundArcade, playgroundHitDamage, playgroundDamageBudget, PLAYGROUND_LETTER_HP,
  PLAYGROUND_RAPID_LETTER_HP, PLAYGROUND_RAPID_DAMAGE, PLAYGROUND_RAPID_FIRE_INTERVAL,
  parsePlaygroundRecords, playgroundRecordsKey, rankPlaygroundRecords,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function check(label, fn) { fn(); console.log(`✓ ${label}`); }

check('Blue letters need exactly 12 Pulsar hits, orange letters two fully charged Comets', () => {
  let blue = PLAYGROUND_RAPID_LETTER_HP;
  for (let hit = 0; hit < 11; hit++) blue -= playgroundHitDamage(blue, PLAYGROUND_RAPID_DAMAGE, 'rapid', 'rapid').damage;
  assert.equal(blue, 3);
  assert.equal(playgroundHitDamage(blue, 3, 'rapid', 'rapid').damage, blue);
  const orange = PLAYGROUND_LETTER_HP - playgroundHitDamage(PLAYGROUND_LETTER_HP, playgroundDamageBudget(1, 0), 'charged', 'charged').damage;
  assert.equal(orange, 10);
  assert.equal(playgroundHitDamage(orange, 20, 'charged', 'charged').damage, orange);
  assert.equal(PLAYGROUND_RAPID_FIRE_INTERVAL, 1 / 9);
});

check('Both cross-color directions deal half damage and piercing conserves the original budget', () => {
  assert.deepEqual(playgroundHitDamage(36, 20, 'charged', 'rapid'), { damage: 10, spent: 20 });
  assert.deepEqual(playgroundHitDamage(30, 3, 'rapid', 'charged'), { damage: 1.5, spent: 3 });
  let budget = playgroundDamageBudget(1, 1);
  const first = playgroundHitDamage(36, budget, 'charged', 'rapid');
  assert.deepEqual(first, { damage: 36, spent: 72 }); budget -= first.spent;
  const second = playgroundHitDamage(30, budget, 'charged', 'charged');
  assert.deepEqual(second, { damage: 28, spent: 28 }); budget -= second.spent;
  assert.equal(budget, 0);
  assert.equal(playgroundHitDamage(30, budget, 'charged', 'charged').damage, 0);
  assert.equal(playgroundDamageBudget(1, 20), 500);
});

check('Arrival has no running clock; time is monotonic and timeout prevents a hit at exactly 90 seconds', () => {
  const run = new PlaygroundArcade('pulsar');
  run.tick(50_000); assert.equal(run.snapshot().elapsedMs, 0);
  assert.equal(run.destroy(0, false, 50_000), false);
  run.start(50_000); run.start(60_000);
  run.tick(51_000); run.tick(50_500); assert.equal(run.snapshot().elapsedMs, 1000);
  for (let id = 0; id < 14; id++) assert.equal(run.destroy(id, false, 139_999), true);
  assert.equal(run.destroy(14, true, 140_000), false);
  assert.equal(run.snapshot().phase, 'timed-out');
  const frozen = run.snapshot(); run.tick(200_000); run.destroy(14, false, 200_000);
  assert.deepEqual(run.snapshot(), frozen);
});

check('Combos include the six-second boundary, cap at five, and duplicate destruction cannot score twice', () => {
  const run = new PlaygroundArcade('pulsar'); run.start(0);
  run.destroy(0, false, 1000); assert.equal(run.snapshot().score, 100);
  run.destroy(1, true, 7000); assert.equal(run.snapshot().combo, 2); assert.equal(run.snapshot().score, 350);
  run.tick(8000); assert.equal(run.snapshot().combo, 2, 'Misses and elapsed frames do not break a live combo');
  run.destroy(2, false, 13_001); assert.equal(run.snapshot().combo, 1);
  for (let id = 3; id < 9; id++) run.destroy(id, false, 13_001 + id);
  assert.equal(run.snapshot().combo, 5); assert.equal(run.snapshot().bestCombo, 5);
  const score = run.snapshot().score; assert.equal(run.destroy(8, true, 14_000), false); assert.equal(run.snapshot().score, score);
  run.tick(20_000); assert.equal(run.snapshot().combo, 1); assert.equal(run.snapshot().bestCombo, 5);
});

check('A completion just before the deadline succeeds; time bonus is floored and only granted once', () => {
  const run = new PlaygroundArcade('comet'); run.start(1000);
  for (let id = 0; id < 15; id++) run.destroy(id, false, 1001);
  assert.equal(run.snapshot().phase, 'complete'); assert.equal(run.snapshot().score, 6500 + 890);
  const frozen = run.snapshot(); run.tick(100_000); run.destroy(14, true, 100_000); assert.deepEqual(run.snapshot(), frozen);
  const lastMoment = new PlaygroundArcade('pulsar'); lastMoment.start(0);
  for (let id = 0; id < 15; id++) lastMoment.destroy(id, false, 89_999);
  assert.equal(lastMoment.snapshot().phase, 'complete'); assert.equal(lastMoment.snapshot().score, 6500);
  assert.deepEqual(new PlaygroundArcade('comet').snapshot(), {
    destroyed: 0, total: 15, phase: 'active', elapsedMs: 0, score: 0, combo: 1, bestCombo: 1, controlMode: 'comet',
  });
});

check('Records rank score first, time second, keep ten, separate controls and recover from malformed storage', () => {
  const entry = (id, score, durationMs = 1000) => ({ id, score, durationMs, bestCombo: 2, completedAt: '2026-10-02T00:00:00.000Z', controlMode: 'pulsar' });
  const ordered = rankPlaygroundRecords([entry('slow', 500, 2000), entry('fast', 500), entry('highest', 1000, 3000)]);
  assert.deepEqual(ordered.map(e => e.id), ['highest', 'fast', 'slow']);
  assert.equal(rankPlaygroundRecords(Array.from({ length: 12 }, (_, i) => entry(String(i), i))).length, 10);
  assert.equal(parsePlaygroundRecords(JSON.stringify(ordered), 'pulsar').length, 3);
  assert.deepEqual(parsePlaygroundRecords(JSON.stringify(ordered), 'comet'), []);
  assert.deepEqual(parsePlaygroundRecords('{bad', 'pulsar'), []);
  assert.deepEqual(parsePlaygroundRecords(JSON.stringify([entry('late', 400, 90_000), entry('invalid', -1), {}]), 'pulsar'), []);
  assert.notEqual(playgroundRecordsKey('pulsar'), playgroundRecordsKey('comet'));
  assert.notEqual(playgroundRecordsKey('pulsar'), 'mo-playground-best-times-v1');
});
