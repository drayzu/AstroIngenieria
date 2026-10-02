/* global document, location */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { conceptTitles } from './englishTerminology.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 5195, strictPort: true }, logLevel: 'error' });
let browser;
try {
  const { getCatalog } = await server.ssrLoadModule('/src/i18n/catalog.ts');
  const { loadArticle } = await server.ssrLoadModule('/src/data/articles/loadArticle.ts');
  const { englishMessages, spanishMessages, translate } = await server.ssrLoadModule('/src/i18n/messages.ts');
  const { LAB_TOOLS } = await server.ssrLoadModule('/src/designs/museo-orbital/CosmicLab.ts');
  const es = getCatalog('es'), en = getCatalog('en');
  const catalogCopy = JSON.parse(await readFile('src/i18n/catalog.en.json', 'utf8'));
  const visibleFields = new Set(['title', 'summary', 'question', 'body', 'category', 'keyIdea', 'mentalImage', 'mechanism', 'advantages', 'difficulties', 'alt', 'label', 'role', 'target', 'caption', 'credit', 'visualNotes', 'description', 'missionLabel', 'cta', 'visualFocus', 'fallback']);
  const verifyCatalogCopy = (original, copy, path) => {
    for (const [key, value] of Object.entries(original)) {
      if (key === 'sources' || key === 'concepts') continue;
      if (visibleFields.has(key) && typeof value === 'string') assert.equal(typeof copy?.[key], 'string', `Catalog translation: ${path}/${key}`);
      else if (visibleFields.has(key) && Array.isArray(value) && value.every(item => typeof item === 'string')) {
        assert.equal(copy?.[key]?.length, value.length, `Catalog list coverage: ${path}/${key}`);
        assert(copy[key].every(item => typeof item === 'string' && item.trim()), `Empty catalog list: ${path}/${key}`);
      } else if (value && typeof value === 'object') {
        if (Array.isArray(value)) value.forEach((item, i) => { if (item && typeof item === 'object') verifyCatalogCopy(item, copy?.[key]?.[i], `${path}/${key}/${i}`); });
        else verifyCatalogCopy(value, copy?.[key], `${path}/${key}`);
      }
    }
  };
  for (const chapter of es.chapters) verifyCatalogCopy(chapter, catalogCopy.chapters[chapter.id], chapter.id);
  for (const concept of es.allConcepts) verifyCatalogCopy(concept, catalogCopy.concepts[concept.id], concept.id);
  const citations = text => [...text.matchAll(/\[\d+\]/g)].map(match => match[0]);
  const mathSymbols = text => [...text.matchAll(/[²³¹⁴⁵⁶⁷⁸⁹⁰⁻₀₁₂₃₄₅₆₇₈₉½≈ṁλθωηγΔτπεσρ★√]/g)].map(match => match[0]).sort();
  const formulas = ['E = mc²', 'm = 0,002 kg', 'a = ω²r', 'ω = 2πn/60', 'σ ≈ ρv²', 'a = v²/r', 'σ ≈ ρar', 'Δv = ve ln(m₀/mf)', 'F = (ρexterior − ρinterior)gV', '½ṁve²', 'F ≈ ṁve', 'F ≈ 2ηP/ve', 'K = (log₁₀ P − 6) / 10', 'L = v²/(2a)', 'v = ωr = √(ar)', 'A = 2πrL', 'F = ΔpA', 'p = E/c', 'F = P/c', 'γ = 1/√(1 − v²/c²)', 'Δτ = Δt/γ', 'K = (γ − 1)mc²', 'a = v²/R', 'F = 2IA/c', 'ω = √(a/r)', 'a = F/M', 'Δv = at', 'dP/dr = −Gm(r)ρ(r)/r²', 'E = Pt', 't = d/v'];
  const numbers = text => [...text.matchAll(/\b\d+(?:[.,]\d+)*\b/g)].map(match => match[0].replaceAll(',', '.')).sort();
  assert.deepEqual(Object.keys(englishMessages), Object.keys(spanishMessages));
  for (const [key, value] of Object.entries(englishMessages)) {
    assert(value.trim(), `Missing message: ${key}`);
    assert.deepEqual([...value.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), [...key.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), `Message placeholders: ${key}`);
  }
  for (const tool of LAB_TOOLS) for (const key of ['name', 'hint', 'category']) assert(Object.hasOwn(englishMessages, tool[key]), `Untranslated tool ${tool.id}/${key}`);
  assert.equal(en.allConcepts.length, 106);
  assert.deepEqual(en.chapters.map(c => c.id), es.chapters.map(c => c.id));
  assert.deepEqual(en.allConcepts.map(c => c.id), es.allConcepts.map(c => c.id));
  let words = 0;
  for (const concept of en.allConcepts) {
    const original = es.conceptById.get(concept.id);
    assert.equal(concept.title, conceptTitles[concept.id], `Reviewed exhibit name: ${concept.id}`);
    for (const key of ['id', 'chapterId', 'sourceChapterId', 'scale', 'plausibility', 'metrics', 'related', 'sources']) assert.deepEqual(concept[key], original[key], `${concept.id}/${key}`);
    assert.equal(concept.illustration.src, original.illustration.src);
    const [spanish, english] = await Promise.all([loadArticle(concept.sourceChapterId, concept.id, 'es'), loadArticle(concept.sourceChapterId, concept.id, 'en')]);
    assert.deepEqual(english.sources, spanish.sources, `Bibliography: ${concept.id}`);
    assert.deepEqual(english.blocks.map(b => b.kind), spanish.blocks.map(b => b.kind), `Structure: ${concept.id}`);
    assert(english.title && english.lead && english.title !== spanish.title, `English introduction: ${concept.id}`);
    for (const [index, block] of english.blocks.entries()) {
      const originalBlock = spanish.blocks[index];
      if (block.kind === 'image') assert.equal(block.variant, originalBlock.variant);
      const texts = block.kind === 'note' ? block.paragraphs : [block.kind === 'image' ? block.caption : block.text];
      const originals = originalBlock.kind === 'note' ? originalBlock.paragraphs : [originalBlock.kind === 'image' ? originalBlock.caption : originalBlock.text];
      assert.equal(texts.length, originals.length, `Paragraph coverage: ${concept.id}/${index}`);
      texts.forEach((text, i) => {
        assert(text.trim(), `Empty translated block: ${concept.id}/${index}`);
        assert.deepEqual(citations(text), citations(originals[i]), `Citations: ${concept.id}/${index}/${i}`);
        assert.deepEqual(mathSymbols(text), mathSymbols(originals[i]), `Mathematical notation: ${concept.id}/${index}/${i}`);
        assert.deepEqual(numbers(text), numbers(originals[i]), `Numerical values: ${concept.id}/${index}/${i}`);
        for (const formula of formulas) if (originals[i].includes(formula)) assert(text.replaceAll(',', '.').includes(formula.replaceAll(',', '.')), `Formula fidelity: ${concept.id}/${index}/${formula}`);
        assert(!/technosignatureatures|\bJulys\b|\bStanford bull\b|\bregolito\b|\babortion\b|\bmoment (?:exchange|transfer|conservation)\b|\bconservation of the moment\b/i.test(text), `Technical terminology: ${concept.id}/${index}`);
        words += text.split(/\s+/).length;
      });
    }
  }
  await assert.rejects(loadArticle('missing', 'missing', 'en'));
  assert.equal(translate('Capítulo {0}', 'en', 2), 'Chapter 2');
  console.log(`Coverage: 106 complete English articles (${words} words), structure, references, assets and dictionary verified.`);

  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const artifactDir = join(tmpdir(), 'astro-i18n');
  await mkdir(artifactDir, { recursive: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = 'http://127.0.0.1:5195/AstroIngenieria/';
  const choose = language => page.locator('.mo-hero-toolbar .mo-language-switch button').filter({ hasText: language }).click();
  await page.goto(base);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('h1')).toHaveAttribute('aria-label', 'Astroingeniería');
  await choose('EN');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveAttribute('aria-label', 'Astroengineering');
  await expect(page.locator('.mo-hero-letter')).toHaveCount(16);
  assert.equal(await page.evaluate(() => localStorage.getItem('mo-locale')), 'en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Astroengineering — Orbital Museum');
  await expect(page.locator('.mo-hero-letter').last()).toHaveCSS('transform', 'none');
  await page.screenshot({ path: join(artifactDir, 'english-desktop.png') });
  await page.locator('.mo-hero-index').click();
  await page.locator('.mo-menu .mo-language-switch button').filter({ hasText: 'ES' }).click();
  await expect(page.locator('.mo-menu h2')).toHaveText('Índice del recorrido');
  await page.locator('.mo-menu .mo-language-switch button').filter({ hasText: 'EN' }).click();
  await page.screenshot({ path: join(artifactDir, 'english-index.png') });
  await page.locator('.mo-menu-close').click();
  for (const concept of en.allConcepts) {
    await page.evaluate(id => { location.hash = `obra-${id}`; }, concept.id);
    await expect(page.locator('.ar-reader')).toHaveAttribute('data-locale', 'en');
    await expect(page.locator(`#article-${concept.id}-title`)).toBeVisible();
    assert(await page.locator('.ar-reader').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `English article overflow: ${concept.id}`);
  }
  console.log('All 106 direct links load their English readings.');
  await page.evaluate(() => { location.hash = 'obra-oneill-cylinder'; });
  await expect(page.locator('#article-oneill-cylinder-title')).toBeVisible();
  await page.locator('.mo-filmstrip button').nth(1).click();
  const selectedImage = await page.locator('.mo-filmstrip button').nth(1).locator('img').getAttribute('src');
  await expect(page.locator('.mo-studio-figure .mo-kb img')).toHaveAttribute('src', selectedImage);
  await page.locator('.mo-studio-figure .mo-kb img').evaluate(image => image.decode());
  await page.screenshot({ path: join(artifactDir, 'english-desktop-reading.png') });
  await page.locator('.mo-vitrine-toggle').click();
  await page.locator('.mo-studio-scroll').evaluate(element => { element.scrollTop = (element.scrollHeight - element.clientHeight) * .55; });
  const before = await page.locator('.mo-studio-scroll').evaluate(element => element.scrollTop / (element.scrollHeight - element.clientHeight));
  await expect(page.locator('.mo-studio .mo-language-switch')).toHaveCount(0);
  // Exercise an external locale update without adding a selector to the reading room.
  await page.locator('.mo-hero-toolbar .mo-language-switch button').filter({ hasText: 'ES' }).evaluate(button => button.click());
  await expect(page.locator('.ar-reader')).toHaveAttribute('data-locale', 'es');
  await expect(page.locator('.mo-filmstrip button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  assert.equal(await page.locator('.mo-studio-figure .mo-kb img').getAttribute('src'), selectedImage);
  assert.equal(await page.evaluate(() => location.hash), '#obra-oneill-cylinder');
  await expect(page.locator('.mo-vitrine-toggle')).toHaveClass(/is-in/);
  const after = await page.locator('.mo-studio-scroll').evaluate(element => element.scrollTop / (element.scrollHeight - element.clientHeight));
  assert(Math.abs(after - before) < .04, `Reading progress preserved: ${before}/${after}`);
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('.mo-hero-toolbar .mo-language-switch button');
    buttons[1].click(); buttons[0].click(); buttons[1].click();
  });
  await expect(page.locator('.ar-reader')).toHaveAttribute('data-locale', 'en');
  await page.locator('.mo-studio-close').click();
  await expect(page.locator('.mo-studio')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mo-hero-toolbar .mo-language-switch')).toBeVisible();
  assert(await page.locator('.mo-root').evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Mobile museum overflow');
  await page.screenshot({ path: join(artifactDir, 'english-mobile.png') });
  await page.evaluate(() => { location.hash = 'obra-stanford-torus'; });
  await expect(page.locator('#article-stanford-torus-title')).toBeVisible();
  assert(await page.locator('.mo-studio-panel').evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Mobile studio overflow');
  const assertMetricHeadingFits = async () => {
    const label = await page.locator('.mo-studio-brief .mo-metric-profile-heading > span').boundingBox();
    const button = await page.locator('.mo-studio-brief .mo-metric-profile-heading .mo-vitrine-toggle').boundingBox();
    assert(label && button && label.y + label.height <= button.y, 'Mobile metric label overlaps the showcase button');
  };
  await assertMetricHeadingFits();
  await expect(page.locator('.mo-studio')).toHaveCSS('opacity', '1');
  await page.locator('.mo-studio-figure .mo-kb img').evaluate(image => image.decode());
  await page.screenshot({ path: join(artifactDir, 'english-mobile-reading.png') });
  await expect(page.locator('.mo-studio .mo-language-switch')).toHaveCount(0);
  await page.locator('.mo-studio-close').click();
  await expect(page.locator('.mo-studio')).toHaveCount(0);
  await page.locator('.mo-hero-toolbar .mo-language-switch button').filter({ hasText: 'ES' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.evaluate(() => { location.hash = 'obra-stanford-torus'; });
  await expect(page.locator('.ar-reader')).toHaveAttribute('data-locale', 'es');
  await assertMetricHeadingFits();
  await page.locator('.mo-studio-figure .mo-kb img').evaluate(image => image.decode());
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(artifactDir, 'spanish-mobile-reading.png') });
  const blocked = await browser.newPage({ reducedMotion: 'reduce' });
  await blocked.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await blocked.goto(base);
  await expect(blocked.locator('html')).toHaveAttribute('lang', 'es');
  await blocked.locator('.mo-hero-toolbar .mo-language-switch button').filter({ hasText: 'EN' }).click();
  await expect(blocked.locator('html')).toHaveAttribute('lang', 'en');
  await blocked.close();
  const racing = await browser.newPage({ reducedMotion: 'reduce' });
  racing.on('pageerror', error => errors.push(error.message));
  await racing.route('**/i18n/articles/en/intro.ts*', async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.continue();
  });
  await racing.goto(base + '#obra-astroingenieria');
  await expect(racing.locator('.ar-reader')).toHaveAttribute('data-locale', 'es');
  await racing.locator('.mo-hero-toolbar .mo-language-switch button').filter({ hasText: 'EN' }).evaluate(button => button.click());
  await expect(racing.locator('html')).toHaveAttribute('lang', 'en');
  await racing.locator('.mo-hero-toolbar .mo-language-switch button').filter({ hasText: 'ES' }).evaluate(button => button.click());
  await expect(racing.locator('.ar-reader')).toHaveAttribute('data-locale', 'es');
  await racing.waitForTimeout(850);
  await expect(racing.locator('.ar-reader')).toHaveAttribute('data-locale', 'es');
  await racing.close();
  const failed = await browser.newPage({ reducedMotion: 'reduce' });
  await failed.goto(base);
  await failed.locator('.mo-hero-toolbar .mo-language-switch button').filter({ hasText: 'EN' }).click();
  await failed.route('**/i18n/articles/en/energy.ts*', route => route.abort('failed'));
  await failed.evaluate(() => { location.hash = 'obra-dyson-swarm'; });
  await expect(failed.locator('.ar-status[role="alert"]')).toContainText('The reading could not be loaded.');
  await failed.unroute('**/i18n/articles/en/energy.ts*');
  await failed.locator('.ar-status button').click();
  await expect(failed.locator('.ar-reader')).toHaveAttribute('data-locale', 'en');
  await expect(failed.locator('#article-dyson-swarm-title')).toBeVisible();
  assert.equal(await failed.evaluate(() => location.hash), '#obra-dyson-swarm');
  await failed.close();
  const labPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  labPage.on('pageerror', error => errors.push(error.message));
  await labPage.goto(base, { waitUntil: 'networkidle' });
  await expect(labPage.locator('.mo-root')).toBeVisible();
  await labPage.mouse.move(680, 320);
  await labPage.keyboard.down('KeyQ'); await labPage.keyboard.down('KeyE');
  const lab = labPage.locator('.mo-cosmic-lab');
  await expect(lab).toBeVisible();
  await labPage.keyboard.up('KeyQ'); await labPage.keyboard.up('KeyE');
  await lab.getByRole('button', { name: 'Favorito: Aurora viva', exact: true }).click();
  await lab.locator('.mo-lab-tool-aurora').click();
  await expect(lab).toHaveAttribute('data-tool', 'aurora');
  const canvas = await labPage.locator('.mo-starfx').elementHandle();
  await lab.locator('.mo-language-switch button').filter({ hasText: 'EN' }).click();
  await expect(lab).toHaveAttribute('data-tool', 'aurora');
  assert(await canvas.evaluate(element => element === document.querySelector('.mo-starfx')), 'Canvas retained across language change');
  await expect(lab.locator('[role="status"]')).toContainText('Drag the ends of the curtain');
  await expect(lab.getByRole('button', { name: 'Favorite: Living aurora', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await lab.getByRole('button', { name: 'All', exact: true }).click();
  await lab.getByRole('searchbox').fill('black hole');
  await expect(lab.locator('.mo-lab-tool')).toHaveCount(1);
  await expect(lab.locator('.mo-lab-tool')).toContainText('Black hole');
  await lab.getByRole('searchbox').fill('');
  await lab.locator('.mo-lab-tool-portal').click();
  await labPage.mouse.click(390, 320);
  await expect(lab.locator('[role="status"]')).toContainText('First mouth ready');
  await lab.locator('.mo-language-switch button').filter({ hasText: 'ES' }).click();
  await expect(lab.locator('[role="status"]')).toContainText('Primera boca lista');
  await labPage.mouse.click(1030, 320);
  await expect(lab.locator('[role="status"]')).toContainText('Puente conectado');
  await labPage.screenshot({ path: join(artifactDir, 'lab-language-switch.png') });
  await labPage.close();
  assert.deepEqual(errors, [], 'Browser errors');
  console.log(`Persistence, menu, keyboard, rapid switching, reading position, image, showcase, lab state/search and mobile layout verified. Screenshots: ${artifactDir}`);
} finally {
  await browser?.close();
  await server.close();
}
