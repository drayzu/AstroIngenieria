import { Suspense, lazy, useEffect, useState } from 'react';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/space-grotesk';
import './forjaLab.css';

const ArchivoPlanos = lazy(() => import('./planos/ArchivoPlanos'));
const EscalaLogaritmica = lazy(() => import('./escala/EscalaLogaritmica'));
const Cronografia = lazy(() => import('./cronografia/Cronografia'));
const OrreriaSolar = lazy(() => import('./orreria/OrreriaSolar'));

type TemplateId = 'planos' | 'escala' | 'cronografia' | 'orreria';

interface TemplateMeta {
  id: TemplateId;
  num: string;
  name: string;
  tagline: string;
  description: string;
  mood: string[];
  swatch: [string, string, string];
  preview: string;
}

const assetBase = import.meta.env.BASE_URL;

const templates: TemplateMeta[] = [
  {
    id: 'planos',
    num: '01',
    name: 'Archivo de Planos',
    tagline: 'Ingeniería generativa',
    description:
      'Un motor generativo dibuja un plano técnico único para cada uno de los 106 conceptos: geometría derivada de sus datos, cotas, diales de métricas, sellos de plausibilidad y trazado animado línea a línea.',
    mood: ['blueprint cian', 'SVG generativo', 'trazo que se dibuja solo'],
    swatch: ['#0d1b2e', '#cfe8f5', '#e0a458'],
    preview: `${assetBase}illustrations/ai/infrastructure.webp`,
  },
  {
    id: 'escala',
    num: '02',
    name: 'Órdenes de Magnitud',
    tagline: 'Zoom logarítmico infinito',
    description:
      'La rueda del ratón se convierte en una nave: 27 órdenes de magnitud, de un metro al universo observable. Cada concepto vive a su escala real sobre una regla exponencial viva, con hitos cósmicos marcados.',
    mood: ['regla exponencial', 'viaje por el vacío', 'paralaje logarítmico'],
    swatch: ['#060913', '#f2f4f8', '#f9d66e'],
    preview: `${assetBase}illustrations/ai/intro.webp`,
  },
  {
    id: 'cronografia',
    num: '03',
    name: 'Cronografía',
    tagline: 'El futuro del universo en scroll',
    description:
      'Una máquina del tiempo: el scroll recorre 10¹⁰⁰ años de futuro cósmico. Los conceptos nacen como eventos en su época y se apagan al terminar su era, mientras el cielo envejece estrella a estrella.',
    mood: ['tiempo profundo', 'eventos que nacen y mueren', 'cielo que envejece'],
    swatch: ['#0a0510', '#e8e2f4', '#b48ce0'],
    preview: `${assetBase}illustrations/ai/complements.webp`,
  },
  {
    id: 'orreria',
    num: '04',
    name: 'Orrería Solar',
    tagline: 'El sistema solar como obra',
    description:
      'Cada concepto emplazado físicamente donde se construiría: ascensores anclados a la Tierra, enjambres Dyson alrededor del Sol, minería en el cinturón. Un scrubber construye el sistema por misiones y la cámara vuela hacia cada estructura.',
    mood: ['orrería 3D', 'obra en construcción', 'cámara que investiga'],
    swatch: ['#030711', '#dbe6f4', '#ffb35c'],
    preview: `${assetBase}illustrations/ai/stellar.webp`,
  },
];

export default function ForjaLab() {
  const [active, setActive] = useState<TemplateId>('planos');
  const [indexOpen, setIndexOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '1') setActive('planos');
      else if (event.key === '2') setActive('escala');
      else if (event.key === '3') setActive('cronografia');
      else if (event.key === '4') setActive('orreria');
      else if (event.key === 'Escape') setIndexOpen(false);
      else if (event.key.toLocaleLowerCase('es') === 'i') setIndexOpen((open) => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeMeta = templates.find((template) => template.id === active) ?? templates[0];

  return (
    <div className="fg-root">
      <header className="fg-bar" aria-label="La Forja — laboratorio de diseño">
        <span className="fg-brand">
          ASTROINGENIERÍA <em>· LA FORJA</em>
        </span>
        <nav className="fg-tabs" aria-label="Plantillas">
          {templates.map((template, index) => (
            <button
              key={template.id}
              type="button"
              className={active === template.id ? 'fg-tab is-active' : 'fg-tab'}
              onClick={() => setActive(template.id)}
            >
              <kbd>{index + 1}</kbd>
              {template.name}
            </button>
          ))}
        </nav>
        <div className="fg-actions">
          <button type="button" onClick={() => setIndexOpen(true)}>
            Índice <kbd>I</kbd>
          </button>
          <a href={import.meta.env.BASE_URL}>← Atlas</a>
        </div>
      </header>

      <main className="fg-stage">
        <Suspense fallback={<div className="fg-loading">FORJANDO PLANTILLA…</div>}>
          {active === 'planos' && <ArchivoPlanos />}
          {active === 'escala' && <EscalaLogaritmica />}
          {active === 'cronografia' && <Cronografia />}
          {active === 'orreria' && <OrreriaSolar />}
        </Suspense>
      </main>

      {indexOpen && (
        <div
          className="fg-index"
          role="dialog"
          aria-modal="true"
          aria-label="Índice de plantillas de La Forja"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIndexOpen(false);
          }}
        >
          <div className="fg-index-panel">
            <header>
              <p className="fg-index-kicker">La Forja — cuatro direcciones alternativas</p>
              <h2>Otros cuatro atlas, un mismo cosmos</h2>
              <p className="fg-index-note">
                Cuatro lenguajes visuales distintos aplicados al contenido real del atlas. Usa las
                teclas 1 · 2 · 3 · 4 para saltar entre ellos.
              </p>
            </header>
            <div className="fg-index-grid">
              {templates.map((template) => (
                <article key={template.id} className="fg-index-card">
                  <div className="fg-index-preview">
                    <img src={template.preview} alt="" loading="lazy" />
                    <span className="fg-index-num">{template.num}</span>
                  </div>
                  <div className="fg-index-body">
                    <h3>{template.name}</h3>
                    <p className="fg-index-tagline">{template.tagline}</p>
                    <p className="fg-index-desc">{template.description}</p>
                    <ul className="fg-index-mood">
                      {template.mood.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <div className="fg-index-foot">
                      <span className="fg-index-swatch">
                        {template.swatch.map((color) => (
                          <i key={color} style={{ background: color }} />
                        ))}
                      </span>
                      <button type="button" onClick={() => setActive(template.id)}>
                        Entrar →
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="fg-status">
        <span className="fg-status-dot" />
        FORJA ACTIVA — {activeMeta.name} · {activeMeta.tagline}
      </footer>
    </div>
  );
}
