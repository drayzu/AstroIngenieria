import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './designs/museo-orbital/base.css';
import { initialLocale, LocaleProvider } from './i18n/LocaleProvider';

const root = createRoot(document.getElementById('root')!);

// Los laboratorios no tienen intro: retiran la pantalla de arranque al montar
const releaseBoot = () => document.getElementById('mo-boot')?.remove();

const isLabPath = (suffix: string) =>
  window.location.pathname.replace(/\/+$/, '').endsWith(suffix);

if (isLabPath('/disenos')) {
  if (import.meta.env.DEV) {
    void import('./designs/DesignLab').then(({ default: DesignLab }) => {
      root.render(
        <StrictMode>
          <DesignLab />
        </StrictMode>,
      );
      releaseBoot();
    });
  } else {
    void import('./designs/museo-orbital/MuseoOrbital').then(({ default: MuseoOrbital }) => {
      root.render(
        <StrictMode>
          <LocaleProvider><MuseoOrbital /></LocaleProvider>
        </StrictMode>,
      );
    });
  }
} else if (import.meta.env.DEV && isLabPath('/forja')) {
  void import('./forja/ForjaLab').then(({ default: ForjaLab }) => {
    root.render(
      <StrictMode>
        <ForjaLab />
      </StrictMode>,
    );
    releaseBoot();
  });
} else {
  // Reading in English: its catalog arrives alongside the museum
  void Promise.all([
    import('./designs/museo-orbital/MuseoOrbital'),
    import('./i18n/catalog').then(({ loadCatalog }) => loadCatalog(initialLocale())).catch(() => {}),
  ]).then(([{ default: MuseoOrbital }]) => {
    root.render(
      <StrictMode>
        <LocaleProvider><MuseoOrbital /></LocaleProvider>
      </StrictMode>,
    );
  });
}
