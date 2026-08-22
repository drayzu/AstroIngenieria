import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './designs/museo-orbital/base.css';

const root = createRoot(document.getElementById('root')!);

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
    });
  } else {
    void import('./designs/museo-orbital/MuseoOrbital').then(({ default: MuseoOrbital }) => {
      root.render(
        <StrictMode>
          <MuseoOrbital />
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
  });
} else {
  void import('./designs/museo-orbital/MuseoOrbital').then(({ default: MuseoOrbital }) => {
    root.render(
      <StrictMode>
        <MuseoOrbital />
      </StrictMode>,
    );
  });
}
