import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';

const base = process.env.ARTICLE_TEST_URL ?? 'http://127.0.0.1:5173/AstroIngenieria/';
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}#obra-mars-terraforming`);
  const ids = await page.evaluate(async () => {
    const { allConcepts } = await import('/AstroIngenieria/src/data/astroData.ts');
    return allConcepts.map(item => item.id);
  });
  for (const id of ids) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert.equal(await page.locator('.ar-status[role="alert"]').count(), 0);
  }
  console.log(`Escritorio: ${ids.length} enlaces directos cargan su artículo.`);
  const editorialBatchOne = ['tipo-i', 'tipo-ii', 'tipo-iii'];
  for (const id of editorialBatchOne) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(id === 'tipo-iii' ? 5 : 4);
    await reader.locator('.ar-note summary').click();
    await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
  }
  console.log('Tanda 1: las tres lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchTwo = {
    'civilizaciones-digitales': 4,
    postbiological: 3,
    'deep-time': 4,
  };
  for (const [id, headings] of Object.entries(editorialBatchTwo)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    await reader.locator('.ar-note summary').click();
    await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
  }
  console.log('Tanda 2: las tres lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchThree = {
    'von-neumann': 4,
    'colonizacion-galactica': 4,
    'grabby-aliens': 3,
  };
  for (const [id, headings] of Object.entries(editorialBatchThree)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    await reader.locator('.ar-note summary').click();
    await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
  }
  console.log('Tanda 3: las tres lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchFour = {
    'great-filter': 5,
    'zoo-hypothesis': 3,
    'dark-forest': 3,
    'civilizaciones-silenciosas': 3,
    berserker: 3,
  };
  for (const [id, headings] of Object.entries(editorialBatchFour)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    await reader.locator('.ar-note summary').click();
    await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
  }
  console.log('Tanda 4: las cinco lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchFive = { seti: 5, technosignatures: 3, 'radio-seti': 3, 'optical-seti': 3, 'civilizaciones-y-luz': 4 };
  for (const [id, headings] of Object.entries(editorialBatchFive)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    await reader.locator('.ar-note summary').click();
    await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
  }
  console.log('Tanda 5: las cinco lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchSix = { 'project-orion': 5, 'fusion-propulsion': 5, antimatter: 5, 'bussard-ramjet': 3 };
  for (const [id, headings] of Object.entries(editorialBatchSix)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 6: las cuatro lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchSeven = { alcubierre: 6, wormholes: 5, reactionless: 4 };
  for (const [id, headings] of Object.entries(editorialBatchSeven)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 7: las tres lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchEight = { 'ion-engines': 3, 'hall-thruster': 3, 'solar-electric': 4, 'nuclear-electric': 4 };
  for (const [id, headings] of Object.entries(editorialBatchEight)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 8: las cuatro lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchNine = { 'chemical-rockets': 4, 'nuclear-thermal': 4, 'solar-sail': 3, 'beamed-propulsion': 4 };
  for (const [id, headings] of Object.entries(editorialBatchNine)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 9: las cuatro lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchTen = { 'laser-sail': 5, 'magnetic-sail': 4, 'electric-sail': 3, 'interstellar-braking': 4 };
  for (const [id, headings] of Object.entries(editorialBatchTen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 10: las cuatro lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchEleven = { 'venus-terraforming': 6, 'floating-venus': 5 };
  for (const [id, headings] of Object.entries(editorialBatchEleven)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 11: las dos lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchTwelve = { paraterraforming: 4, worldhouse: 4, 'domed-cities': 5 };
  for (const [id, headings] of Object.entries(editorialBatchTwelve)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 12: las tres lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchThirteen = { habitability: 5, 'habitable-zone': 4, ecopoiesis: 5, 'planetary-protection': 5 };
  for (const [id, headings] of Object.entries(editorialBatchThirteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 13: las cuatro lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchFourteen = { 'orbital-mirrors': 4, sunshades: 3, 'volatile-import': 5, magnetosphere: 5 };
  for (const [id, headings] of Object.entries(editorialBatchFourteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 14: las cuatro lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchFifteen = { 'stellar-engines': 5, shkadov: 4, caplan: 6 };
  for (const [id, headings] of Object.entries(editorialBatchFifteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 15: las tres lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchSixteen = { 'star-lifting': 6, 'stellar-husbandry': 5, 'plasma-processing': 6 };
  for (const [id, headings] of Object.entries(editorialBatchSixteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 16: las tres lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchSeventeen = { 'stellar-physics': 5, 'stellar-navigation': 5, 'stellar-technosignatures': 6 };
  for (const [id, headings] of Object.entries(editorialBatchSeventeen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 17: las tres lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchEighteen = { 'orbital-ring': 7, 'launch-loop': 7, skyhook: 5, tethers: 5, 'mass-driver': 5 };
  for (const [id, headings] of Object.entries(editorialBatchEighteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 18: las cinco lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchNineteen = { shipyards: 5, 'orbital-ports': 5, 'fuel-depots': 5, 'reusable-launch': 5 };
  for (const [id, headings] of Object.entries(editorialBatchNineteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 19: las cuatro lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchTwenty = { 'lunar-bases': 3, isru: 2, 'asteroid-mining': 4 };
  for (const [id, headings] of Object.entries(editorialBatchTwenty)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 20: las tres lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchTwentyOne = { 'space-based-solar': 3, 'microwave-power': 2, radiators: 2, 'dyson-ring': 2, 'dyson-bubble': 3 };
  for (const [id, headings] of Object.entries(editorialBatchTwentyOne)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 21: las cinco lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchTwentyTwo = { 'matrioshka-brain': 5, 'jupiter-brain': 3, computronium: 3, 'dyson-shell': 4 };
  for (const [id, headings] of Object.entries(editorialBatchTwentyTwo)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 22: las cuatro lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchTwentyThree = { exoplanets: 4, 'future-universe': 4, ringworld: 3 };
  for (const [id, headings] of Object.entries(editorialBatchTwentyThree)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 23: las tres lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchTwentyFour = { 'space-law': 4, 'cosmic-ethics': 4 };
  for (const [id, headings] of Object.entries(editorialBatchTwentyFour)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 24: las dos lecturas, sus apartados y notas cargan correctamente en escritorio.');
  const editorialBatchTwentyFive = {
    'space-elevator': 5,
    'dyson-swarm': 5,
    'relativistic-propulsion': 3,
    terraforming: 4,
    'mars-terraforming': 4,
    'black-hole-engineering': 3,
    fermi: 4,
    astrobiology: 3,
  };
  for (const [id, headings] of Object.entries(editorialBatchTwentyFive)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Desktop editorial overflow: ${id}`);
    await expect(reader.locator(':scope > h4')).toHaveCount(headings);
    await expect(reader.locator('.ar-sources a').first()).toHaveAttribute('href', /^https:\/\//);
    if (await reader.locator('.ar-note summary').count()) {
      await reader.locator('.ar-note summary').click();
      await expect(reader.locator('.ar-note')).toHaveAttribute('open', '');
    }
  }
  console.log('Tanda 25: las ocho referencias auditadas cargan con apartados, notas y fuentes en escritorio.');
  await page.evaluate(() => { globalThis.location.hash = 'obra-mars-terraforming'; });
  await expect(page.locator('#article-mars-terraforming-title')).toBeVisible();
  await page.locator('.ar-note summary').first().click();
  await expect(page.locator('.ar-note').first()).toHaveAttribute('open', '');
  await page.locator('.ar-citation').first().click();
  await expect(page.locator('#article-mars-terraforming-source-1')).toBeFocused();
  assert.equal(new URL(page.url()).hash, '#obra-mars-terraforming');
  await page.locator('.mo-studio-nav button').last().click();
  await expect(page.locator('#article-venus-terraforming-title')).toBeVisible();
  assert.equal(await page.locator('.ar-note[open]').count(), 0);
  await page.locator('.ar-reader').scrollIntoViewIfNeeded();
  const desktopShot = join(tmpdir(), 'astro-articles-desktop.png');
  await page.screenshot({ path: desktopShot });
  console.log(`Notas, referencias y siguiente tema correctos. Captura: ${desktopShot}`);

  const imageExpectations = {
    astroingenieria: 2,
    kardashev: 2,
    'artificial-gravity': 2,
    iss: 3,
    'bernal-sphere': 3,
    'oneill-cylinder': 3,
    worldship: 3,
    'life-support': 3,
  };
  for (const [id, expected] of Object.entries(imageExpectations)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    const reader = page.locator('.ar-reader');
    assert.equal(await reader.locator('figure').count(), expected, `Image count for ${id}`);
    const layout = await reader.evaluate(element => {
      const children = [...element.children];
      const figures = children.flatMap((child, index) => child.tagName === 'FIGURE' ? [index] : []);
      return {
        figureCount: figures.length,
        firstFigure: figures[0] ?? -1,
        lastFigure: figures.at(-1) ?? -1,
        childCount: children.length,
        adjacent: figures.some((index, position) => position > 0 && index === figures[position - 1] + 1),
        missingAlt: children.some(child => child.tagName === 'FIGURE' && !child.querySelector('img')?.getAttribute('alt')),
      };
    });
    assert.equal(layout.figureCount, expected, `Figure layout count for ${id}`);
    assert(layout.firstFigure > 0 && layout.lastFigure < layout.childCount - 1, `Figures should be interleaved for ${id}`);
    assert.equal(layout.adjacent, false, `Adjacent figures for ${id}`);
    assert.equal(layout.missingAlt, false, `Missing image alt text for ${id}`);
  }
  console.log('Ocho lecturas verificadas: variantes visuales intercaladas y accesibles.');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of editorialBatchOne) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 1: las tres lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchTwo)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 2: las tres lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchThree)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 3: las tres lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchFour)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 4: las cinco lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchFive)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 5: las cinco lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchSix)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 6: las cuatro lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchSeven)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 7: las tres lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchEight)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 8: las cuatro lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchNine)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 9: las cuatro lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchTen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 10: las cuatro lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchEleven)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 11: las dos lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchTwelve)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 12: las tres lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchThirteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 13: las cuatro lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchFourteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 14: las cuatro lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchFifteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 15: las tres lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchSixteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 16: las tres lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchSeventeen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 17: las tres lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchEighteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 18: las cinco lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchNineteen)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 19: las cuatro lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchTwenty)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 20: las tres lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchTwentyOne)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 21: las cinco lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchTwentyTwo)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 22: las cuatro lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchTwentyThree)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 23: las tres lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchTwentyFour)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 24: las dos lecturas no desbordan horizontalmente en móvil.');
  for (const id of Object.keys(editorialBatchTwentyFive)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Mobile editorial overflow: ${id}`);
  }
  console.log('Tanda 25: las ocho referencias auditadas no desbordan horizontalmente en móvil.');
  await page.evaluate(() => { globalThis.location.hash = 'obra-black-hole-engineering'; });
  await expect(page.locator('#article-black-hole-engineering-title')).toBeVisible();
  await page.locator('.ar-note summary').first().click();
  assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Mobile reader overflow');
  await page.locator('#article-black-hole-engineering-title').scrollIntoViewIfNeeded();
  const mobileShot = join(tmpdir(), 'astro-articles-mobile.png');
  await page.screenshot({ path: mobileShot });
  console.log(`Móvil: lectura y notas sin desbordamiento. Captura: ${mobileShot}`);

  for (const id of Object.keys(imageExpectations)) {
    await page.evaluate(value => { globalThis.location.hash = `obra-${value}`; }, id);
    await expect(page.locator(`#article-${id}-title`)).toBeVisible();
    assert.equal(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, `Mobile image overflow: ${id}`);
  }
  console.log('Móvil: las figuras de los ocho temas verificados no generan desbordamiento horizontal.');

  await page.evaluate(() => { globalThis.location.hash = 'obra-oneill-cylinder'; });
  await expect(page.locator('#article-oneill-cylinder-title')).toBeVisible();
  await page.getByRole('button', { name: /Añadir a la vitrina de contrastes/ }).click();
  await expect(page.getByRole('button', { name: /En la vitrina de contrastes/ })).toBeVisible();
  await expect(page.locator('#article-oneill-cylinder-title')).toBeVisible();
  await page.locator('.mo-back-to-top').click();
  await expect.poll(() => page.locator('.mo-studio-scroll').evaluate(element => element.scrollTop)).toBeLessThan(2);

  const vitrineSelection = ids.slice(0, 9);
  await page.evaluate((value) => {
    globalThis.history.replaceState(null, '', globalThis.location.pathname);
    globalThis.localStorage.setItem('mo-vitrine', JSON.stringify(value));
  }, vitrineSelection);
  await page.reload();
  await page.locator('#vitrina').scrollIntoViewIfNeeded();
  await expect(page.locator('.mo-vitrina-card')).toHaveCount(9);
  const firstVitrineCard = page.locator('.mo-vitrina-card').first();
  await firstVitrineCard.locator('.mo-vitrina-mechanism').click();
  await expect(page.locator('.mo-studio-plate')).toHaveText('Vitrina · 01 / 09');
  const studioNav = page.locator('.mo-studio-nav button');
  await expect(studioNav.first()).toBeDisabled();
  await expect(studioNav.last()).toBeEnabled();
  await studioNav.last().click();
  await expect(page.locator('.mo-studio-plate')).toHaveText('Vitrina · 02 / 09');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.mo-studio-plate')).toHaveText('Vitrina · 01 / 09');
  for (let position = 2; position <= 9; position += 1) {
    await studioNav.last().click();
    await expect(page.locator('.mo-studio-plate')).toHaveText(`Vitrina · ${String(position).padStart(2, '0')} / 09`);
  }
  await expect(studioNav.last()).toBeDisabled();
  await page.locator('.mo-studio-close').click();
  await firstVitrineCard.locator('.mo-vitrina-remove').click();
  await expect(page.locator('.mo-vitrina-card')).toHaveCount(8);
  await expect(page.locator('.mo-studio')).toHaveCount(0);

  const outsideVitrine = ids[10];
  await page.evaluate((value) => { globalThis.location.hash = `obra-${value}`; }, outsideVitrine);
  await expect(page.locator(`#article-${outsideVitrine}-title`)).toBeVisible();
  await expect(page.locator('.mo-studio-plate')).toContainText('N.º');
  console.log('Vitrina: nueve tarjetas, clic amplio, navegación contextual, teclado, límites y retorno al recorrido completo correctos.');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}disenos`);
  await page.getByRole('button', { name: /Observatorio Editorial/ }).click();
  await page.locator('.oe-catalog-list button').first().click();
  await expect(page.locator('.oe-article .ar-reader')).toBeVisible();
  await page.locator('.ar-note summary').first().click();
  await expect(page.locator('.ar-note').first()).toHaveAttribute('open', '');
  await page.locator('.oe-article-nav button').last().click();
  await expect(page.locator('.ar-reader')).toBeVisible();
  console.log('Observatorio: lector compartido, notas y navegación correctos.');

  const recovery = await browser.newPage({ reducedMotion: 'reduce' });
  let blockChapter = true;
  await recovery.route('**/chapters/complements.ts*', route => blockChapter ? route.abort() : route.continue());
  await recovery.goto(`${base}#obra-ringworld`);
  await expect(recovery.getByRole('alert')).toBeVisible();
  blockChapter = false;
  await recovery.getByRole('button', { name: 'Recargar lectura' }).click();
  await expect(recovery.locator('#article-ringworld-title')).toBeVisible();
  assert.equal(new URL(recovery.url()).hash, '#obra-ringworld');
  console.log('Recuperación tras descarga interrumpida correcta, con el tema conservado.');
  assert.deepEqual(errors, [], 'Browser page errors');
} finally {
  await browser.close();
}
