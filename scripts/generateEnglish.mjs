import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chapterTitles, conceptTitles } from './englishTerminology.mjs';
import { reviewedArticleCopy, reviewArticleTerminology } from './englishReview.mjs';

// Offline authoring tool: deployed pages never call a translation service.
const extractOnly = process.argv.includes('--extract');
const destination = 'src/i18n';
const textFields = new Set(['title', 'summary', 'question', 'body', 'category', 'keyIdea', 'mentalImage', 'mechanism', 'advantages', 'difficulties', 'alt', 'label', 'role', 'target', 'caption', 'credit', 'visualNotes', 'description', 'missionLabel', 'cta', 'visualFocus', 'fallback']);

function technicalCopy(text, original) {
  if (/regolito/i.test(original)) text = text.replace(/\bregolito\b/gi, 'regolith');
  if (/uniones/i.test(original)) text = text.replace(/\bunions\b/gi, 'joints');
  if (/reservas/i.test(original)) text = text.replace(/\breservations\b/gi, 'reserves');
  if (/vapor/i.test(original)) text = text.replace(/\bsteam\b/gi, 'vapor');
  if (/abort/i.test(original)) text = text.replace(/\babortion\b/gi, 'abort maneuvers');
  if (/CO₂/.test(original)) text = text.replace(/\bCO2\b/g, 'CO₂');
  if (/años luz/.test(original)) text = text.replace(/light years old/gi, 'light years away');
  if (/nave/i.test(original)) text = text.replace(/\bnaves?\b/gi, 'spacecraft');
  if (/repelen/i.test(original)) text = text.replace(/\brepellen\b/gi, 'repel');
  if (/tethers cargados/i.test(original)) text = text.replace(/Tethers loaded/gi, 'Charged tethers');
  if (/transferencia de momento|transfiriendo momento|conservación del momento/i.test(original)) text = text.replace(/\bmoment\b/gi, 'momentum');
  if (/depósitos de combustible orbital|red orbital con puertos|depósitos flotantes/i.test(original)) text = text.replace(/\bdeposits\b/gi, 'depots');
  text = text.replace(/\bionic engines\b/gi, 'ion engines').replace(/\bionic engine\b/gi, 'ion engine');
  text = text.replace(/\bionic propulsion\b/gi, 'ion propulsion');
  if (/escalas temporales/i.test(original)) text = text.replace(/temporary scales/gi, 'time scales');
  if (/momento angular/i.test(original)) text = text.replace(/angular moment\b/gi, 'angular momentum');
  if (/tensión eléctrica/i.test(original)) text = text.replace(/electrical tension/gi, 'electrical voltage');
  if (/tensi[oó]n(?:es)?/i.test(original) && !/eléctric|volt|corriente|potencial|circuito/i.test(original)) {
    text = text.replace(/\bvoltages\b/gi, 'tensions').replace(/\bvoltage\b/gi, 'tension');
  }
  if (/nave que rota/i.test(original)) text = text.replace(/a broken ship/gi, 'a rotating spacecraft');
  return text;
}

function collect(value, path = [], result = []) {
  if (Array.isArray(value)) value.forEach((child, index) => collect(child, [...path, index], result));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'sources' || key === 'concepts') continue;
      if (typeof child === 'string' && textFields.has(key)) result.push({ path: [...path, key], text: child });
      else if (Array.isArray(child) && textFields.has(key)) child.forEach((text, index) => result.push({ path: [...path, key, index], text }));
      else if (child && typeof child === 'object') collect(child, [...path, key], result);
    }
  }
  return result;
}

function patch(slots, translated) {
  const result = {};
  slots.forEach(({ path }, index) => {
    let target = result;
    path.forEach((key, depth) => {
      if (depth === path.length - 1) target[key] = translated[index];
      else target = target[key] ??= typeof path[depth + 1] === 'number' ? [] : {};
    });
  });
  return result;
}

async function cachedTranslation(slots, filename, label) {
  if (extractOnly) {
    await writeFile(filename.replace('.json', '.input.json'), JSON.stringify({ slots, label }), 'utf8');
    return slots.map(slot => slot.text);
  }
  try {
    const cached = JSON.parse(await readFile(filename, 'utf8'));
    if (cached.source === JSON.stringify(slots)) return cached.result.map((text, index) => technicalCopy(text, slots[index].text));
  } catch { /* Generate missing or stale authoring output. */ }
  throw new Error(`Missing authored translation: ${label}. Run the offline translation authoring step first.`);
}

await mkdir(`${destination}/articles/en`, { recursive: true });
await mkdir('tmp/english-authoring', { recursive: true });
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { chapters, allConcepts } = await server.ssrLoadModule('/src/data/astroData.ts');
  const { loadArticle } = await server.ssrLoadModule('/src/data/articles/loadArticle.ts');
  const jobs = [];
  const catalog = { chapters: {}, concepts: {} };
  for (const [kind, items] of [['chapters', chapters], ['concepts', allConcepts]]) {
    for (const item of items) jobs.push(async () => {
      const slots = collect(item);
      const values = await cachedTranslation(slots, `tmp/english-authoring/${kind}-${item.id}.json`, `${kind}: ${item.title}`);
      catalog[kind][item.id] = patch(slots, values);
      console.log(`Catalog ${kind}/${item.id}`);
    });
  }
  const translatedArticles = new Map();
  for (const concept of allConcepts) jobs.push(async () => {
    const article = await loadArticle(concept.sourceChapterId, concept.id);
    const slots = [
      { path: ['title'], text: article.title }, { path: ['lead'], text: article.lead },
      ...article.blocks.flatMap((block, index) => block.kind === 'note' ? [
        { path: ['blocks', index, 'title'], text: block.title },
        ...block.paragraphs.map((text, p) => ({ path: ['blocks', index, 'paragraphs', p], text })),
      ] : [{ path: ['blocks', index, block.kind === 'image' ? 'caption' : 'text'], text: block.kind === 'image' ? block.caption : block.text }]),
    ];
    const values = await cachedTranslation(slots, `tmp/english-authoring/article-${concept.id}.json`, `Article: ${concept.title}`);
    if (!extractOnly) {
      for (const [index, text] of Object.entries(reviewedArticleCopy[concept.id] ?? {})) values[Number(index)] = text;
      values.forEach((text, index) => { values[index] = reviewArticleTerminology(concept.id, index, text); });
    }
    const translated = patch(slots, values);
    const blocks = article.blocks.map((block, index) => ({ ...block, ...translated.blocks[index] }));
    const mainText = [translated.lead, ...blocks.flatMap(block => block.kind === 'paragraph' || block.kind === 'heading' ? [block.text] : [])].join(' ');
    translatedArticles.set(concept.id, { ...article, title: translated.title, lead: translated.lead, blocks, readingMinutes: Math.max(1, Math.ceil(mainText.split(/\s+/).length / 200)) });
    console.log(`Article ${concept.id} (${mainText.split(/\s+/).length} words)`);
  });
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (next < jobs.length) await jobs[next++](); }));
  if (!extractOnly) {
  for (const [id, title] of Object.entries(chapterTitles)) catalog.chapters[id].title = title;
  for (const [id, title] of Object.entries(conceptTitles)) catalog.concepts[id].title = title;
  await writeFile(`${destination}/catalog.en.json`, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  for (const chapterId of new Set(allConcepts.map(item => item.sourceChapterId))) {
    const articles = allConcepts.filter(item => item.sourceChapterId === chapterId).map(item => translatedArticles.get(item.id));
    await writeFile(`${destination}/articles/en/${chapterId}.ts`, `import type { ConceptArticle } from '../../../data/articles/model';\n\nexport default ${JSON.stringify(articles, null, 2)} satisfies ConceptArticle[];\n`, 'utf8');
  }
  console.log(`English catalog and ${translatedArticles.size} complete articles saved.`);
  } else console.log('Source strings extracted for offline English authoring.');
} finally {
  await server.close();
}
