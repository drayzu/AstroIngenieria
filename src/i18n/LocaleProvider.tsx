import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { translate, type Locale } from './messages';

export const LOCALE_KEY = 'mo-locale';
const LocaleContext = createContext({ locale: 'es' as Locale, setLocale: (_locale: Locale) => {}, t: (message: string, ...values: (string | number)[]) => translate(message, 'es', ...values) });

function initialLocale(): Locale {
  try { return localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'es'; }
  catch { return 'es'; }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const value = useMemo(() => ({
    locale,
    t: (message: string, ...values: (string | number)[]) => translate(message, locale, ...values),
    setLocale: (next: Locale) => {
      if (next === locale) return;
      window.dispatchEvent(new CustomEvent('mo-locale-before-change'));
      window.dispatchEvent(new CustomEvent('mo-cursor-reset'));
      updateLocale(next);
      try { localStorage.setItem(LOCALE_KEY, next); } catch { /* Keep the choice in memory. */ }
    },
  }), [locale]);
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'en' ? 'Astroengineering — Orbital Museum' : 'Astroingeniería — Museo Orbital';
    document.querySelector('meta[name="description"]')?.setAttribute('content', locale === 'en'
      ? 'Orbital Museum: an interactive permanent exhibition of astroengineering. Nine rooms exploring space habitats, megastructures, stellar energy and cosmic civilizations.'
      : 'Museo Orbital: exposición permanente interactiva de astroingeniería. Nueve salas con hábitats espaciales, megaestructuras, energía estelar y civilizaciones cósmicas.');
  }, [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
