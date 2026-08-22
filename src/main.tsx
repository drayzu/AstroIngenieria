import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

const root = createRoot(document.getElementById('root')!);

const isLabPath = (suffix: string) =>
  window.location.pathname.replace(/\/+$/, '').endsWith(suffix);

if (isLabPath('/disenos')) {
  void import('./designs/DesignLab').then(({ default: DesignLab }) => {
    root.render(
      <StrictMode>
        <DesignLab />
      </StrictMode>,
    );
  });
} else if (import.meta.env.DEV && isLabPath('/forja')) {
  void import('./forja/ForjaLab').then(({ default: ForjaLab }) => {
    root.render(
      <StrictMode>
        <ForjaLab />
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
