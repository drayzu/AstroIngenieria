import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

// Editorial contract: these are the chapter sequences agreed for the open collection.
const expectedOrder = [
  ['astroingenieria'],
  ['iss', 'artificial-gravity', 'life-support', 'bernal-sphere', 'stanford-torus', 'oneill-cylinder', 'bishop-ring', 'mckendree-cylinder', 'asteroid-habitat', 'ringworld'],
  ['reusable-launch', 'orbital-ports', 'fuel-depots', 'lunar-bases', 'isru', 'asteroid-mining', 'shipyards', 'space-elevator', 'tethers', 'skyhook', 'orbital-ring', 'launch-loop', 'mass-driver', 'space-law'],
  ['exoplanets', 'astrobiology', 'habitable-zone', 'habitability', 'paraterraforming', 'domed-cities', 'worldhouse', 'terraforming', 'mars-terraforming', 'venus-terraforming', 'floating-venus', 'orbital-mirrors', 'sunshades', 'volatile-import', 'magnetosphere', 'ecopoiesis', 'planetary-protection'],
  ['space-based-solar', 'microwave-power', 'radiators', 'dyson-swarm', 'dyson-ring', 'dyson-bubble', 'dyson-shell'],
  ['chemical-rockets', 'ion-engines', 'hall-thruster', 'solar-electric', 'nuclear-electric', 'nuclear-thermal', 'project-orion', 'fusion-propulsion', 'antimatter', 'bussard-ramjet', 'solar-sail', 'laser-sail', 'beamed-propulsion', 'magnetic-sail', 'electric-sail', 'relativistic-propulsion', 'interstellar-braking', 'worldship', 'alcubierre', 'wormholes', 'reactionless'],
  ['stellar-physics', 'stellar-engines', 'shkadov', 'caplan', 'stellar-navigation', 'star-lifting', 'plasma-processing', 'stellar-husbandry', 'black-hole-engineering'],
  ['kardashev', 'tipo-i', 'tipo-ii', 'tipo-iii', 'computronium', 'jupiter-brain', 'matrioshka-brain', 'civilizaciones-digitales', 'postbiological', 'von-neumann', 'colonizacion-galactica', 'civilizaciones-y-luz', 'deep-time', 'future-universe', 'cosmic-ethics'],
  ['seti', 'technosignatures', 'radio-seti', 'optical-seti', 'stellar-technosignatures', 'fermi', 'great-filter', 'zoo-hypothesis', 'dark-forest', 'grabby-aliens', 'civilizaciones-silenciosas', 'berserker'],
];
const ids = expectedOrder.flat();
const server = await createServer({ server: { host: '127.0.0.1', port: 5186, strictPort: true }, logLevel: 'error' });
let browser;
try {
  const { chapters, allConcepts, conceptById } = await server.ssrLoadModule('/src/data/astroData.ts');
  const { readingSequence, getReadingConnections } = await server.ssrLoadModule('/src/data/readingJourney.ts');
  assert.equal(allConcepts.length, 106);
  assert.equal(new Set(allConcepts.map(item => item.id)).size, 106);
  assert.deepEqual(chapters.map(item => item.id), ['intro', 'habitats', 'infrastructure', 'planetary', 'energy', 'propulsion', 'stellar', 'civilizations', 'search']);
  assert.equal(chapters[0].title, 'Introducción');
  assert.deepEqual(chapters.map(item => item.concepts.map(concept => concept.id)), expectedOrder);
  assert.deepEqual(readingSequence.map(item => item.id), ids);
  for (const chapter of chapters) {
    assert.deepEqual(chapter.groups.flatMap(group => group.conceptIds), chapter.concepts.map(item => item.id));
    for (const concept of chapter.concepts) {
      assert.equal(concept.chapterId, chapter.id);
      assert(concept.sourceChapterId);
    }
  }
  for (let i = 0; i < ids.length; i++) {
    const links = getReadingConnections(ids[i]);
    assert.equal(links.previous?.id, ids[i - 1]);
    assert.equal(links.next?.id, ids[i + 1]);
  }
  for (const [id, title] of Object.entries({
    'bernal-sphere': 'Esfera de Bernal', 'stanford-torus': 'Toro de Stanford',
    'dyson-swarm': 'Enjambre de Dyson', 'star-lifting': 'Extracción de materia estelar (star lifting)',
    'launch-loop': 'Bucle de lanzamiento (launch loop)', 'great-filter': 'Gran filtro',
  })) assert.equal(conceptById.get(id).title, title);
  const unknown = getReadingConnections('missing');
  assert.equal(unknown.previous, undefined);
  assert.equal(unknown.next, undefined);

  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = 'http://127.0.0.1:5186/AstroIngenieria/';
  const titleFor = id => '#article-' + id + '-title';
  const headerPrevious = page.locator('.mo-studio-nav button').first();
  const headerNext = page.locator('.mo-studio-nav button').last();
  const verifyNavigation = async (id, sequence = readingSequence, context = 'journey') => {
    const expected = getReadingConnections(id, sequence, context);
    for (const [control, target, label] of [
      [headerPrevious, expected.previous, expected.previousLabel],
      [headerNext, expected.next, expected.nextLabel],
    ]) {
      await expect(control).toHaveAttribute('aria-label', label);
      if (target) await expect(control).toBeEnabled();
      else await expect(control).toBeDisabled();
    }
  };
  await page.goto(base + '#obra-astroingenieria');
  for (const [index, id] of ids.entries()) {
    await expect(page.locator(titleFor(id))).toBeVisible();
    await verifyNavigation(id);
    await expect(page.locator('.mo-studio-plate')).toHaveText('N.º ' + String(index + 1).padStart(2, '0') + ' / 106');
    if (index < ids.length - 1) {
      await headerNext.click();
    }
  }
  await expect(page.locator('.mo-reading-connections, .mo-chapter-continue')).toHaveCount(0);
  console.log('106 lecturas recorridas en orden; cabecera, numeración y límites coinciden.');

  for (let index = 1; index < chapters.length; index++) {
    const first = chapters[index].concepts[0];
    const previous = chapters[index - 1].concepts.at(-1);
    await page.evaluate(id => { globalThis.location.hash = 'obra-' + id; }, first.id);
    await expect(page.locator(titleFor(first.id))).toBeVisible();
    await expect(headerPrevious).toHaveAttribute('aria-label', getReadingConnections(first.id).previousLabel);
    await headerPrevious.click();
    await expect(page.locator(titleFor(previous.id))).toBeVisible();
    await expect(headerNext).toHaveAttribute('aria-label', getReadingConnections(previous.id).nextLabel);
  }
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(titleFor(chapters.at(-1).concepts[0].id))).toBeVisible();
  console.log('Retroceso entre capítulos y navegación por teclado correctos.');

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(base);
    await expect(page.locator('.mo-studio')).toHaveCount(0);
    const cards = page.locator('.mo-sala .mo-obra');
    await expect(cards).toHaveCount(106);
    await expect(page.locator('.mo-obra-cta, .mo-topic-group > p')).toHaveCount(0);
    assert.deepEqual(await cards.evaluateAll(items => items.map(item => item.dataset.conceptId)), ids);
    assert(await cards.evaluateAll(items => items.every(item => !item.closest('details, [hidden]') && item.getClientRects().length > 0)), 'All cards available without expanding controls');
    await expect(page.locator('.mo-sala details, .mo-recommended-wall, .mo-explore')).toHaveCount(0);
    const plates = await cards.locator('.mo-plate').allTextContents();
    assert.deepEqual(plates.map(value => Number(value.replace(/[^0-9]/g, ''))), ids.map((_, index) => index + 1));
    const habitats = page.locator('#sala-habitats');
    await expect(page.locator('.mo-foundation-links')).toHaveCount(0);
    await expect(page.locator('.mo-chapter-notes')).toHaveCount(0);
    await habitats.getByRole('heading', { name: 'Arquitecturas habitables', exact: true }).scrollIntoViewIfNeeded();
    const bernalImage = habitats.locator('[data-concept-id="bernal-sphere"] img');
    await expect.poll(() => bernalImage.evaluate(el => el.complete && el.naturalWidth > 1 && !el.src.startsWith('data:'))).toBe(true);
    await page.screenshot({ path: join(tmpdir(), 'astro-open-groups-' + viewport.width + '.png') });
    assert(await page.locator('.mo-root').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Page overflow: ' + viewport.width);
    if (viewport.width < 720) {
      assert(await page.locator('.mo-halls').evaluate(el => el.clientHeight < 80), 'Compact mobile index');
    }
    for (const chapterId of chapters.map(chapter => chapter.id)) {
      const chapter = page.locator('#sala-' + chapterId);
      await chapter.locator('.mo-chapter-heading').scrollIntoViewIfNeeded();
      assert(await chapter.locator('.mo-chapter-heading').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Long chapter title overflow: ' + chapterId);
    }
    await page.screenshot({ path: join(tmpdir(), 'astro-open-chapter-' + viewport.width + '.png') });
    await habitats.locator('[data-concept-id="ringworld"] button').click();
    await expect(page.locator(titleFor('ringworld'))).toBeVisible();
    await verifyNavigation('ringworld');
    await expect(page.locator('.mo-reading-connections, .mo-chapter-continue')).toHaveCount(0);
    await headerNext.click();
    await expect(page.locator(titleFor('reusable-launch'))).toBeVisible();
    await page.reload();
    await expect(page.locator(titleFor('reusable-launch'))).toBeVisible();
    console.log(viewport.width + 'px: 106 tarjetas abiertas, grupos, títulos largos, navegación y recarga correctos.');
  }

  const vitrineIds = ['dyson-swarm', 'iss', 'ringworld', 'tethers'];
  const vitrine = vitrineIds.map(id => conceptById.get(id));
  await page.evaluate(selected => {
    globalThis.localStorage.setItem('mo-vitrine', JSON.stringify(selected));
    globalThis.history.replaceState(null, '', globalThis.location.pathname + '#obra-tethers');
  }, vitrineIds);
  await page.reload();
  await expect(page.locator(titleFor('tethers'))).toBeVisible();
  await verifyNavigation('tethers');
  await expect(page.locator('.mo-studio-plate')).toHaveText(
    'N.º ' + String(ids.indexOf('tethers') + 1).padStart(2, '0') + ' / 106',
  );
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(titleFor('skyhook'))).toBeVisible();
  await expect(page).toHaveURL(/#obra-skyhook$/);
  console.log('Una obra guardada en la vitrina conserva la navegación del recorrido general.');

  await page.evaluate(() => {
    globalThis.location.hash = 'vitrina-obra-dyson-swarm';
  });
  await page.reload();
  await expect(page.locator(titleFor(vitrineIds[0]))).toBeVisible();
  await expect(page).toHaveURL(/#vitrina-obra-dyson-swarm$/);
  for (const [index, id] of vitrineIds.entries()) {
    await expect(page.locator(titleFor(id))).toBeVisible();
    await verifyNavigation(id, vitrine, 'vitrine');
    await expect(page.locator('.mo-studio-plate')).toHaveText(
      'Vitrina · ' + String(index + 1).padStart(2, '0') + ' / 04',
    );
    if (index < vitrineIds.length - 1) await headerNext.click();
  }
  await expect(headerNext).toBeDisabled();
  await headerPrevious.click();
  await expect(page.locator(titleFor('ringworld'))).toBeVisible();
  await page.getByRole('button', { name: /En la vitrina de contrastes/ }).click();
  await expect(page.locator(titleFor('ringworld'))).toBeVisible();
  await expect(page.locator('.mo-studio-plate')).toHaveText(
    'N.º ' + String(ids.indexOf('ringworld') + 1).padStart(2, '0') + ' / 106',
  );
  await expect(page).toHaveURL(/#obra-ringworld$/);

  await page.evaluate(() => {
    globalThis.location.hash = 'vitrina-obra-ringworld';
  });
  await expect(page.locator(titleFor('ringworld'))).toBeVisible();
  await expect(page.locator('.mo-studio-plate')).toHaveText(
    'N.º ' + String(ids.indexOf('ringworld') + 1).padStart(2, '0') + ' / 106',
  );
  await expect(page).toHaveURL(/#obra-ringworld$/);
  console.log('Vitrina: contexto persistente, eliminación activa y URL inválida normalizados.');
  assert.deepEqual(errors, []);
  console.log('Capturas: ' + tmpdir() + '/astro-open-*.png');
} finally {
  await browser?.close();
  await server.close();
}
