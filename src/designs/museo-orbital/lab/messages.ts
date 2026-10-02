import { translate, type Locale } from '../../../i18n/messages';

// The simulation keeps canonical message keys; only presentation changes language.
export function translateLabHint(hint: string, locale: Locale): string {
  const undo = ' · Esc deshace este gesto.';
  if (hint.endsWith(undo)) return translate(hint.slice(0, -undo.length), locale) + translate(undo, locale);
  return translate(hint, locale);
}
