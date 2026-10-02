import { useLocale } from './LocaleProvider';

export function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale();
  return <div className="mo-language-switch" role="group" aria-label={t('Idioma')}>
    {(['es', 'en'] as const).map(language => <button
      key={language} type="button" lang={language} aria-pressed={locale === language}
      aria-label={t(language === 'es' ? 'Cambiar a español' : 'Cambiar a inglés')}
      onClick={() => setLocale(language)} data-cursor-label={language === 'es' ? 'Español' : 'English'}
    >{language.toUpperCase()}</button>)}
  </div>;
}
