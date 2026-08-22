import '@fontsource-variable/fraunces';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import { Suspense, lazy, useEffect, useState } from 'react';
import './designLab.css';

const MuseoOrbital = lazy(() => import('./museo-orbital/MuseoOrbital'));
const HipervisionWebGL = lazy(() => import('./hipervision/HipervisionWebGL'));
const ObservatorioEditorial = lazy(() => import('./observatorio/ObservatorioEditorial'));

type TemplateId = 'museo' | 'hipervision' | 'observatorio';

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
    id: 'museo',
    num: '01',
    name: 'Museo Orbital',
    tagline: 'Exposición inmersiva',
    description:
      'El atlas como museo nocturno: salas monumentales, obras numeradas con placa, reveals tipográficos gigantes y un paseo cinematográfico de principio a fin.',
    mood: ['negro absoluto', 'serif monumental', 'scroll revelación'],
    swatch: ['#070707', '#f5f1e8', '#c9a86a'],
    preview: `${assetBase}illustrations/ai/concepts/habitats/immersive/oneill-cylinder.webp`,
  },
  {
    id: 'hipervision',
    num: '02',
    name: 'Hipervisión WebGL',
    tagline: 'Viaje estelar interactivo',
    description:
      'Cabina de navegación: campo estelar reactivo en canvas, saltos warp entre misiones y conceptos como constelación escaneable en pseudo-3D.',
    mood: ['canvas 3D', 'HUD flotante', 'warp entre misiones'],
    swatch: ['#03040a', '#7df9ff', '#ff5cf0'],
    preview: `${assetBase}illustrations/ai/energy.webp`,
  },
  {
    id: 'observatorio',
    num: '03',
    name: 'Observatorio Editorial',
    tagline: 'Revista científica premium',
    description:
      'Papel, tinta y grano: portada con masthead, reportajes asimétricos, capitulares, citas destacadas y fichas de catálogo con aire impreso.',
    mood: ['papel crema', 'serif editorial', 'grano de película'],
    swatch: ['#f6f1e7', '#17150f', '#8a2f1c'],
    preview: `${assetBase}illustrations/ai/planetary.webp`,
  },
];

export default function DesignLab() {
  const [active, setActive] = useState<TemplateId>('museo');
  const [indexOpen, setIndexOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '1') setActive('museo');
      else if (event.key === '2') setActive('hipervision');
      else if (event.key === '3') setActive('observatorio');
      else if (event.key === 'Escape') setIndexOpen(false);
      else if (event.key.toLocaleLowerCase('es') === 'i') setIndexOpen((open) => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeMeta = templates.find((template) => template.id === active) ?? templates[0];

  return (
    <div className="dl-root">
      <header className="dl-bar" aria-label="Laboratorio de diseño">
        <span className="dl-brand">
          ASTROINGENIERÍA <em>· LAB DE DISEÑO</em>
        </span>
        <nav className="dl-tabs" aria-label="Plantillas">
          {templates.map((template, index) => (
            <button
              key={template.id}
              type="button"
              className={active === template.id ? 'dl-tab is-active' : 'dl-tab'}
              onClick={() => setActive(template.id)}
            >
              <kbd>{index + 1}</kbd>
              {template.name}
            </button>
          ))}
        </nav>
        <div className="dl-actions">
          <button type="button" onClick={() => setIndexOpen(true)}>
            Índice <kbd>I</kbd>
          </button>
          <a href={import.meta.env.BASE_URL}>← Atlas</a>
        </div>
      </header>

      <main className="dl-stage">
        <Suspense fallback={<div className="dl-loading">CARGANDO PLANTILLA…</div>}>
          {active === 'museo' && <MuseoOrbital />}
          {active === 'hipervision' && <HipervisionWebGL />}
          {active === 'observatorio' && <ObservatorioEditorial />}
        </Suspense>
      </main>

      {indexOpen && (
        <div
          className="dl-index"
          role="dialog"
          aria-modal="true"
          aria-label="Índice de plantillas"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIndexOpen(false);
          }}
        >
          <div className="dl-index-panel">
            <header>
              <p className="dl-index-kicker">Laboratorio de diseño — Fase de exploración</p>
              <h2>Tres direcciones, un mismo atlas</h2>
              <p className="dl-index-note">
                Cada plantilla aplica su lenguaje visual completo a contenido real del atlas. Usa las
                teclas 1 · 2 · 3 para saltar entre ellas.
              </p>
            </header>
            <div className="dl-index-grid">
              {templates.map((template) => (
                <article key={template.id} className="dl-index-card">
                  <div className="dl-index-preview">
                    <img src={template.preview} alt="" loading="lazy" />
                    <span className="dl-index-num">{template.num}</span>
                  </div>
                  <div className="dl-index-body">
                    <h3>{template.name}</h3>
                    <p className="dl-index-tagline">{template.tagline}</p>
                    <p className="dl-index-desc">{template.description}</p>
                    <ul className="dl-index-mood">
                      {template.mood.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <div className="dl-index-foot">
                      <span className="dl-index-swatch">
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

      <footer className="dl-status">
        <span className="dl-status-dot" />
        ACTIVA — {activeMeta.name} · {activeMeta.tagline}
      </footer>
    </div>
  );
}
