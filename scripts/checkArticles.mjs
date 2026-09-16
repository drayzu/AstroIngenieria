import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { editorialMinimums, editorialPlan, editorialStatuses } from './editorialPlan.mjs';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { chapters, allConcepts } = await server.ssrLoadModule('/src/data/astroData.ts');
  const { loadArticle } = await server.ssrLoadModule('/src/data/articles/loadArticle.ts');
  const { getConceptImageVariants } = await server.ssrLoadModule('/src/designs/shared/conceptImages.ts');
  const seen = new Set();
  const paragraphs = new Map();
  let words = 0;
  let editoriallyReviewed = 0;
  let notes = 0;
  assert.deepEqual(Object.keys(editorialPlan).sort(), allConcepts.map(item => item.id).sort(), 'Editorial plan coverage');
  const storageIds = new Set(allConcepts.map(item => item.sourceChapterId));
  for (const storageId of storageIds) {
    const { default: articles } = await server.ssrLoadModule(`/src/data/articles/chapters/${storageId}.ts`);
    assert.deepEqual(articles.map(item => item.id).sort(), allConcepts.filter(item => item.sourceChapterId === storageId).map(item => item.id).sort(), `Storage coverage: ${storageId}`);
  }
  for (const chapter of chapters) {
    for (const concept of chapter.concepts) {
      assert.deepEqual(
        Object.keys(concept.metrics).sort(),
        ['energia', 'madurez', 'materiales'],
        `Metric profile keys: ${concept.id}`,
      );
      Object.entries(concept.metrics).forEach(([key, value]) => {
        assert(Number.isInteger(value) && value >= 1 && value <= 5, `Invalid metric ${key}: ${concept.id}/${value}`);
      });
      const item = await loadArticle(concept.sourceChapterId, concept.id);
      const variants = getConceptImageVariants(concept);
      assert(!seen.has(item.id), `Duplicate id: ${item.id}`);
      seen.add(item.id);
      assert(item.title.trim() && item.lead.trim(), `Empty introduction: ${item.id}`);
      assert(item.sources.length > 0, `Missing sources: ${item.id}`);
      assert.equal(new Set(item.sources.map(source => source.url)).size, item.sources.length, `Duplicate source: ${item.id}`);
      item.sources.forEach(source => {
        assert(source.title && source.publisher, `Source metadata: ${item.id}`);
        assert.equal(new URL(source.url).protocol, 'https:', `Source URL: ${item.id}`);
      });
      const texts = [item.lead];
      for (const block of item.blocks) {
        if (block.kind === 'note') {
          notes++;
          assert(block.title && block.paragraphs.length, `Empty note: ${item.id}`);
          texts.push(...block.paragraphs);
        } else if (block.kind === 'image') {
          assert(variants.some(variant => variant.id === block.variant), `Missing image variant: ${item.id}/${block.variant}`);
          assert(block.caption, `Empty caption: ${item.id}`);
        } else {
          assert(block.text.trim(), `Empty block: ${item.id}`);
          texts.push(block.text);
          if (block.kind === 'paragraph') {
            assert(!paragraphs.has(block.text), `Repeated paragraph: ${item.id} / ${paragraphs.get(block.text)}`);
            paragraphs.set(block.text, item.id);
          }
        }
      }
      const full = texts.join(' ');
      assert(!/:::|@image|\bTODO\b|\bTBD\b/.test(full), `Unparsed markup: ${item.id}`);
      for (const match of full.matchAll(/\[(\d+)\]/g)) {
        assert(Number(match[1]) > 0 && Number(match[1]) <= item.sources.length, `Invalid citation ${match[0]}: ${item.id}`);
      }
      const count = full.split(/\s+/).length;
      assert(count >= 250, `Insufficient content: ${item.id} (${count} words)`);
      const editorial = editorialPlan[item.id];
      assert(editorialStatuses.includes(editorial.status), `Invalid editorial status: ${item.id}/${editorial.status}`);
      assert(Object.hasOwn(editorialMinimums, editorial.category), `Invalid editorial category: ${item.id}/${editorial.category}`);
      const mainWordCount = item.blocks
        .filter(block => block.kind === 'paragraph')
        .flatMap(block => block.text.trim().split(/\s+/))
        .length;
      if (editorial.status === 'revisado-validado') {
        assert(mainWordCount >= editorialMinimums[editorial.category], `Insufficient editorial content: ${item.id} (${mainWordCount}/${editorialMinimums[editorial.category]} main words)`);
        editoriallyReviewed++;
      }
      if (concept.sourceChapterId === 'intro' || concept.sourceChapterId === 'habitats') {
        const expectedVariants = variants.filter(variant => variant.id !== 'exterior').map(variant => variant.id);
        const imageBlocks = item.blocks.filter(block => block.kind === 'image');
        assert.equal(imageBlocks.length, expectedVariants.length, `Image coverage count: ${item.id}`);
        for (const variant of expectedVariants) {
          assert.equal(imageBlocks.filter(block => block.variant === variant).length, 1, `Image coverage ${variant}: ${item.id}`);
        }
      }
      words += count;
    }
    console.log(`${chapter.id}: ${chapter.concepts.length} lecturas verificadas`);
  }
  assert.equal(seen.size, allConcepts.length);
  await assert.rejects(loadArticle('missing-chapter', 'missing-concept'));
  await assert.rejects(loadArticle(chapters[0].id, 'missing-concept'));
  console.log(`OK: ${seen.size} artículos, ${words} palabras, ${notes} notas, ${editoriallyReviewed} revisados editorialmente. Cobertura, citas, imágenes, plan y párrafos únicos correctos.`);
} finally {
  await server.close();
}
