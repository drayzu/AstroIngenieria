import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { chapters, conceptById, plausibilityLabels, scaleLabels } from '../../data/astroData';
import type { AstroChapter, AstroConcept, Plausibility } from '../../types';
import { seededUnit } from '../shared/conceptImages';
import './hipervision.css';

const StarFieldScene = lazy(() => import('./StarFieldScene'));

const plausibilityColors: Record<Plausibility, string> = {
  actual: '#4ade80',
  plausible: '#7df9ff',
  frontera: '#ffd27a',
  especulativo: '#ff5cf0',
};

interface ScanNode {
  concept: AstroConcept;
  x: number;
  y: number;
  z: number;
}

interface WarpTimer {
  swap?: number;
  end?: number;
}

/* ---------------- Telemetría ---------------- */

const Telemetry = ({ warping }: { warping: boolean }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 140);
    return () => window.clearInterval(id);
  }, []);

  const ra = 14 + Math.sin(tick / 22) * 6.5;
  const dec = -32 + Math.cos(tick / 17) * 11;
  const velocity = warping
    ? 2.4e5 * (0.8 + Math.random() * 0.35)
    : 17400 + Math.sin(tick / 9) * 320;

  return (
    <div className="hv-telemetry" aria-hidden="true">
      <span>
        RA <b>{ra.toFixed(3)}h</b>
      </span>
      <span>
        DEC <b>{dec >= 0 ? '+' : ''}{dec.toFixed(2)}°</b>
      </span>
      <span className="hv-telemetry-vel">
        VEL <b>{velocity >= 1e5 ? `${(velocity / 1e3).toFixed(1)}k c` : `${velocity.toFixed(0)} km/s`}</b>
      </span>
    </div>
  );
};

/* ---------------- Panel de misión ---------------- */

const PlausibilityProfile = ({ concepts }: { concepts: AstroConcept[] }) => (
  <div className="hv-profile">
    <span className="hv-profile-label">Perfil de la flota</span>
    <div className="hv-profile-bar">
      {(Object.keys(plausibilityLabels) as Plausibility[]).map((key) => {
        const count = concepts.filter((concept) => concept.plausibility === key).length;
        if (count === 0) return null;
        return (
          <i
            key={key}
            style={{
              flexGrow: count,
              background: plausibilityColors[key],
            }}
            title={`${plausibilityLabels[key]}: ${count}`}
          />
        );
      })}
    </div>
    <div className="hv-profile-legend">
      {(Object.keys(plausibilityLabels) as Plausibility[]).map((key) => (
        <span key={key}>
          <i style={{ background: plausibilityColors[key] }} />
          {plausibilityLabels[key]}
        </span>
      ))}
    </div>
  </div>
);

const MissionPanel = ({ concept }: { concept: AstroChapter }) => (
  <motion.div
    key={concept.id}
    className="hv-mission"
    initial={{ opacity: 0, x: -34, filter: 'blur(10px)' }}
    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
    exit={{ opacity: 0, x: 26, filter: 'blur(10px)' }}
    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
  >
    <p className="hv-kicker">
      DESTINO {concept.number} · {concept.concepts.length} PUNTOS DE INTERÉS
    </p>
    <h1 className="hv-title">{concept.title}</h1>
    <p className="hv-summary">{concept.summary}</p>

    <div className="hv-stats">
      <div className="hv-stat">
        <b>{String(concept.number).padStart(2, '0')}</b>
        <span>Sector</span>
      </div>
      <div className="hv-stat">
        <b>{scaleLabels[concept.scale]}</b>
        <span>Escala</span>
      </div>
      <div className="hv-stat">
        <b>{concept.concepts.length}</b>
        <span>Conceptos</span>
      </div>
    </div>

    <PlausibilityProfile concepts={concept.concepts} />

    <p className="hv-focus">{concept.visual?.visualFocus}</p>
  </motion.div>
);

/* ---------------- Ruta ---------------- */

const RouteBar = ({
  activeIndex,
  onSelect,
}: {
  activeIndex: number;
  onSelect: (index: number) => void;
}) => (
  <nav className="hv-route" aria-label="Ruta de misiones">
    <div className="hv-route-line">
      <motion.i
        animate={{ scaleX: activeIndex / (chapters.length - 1) }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
    <ol>
      {chapters.map((chapter, index) => (
        <li key={chapter.id}>
          <button
            type="button"
            className={`hv-waypoint${index === activeIndex ? ' is-active' : ''}`}
            onClick={() => onSelect(index)}
          >
            <i />
            <span>
              <b>{chapter.number}</b>
              {chapter.title}
            </span>
          </button>
        </li>
      ))}
    </ol>
  </nav>
);

/* ---------------- Constelación ---------------- */

const ScanLayer = ({
  chapter,
  selectedId,
  onSelect,
  onClose,
}: {
  chapter: AstroChapter;
  selectedId: string | null;
  onSelect: (concept: AstroConcept) => void;
  onClose: () => void;
}) => {
  const nodes = useMemo<ScanNode[]>(() => {
    return chapter.concepts.map((concept, index) => {
      const angle = index * 2.399963;
      const radius = 12 + Math.sqrt(index + 1) * 12;
      return {
        concept,
        x: Math.min(90, Math.max(10, 50 + Math.cos(angle) * radius * 1.32)),
        y: Math.min(84, Math.max(14, 47 + Math.sin(angle) * radius * 0.82)),
        z: (seededUnit(concept.id) - 0.5) * 230,
      };
    });
  }, [chapter]);

  const handleMove = (event: ReactMouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    event.currentTarget.style.setProperty('--mx', px.toFixed(3));
    event.currentTarget.style.setProperty('--my', py.toFixed(3));
  };

  return (
    <motion.div
      className="hv-scan"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      onMouseMove={handleMove}
    >
      <header className="hv-scan-head">
        <div>
          <p className="hv-kicker">BARRIDO PROFUNDO — SECTOR {chapter.number}</p>
          <h2>{chapter.title}</h2>
        </div>
        <button type="button" className="hv-btn ghost" onClick={onClose}>
          ✕ Cerrar barrido
        </button>
      </header>

      <div className="hv-space" aria-label={`Constelación de conceptos: ${chapter.title}`}>
        <svg className="hv-space-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {nodes.slice(0, -1).map((node, index) => (
            <line
              key={`link-${node.concept.id}`}
              x1={node.x}
              y1={node.y}
              x2={nodes[index + 1].x}
              y2={nodes[index + 1].y}
            />
          ))}
          {nodes.map((node) => (
            <line key={`hub-${node.concept.id}`} x1={50} y1={47} x2={node.x} y2={node.y} />
          ))}
        </svg>

        <div className="hv-hub" aria-hidden="true">
          <span>{chapter.number}</span>
        </div>

        {nodes.map((node) => (
          <button
            key={node.concept.id}
            type="button"
            className={`hv-node${selectedId === node.concept.id ? ' is-selected' : ''}`}
            style={
              {
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: `translate(-50%, -50%) translateZ(${node.z}px)`,
                '--delay': `${(seededUnit(node.concept.id) * 4).toFixed(2)}s`,
              } as CSSProperties
            }
            onClick={() => onSelect(node.concept)}
          >
            <i />
            <span>{node.concept.title}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

/* ---------------- Ficha concepto ---------------- */

const ConceptSheet = ({
  concept,
  onClose,
  onSelect,
}: {
  concept: AstroConcept;
  onClose: () => void;
  onSelect: (concept: AstroConcept) => void;
}) => {
  const related = concept.related
    .map((id) => conceptById.get(id))
    .filter((item): item is AstroConcept => Boolean(item));

  return (
    <motion.aside
      className="hv-sheet"
      role="dialog"
      aria-label={concept.title}
      initial={{ x: '108%' }}
      animate={{ x: 0 }}
      exit={{ x: '108%' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="hv-sheet-media">
        <img src={concept.illustration.src} alt={concept.illustration.alt} />
        <button type="button" onClick={onClose} aria-label="Cerrar ficha">
          ✕
        </button>
      </div>

      <div className="hv-sheet-body">
        <p className="hv-kicker">{concept.category.toUpperCase()}</p>
        <h3>{concept.title}</h3>
        <blockquote>“{concept.keyIdea}”</blockquote>
        <p className="hv-sheet-text">{concept.mechanism}</p>

        <div className="hv-meters">
          {(
            [
              ['Energía', concept.metrics.energia],
              ['Materiales', concept.metrics.materiales],
              ['Madurez', concept.metrics.madurez],
              ['Maravilla', concept.metrics.maravilla],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="hv-meter-row">
              <span>{label}</span>
              <div className="hv-meter">
                <motion.i
                  initial={{ width: 0 }}
                  animate={{ width: `${(value / 5) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: plausibilityColors[concept.plausibility] }}
                />
              </div>
              <b>{value}/5</b>
            </div>
          ))}
        </div>

        {related.length > 0 && (
          <div className="hv-related">
            <span>Nodos cercanos</span>
            <div>
              {related.slice(0, 3).map((item) => (
                <button key={item.id} type="button" onClick={() => onSelect(item)}>
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  );
};

/* ---------------- Principal ---------------- */

export default function HipervisionWebGL() {
  const reduced = useReducedMotion();
  const warpSignal = useRef(0);
  const timers = useRef<WarpTimer>({});
  const [chapterIndex, setChapterIndex] = useState(2);
  const [warping, setWarping] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [selected, setSelected] = useState<AstroConcept | null>(null);
  const [tour, setTour] = useState(false);

  const chapter = chapters[chapterIndex];

  const clearTimers = () => {
    if (timers.current.swap) window.clearTimeout(timers.current.swap);
    if (timers.current.end) window.clearTimeout(timers.current.end);
  };

  useEffect(() => clearTimers, []);

  const jumpTo = useCallback(
    (nextIndex: number) => {
      if (nextIndex === chapterIndex || nextIndex < 0 || nextIndex >= chapters.length) return;
      setSelected(null);
      setScanOpen(false);
      clearTimers();

      if (reduced) {
        setChapterIndex(nextIndex);
        return;
      }

      warpSignal.current = performance.now();
      setWarping(true);
      timers.current.swap = window.setTimeout(() => setChapterIndex(nextIndex), 340);
      timers.current.end = window.setTimeout(() => setWarping(false), 1050);
    },
    [chapterIndex, reduced, warpSignal],
  );

  useEffect(() => {
    if (!tour) return;
    const id = window.setInterval(() => {
      jumpTo((chapterIndex + 1) % chapters.length);
    }, 6800);
    return () => window.clearInterval(id);
  }, [tour, chapterIndex, jumpTo]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selected) setSelected(null);
        else if (scanOpen) setScanOpen(false);
        return;
      }
      if (event.key === 'ArrowRight') {
        setTour(false);
        jumpTo((chapterIndex + 1) % chapters.length);
      } else if (event.key === 'ArrowLeft') {
        setTour(false);
        jumpTo((chapterIndex - 1 + chapters.length) % chapters.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chapterIndex, jumpTo, scanOpen, selected]);

  const selectFromScan = (concept: AstroConcept) => {
    if (selected?.id === concept.id) return;
    setSelected(concept);
  };

  const navigateRelated = (concept: AstroConcept) => {
    if (concept.chapterId !== chapter.id) {
      const targetIndex = chapters.findIndex((item) => item.id === concept.chapterId);
      if (targetIndex >= 0) {
        setTour(false);
        setSelected(null);
        jumpTo(targetIndex);
        window.setTimeout(() => setSelected(concept), reduced ? 60 : 1150);
        return;
      }
    }
    setSelected(concept);
  };

  const hologramTilt = (event: ReactMouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    event.currentTarget.style.setProperty('--rx', `${(-py * 6).toFixed(2)}deg`);
    event.currentTarget.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`);
  };

  const hologramReset = (event: ReactMouseEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--rx', '0deg');
    event.currentTarget.style.setProperty('--ry', '0deg');
  };

  return (
    <div className={`hv-root${warping ? ' is-warping' : ''}`}>
      <Suspense fallback={<div className=" hv-canvas-fallback" />}>
        <StarFieldScene warpSignal={warpSignal} />
      </Suspense>
      <div className="hv-vignette" aria-hidden="true" />
      <div className="hv-gridlines" aria-hidden="true" />

      <div className="hv-corner tl" aria-hidden="true" />
      <div className="hv-corner tr" aria-hidden="true" />
      <div className="hv-corner bl" aria-hidden="true" />
      <div className="hv-corner br" aria-hidden="true" />

      <header className="hv-topbar">
        <span className="hv-brand">
          HIPERVISIÓN <em>NAVEGACIÓN DEL ATLAS</em>
        </span>
        <Telemetry warping={warping} />
      </header>

      <main className="hv-stage">
        <AnimatePresence mode="wait">
          {!scanOpen ? (
            <div className="hv-columns" key="columns">
              <MissionPanel concept={chapter} />

              <figure
                className="hv-hologram"
                onMouseMove={hologramTilt}
                onMouseLeave={hologramReset}
              >
                <img src={chapter.visual?.heroImage} alt={chapter.visual?.visualFocus ?? chapter.title} />
                <figcaption>{chapter.visual?.missionLabel}</figcaption>
              </figure>
            </div>
          ) : (
            <ScanLayer
              key="scan"
              chapter={chapter}
              selectedId={selected?.id ?? null}
              onSelect={selectFromScan}
              onClose={() => setScanOpen(false)}
            />
          )}
        </AnimatePresence>
      </main>

      <footer className="hv-bottom">
        <RouteBar
          activeIndex={chapterIndex}
          onSelect={(index) => {
            setTour(false);
            jumpTo(index);
          }}
        />
        <div className="hv-controls">
          <button type="button" className="hv-btn primary" onClick={() => setScanOpen((open) => !open)}>
            {scanOpen ? '← Vista de destino' : 'Escanear conceptos'}
          </button>
          <button
            type="button"
            className={`hv-btn${tour ? ' active' : ''}`}
            onClick={() => setTour((value) => !value)}
          >
            {tour ? '● Tour en curso' : 'Modo tour'}
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {selected && (
          <ConceptSheet
            concept={selected}
            onClose={() => setSelected(null)}
            onSelect={navigateRelated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
