import type { ConceptArticle } from './model';
import type { Locale } from '../../i18n/messages';

type ChapterArticles = { default: ConceptArticle[] };
const chapters = import.meta.glob<ChapterArticles>('./chapters/*.ts');
const englishChapters = import.meta.glob<ChapterArticles>('../../i18n/articles/en/*.ts');
const cache = new Map<string, Promise<ConceptArticle[]>>();

export async function loadArticle(chapterId: string, conceptId: string, locale: Locale = 'es'): Promise<ConceptArticle> {
  const load = locale === 'en' ? englishChapters[`../../i18n/articles/en/${chapterId}.ts`] : chapters[`./chapters/${chapterId}.ts`];
  if (!load) throw new Error(`Missing articles for ${chapterId}`);
  const cacheKey = `${locale}:${chapterId}`;
  let pending = cache.get(cacheKey);
  if (!pending) {
    pending = load().then(module => module.default).catch(error => {
      cache.delete(cacheKey);
      throw error;
    });
    cache.set(cacheKey, pending);
  }
  const result = (await pending).find(item => item.id === conceptId);
  if (!result) throw new Error(`Missing article ${conceptId}`);
  return result;
}
