import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

const root = createRoot(document.getElementById('root')!);

const devPath = import.meta.env.DEV ? window.location.pathname.replace(/\/+$/, '') : '';

if (devPath.endsWith('/disenos')) {
  void import('./designs/DesignLab').then(({ default: DesignLab }) => {
    root.render(
      <StrictMode>
        <DesignLab />
      </StrictMode>,
    );
  });
} else if (devPath.endsWith('/forja')) {
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
