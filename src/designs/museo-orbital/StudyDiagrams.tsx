import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import './studyDiagrams.css';

/* Diagramas de las salas de estudio: algunos temas se entienden mejor
   viéndolos funcionar. Van entre la portada del tema y su lectura, como
   los paneles animados de un museo de ciencia.

   - I  · Motor de Shkadov: un espejo devuelve parte de la luz y la que
          escapa por el otro lado empuja a la estrella con sus planetas
   - II · Star lifting: campos magnéticos sacan plasma por los polos; la
          estrella pierde masa, se enfría y vive más
   - III· Proceso de Penrose: lo que se divide en la ergosfera de un agujero
          negro en rotación puede salir con más energía de la que trajo

   Todo se anima en el SVG (SMIL y CSS) y se pausa fuera de pantalla. */

const W = 1200;
const H = 440;

/* Línea de campo de un dipolo con el eje horizontal: r = L·sen²θ */
const fieldLine = (cx: number, cy: number, reach: number, side: 1 | -1) => {
  const points: string[] = [];
  for (let step = 0; step <= 40; step++) {
    const theta = 0.16 + (step / 40) * (Math.PI - 0.32);
    const r = reach * Math.sin(theta) ** 2;
    points.push(`${(cx + r * Math.cos(theta)).toFixed(1)},${(cy - side * r * Math.sin(theta)).toFixed(1)}`);
  }
  return `M${points.join(' L')}`;
};

const polar = (cx: number, cy: number, r: number, degrees: number) => {
  const angle = (degrees * Math.PI) / 180;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
};

const Label = ({ x, y, children, anchor = 'start' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) => (
  <text className="sa-label" x={x} y={y} textAnchor={anchor}>{children}</text>
);

/* ---------------- I · Motor de Shkadov ---------------- */

const ShkadovDiagram = ({ t }: { t: (key: string) => string }) => {
  const cx = 600;
  const cy = 220;
  const escaping = Array.from({ length: 9 }, (_, index) => 180 - 44 + index * 11);
  const reflected = Array.from({ length: 7 }, (_, index) => -48 + index * 16);
  const mirrorFrom = polar(cx, cy, 96, -62);
  const mirrorTo = polar(cx, cy, 96, 62);
  const outerFrom = polar(cx, cy, 102, -60);
  const outerTo = polar(cx, cy, 102, 60);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Motor de Shkadov')}>
      <defs>
        <radialGradient id="sa1-glow">
          <stop offset="0%" stopColor="#ffd9a8" stopOpacity="0.55" />
          <stop offset="35%" stopColor="#ff7a59" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ff7a59" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sa1-star" cx="45%" cy="42%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="45%" stopColor="#ffe3b4" />
          <stop offset="82%" stopColor="#ffa266" />
          <stop offset="100%" stopColor="#ff7a59" />
        </radialGradient>
        <linearGradient id="sa1-mirror" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8d6e8" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c8d6e8" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id="sa1-fade-g">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <mask id="sa1-fade" maskUnits="userSpaceOnUse" x={cx - 380} y={cy - 380} width="760" height="760">
          <circle cx={cx} cy={cy} r="360" fill="url(#sa1-fade-g)" />
        </mask>
      </defs>

      {/* Recorrido: la estela que deja y la escala del viaje */}
      <line className="sa-scale" x1="120" y1="398" x2="1080" y2="398" />
      {Array.from({ length: 9 }, (_, index) => (
        <line key={index} className="sa-scale" x1={120 + index * 120} y1="392" x2={120 + index * 120} y2="404" />
      ))}
      <Label x={120} y={428}>{t('Viaje lento: millones de años')}</Label>
      <line className="sa-trail" x1="340" y1={cy} x2="340" y2={cy}>
        <animate attributeName="x2" values="340;860;860" keyTimes="0;0.88;1" dur="16s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.9;1" dur="16s" repeatCount="indefinite" />
      </line>

      <g>
        <animateTransform attributeName="transform" type="translate" values="-260 0;260 0;260 0" keyTimes="0;0.88;1" dur="16s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.9;1" dur="16s" repeatCount="indefinite" />

        <circle cx={cx} cy={cy} r="170" fill="url(#sa1-glow)" />

        {/* Luz que escapa por el lado abierto: es la que empuja */}
        <g mask="url(#sa1-fade)">
          {escaping.map((degrees) => {
            const from = polar(cx, cy, 58, degrees);
            const to = polar(cx, cy, 360, degrees);
            return <line key={degrees} className="sa-ray sa-flow" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
          })}
        </g>

        {/* Luz que el espejo devuelve hacia la estrella */}
        {reflected.map((degrees) => {
          const from = polar(cx, cy, 90, degrees);
          const to = polar(cx, cy, 58, degrees);
          return <line key={degrees} className="sa-ray is-short sa-flow" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
        })}

        {/* Planetas: viajan con su estrella */}
        <ellipse className="sa-orbit" cx={cx} cy={cy} rx="160" ry="36" />
        <ellipse className="sa-orbit" cx={cx} cy={cy} rx="226" ry="52" />
        <circle r="4.5" className="sa-planet">
          <animateMotion dur="7s" repeatCount="indefinite" path={`M${cx + 160},${cy} A160,36 0 1,1 ${cx - 160},${cy} A160,36 0 1,1 ${cx + 160},${cy}`} />
        </circle>
        <circle r="6" className="sa-planet is-far">
          <animateMotion dur="12s" repeatCount="indefinite" path={`M${cx - 226},${cy} A226,52 0 1,1 ${cx + 226},${cy} A226,52 0 1,1 ${cx - 226},${cy}`} />
        </circle>

        <circle cx={cx} cy={cy} r="52" fill="url(#sa1-star)" />

        {/* Espejo: un casquete que flota en equilibrio entre gravedad y luz */}
        <path className="sa-mirror" d={`M${mirrorFrom.x},${mirrorFrom.y} A96,96 0 0,1 ${mirrorTo.x},${mirrorTo.y}`} stroke="url(#sa1-mirror)" />
        <path className="sa-frame" d={`M${outerFrom.x},${outerFrom.y} A102,102 0 0,1 ${outerTo.x},${outerTo.y}`} />

        {/* Hacia dónde va */}
        <line className="sa-arrow" x1={cx + 128} y1={cy} x2={cx + 196} y2={cy} />
        <path className="sa-arrow-head" d={`M${cx + 196},${cy - 7} L${cx + 210},${cy} L${cx + 196},${cy + 7} Z`} />

        <line className="sa-leader" x1={mirrorFrom.x + 6} y1={mirrorFrom.y + 2} x2={cx + 74} y2={cy - 128} />
        <Label x={cx + 78} y={cy - 132}>{t('Espejo')}</Label>
        <Label x={cx + 132} y={cy - 14}>{t('Movimiento')}</Label>
        <Label x={cx - 196} y={cy - 92} anchor="end">{t('Luz que escapa')}</Label>
      </g>
    </svg>
  );
};

/* ---------------- II · Star lifting ---------------- */

const LiftingDiagram = ({ t }: { t: (key: string) => string }) => {
  const cx = 600;
  const cy = 210;
  const lines = useMemo(() => [100, 150, 205].flatMap((reach) => [fieldLine(cx, cy, reach, 1), fieldLine(cx, cy, reach, -1)]), []);
  const jets = [
    { path: `M${cx + 50},${cy} L${1040},${cy}`, cone: `${cx + 48},${cy - 7} ${1040},${cy - 22} ${1040},${cy + 22} ${cx + 48},${cy + 7}` },
    { path: `M${cx - 50},${cy} L${160},${cy}`, cone: `${cx - 48},${cy - 7} ${160},${cy - 22} ${160},${cy + 22} ${cx - 48},${cy + 7}` },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Star lifting')}>
      <defs>
        <radialGradient id="sa2-glow">
          <stop offset="0%" stopColor="#ffd2a0" stopOpacity="0.5">
            <animate attributeName="stop-color" values="#ffd2a0;#ff8a5c;#ff8a5c;#ffd2a0" keyTimes="0;0.8;0.94;1" dur="14s" repeatCount="indefinite" />
          </stop>
          <stop offset="40%" stopColor="#ff7a59" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ff7a59" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sa2-star" cx="45%" cy="42%">
          <stop offset="0%" stopColor="#fffaf0">
            <animate attributeName="stop-color" values="#fffaf0;#ffd8b0;#ffd8b0;#fffaf0" keyTimes="0;0.8;0.94;1" dur="14s" repeatCount="indefinite" />
          </stop>
          <stop offset="50%" stopColor="#ffe0ae">
            <animate attributeName="stop-color" values="#ffe0ae;#ff9a62;#ff9a62;#ffe0ae" keyTimes="0;0.8;0.94;1" dur="14s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#ff8a5c">
            <animate attributeName="stop-color" values="#ff8a5c;#d9442c;#d9442c;#ff8a5c" keyTimes="0;0.8;0.94;1" dur="14s" repeatCount="indefinite" />
          </stop>
        </radialGradient>
        <linearGradient id="sa2-jet-r" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffd2a0" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff7a59" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="sa2-jet-l" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#ffd2a0" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff7a59" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      <circle cx={cx} cy={cy} r="180" fill="url(#sa2-glow)" />
      {lines.map((d, index) => <path key={index} className="sa-field" d={d} />)}

      {/* Chorros por los polos hasta los colectores */}
      {jets.map((jet, index) => (
        <g key={index}>
          <polygon points={jet.cone} fill={`url(#sa2-jet-${index === 0 ? 'r' : 'l'})`} />
          {Array.from({ length: 6 }, (_, particle) => (
            <circle key={particle} r={2.6 - (particle % 3) * 0.5} className="sa-plasma">
              <animateMotion dur="2.4s" begin={`${-particle * 0.4}s`} repeatCount="indefinite" path={jet.path} />
            </circle>
          ))}
        </g>
      ))}
      {[1060, 140].map((x) => (
        <g key={x} className="sa-collector">
          <circle cx={x} cy={cy} r="24" />
          <circle cx={x} cy={cy} r="9" />
          <line x1={x} y1={cy - 34} x2={x} y2={cy - 24} />
          <line x1={x} y1={cy + 24} x2={x} y2={cy + 34} />
        </g>
      ))}

      {/* Anillo de corriente en el ecuador: detrás de la estrella y delante */}
      <ellipse className="sa-ring is-back sa-flow" cx={cx} cy={cy} rx="16" ry="84" />
      <circle cx={cx} cy={cy} r="52" fill="url(#sa2-star)">
        <animate attributeName="r" values="52;41;41;52" keyTimes="0;0.8;0.94;1" dur="14s" repeatCount="indefinite" />
      </circle>
      <path className="sa-ring sa-flow" d={`M${cx},${cy - 84} A16,84 0 0,0 ${cx},${cy + 84}`} />

      <Label x={1060} y={cy + 62} anchor="middle">{t('Colector')}</Label>
      <Label x={140} y={cy + 62} anchor="middle">{t('Colector')}</Label>
      <Label x={cx + 30} y={cy - 98}>{t('Anillo de corriente')}</Label>
      <Label x={cx + 210} y={cy - 18}>{t('Plasma')}</Label>

      {/* Masa que se va y vida que se gana */}
      <g className="sa-gauges">
        <Label x={120} y={378}>{t('Masa')}</Label>
        <rect className="sa-gauge-track" x="250" y="368" width="300" height="6" rx="3" />
        <rect className="sa-gauge is-mass" x="250" y="368" width="300" height="6" rx="3">
          <animate attributeName="width" values="300;240;240;300" keyTimes="0;0.8;0.94;1" dur="14s" repeatCount="indefinite" />
        </rect>
        <Label x={120} y={410}>{t('Vida útil')}</Label>
        <rect className="sa-gauge-track" x="250" y="400" width="300" height="6" rx="3" />
        <rect className="sa-gauge is-life" x="250" y="400" width="150" height="6" rx="3">
          <animate attributeName="width" values="150;300;300;150" keyTimes="0;0.8;0.94;1" dur="14s" repeatCount="indefinite" />
        </rect>
      </g>
    </svg>
  );
};

/* ---------------- III · Proceso de Penrose ---------------- */

const PenroseDiagram = ({ t }: { t: (key: string) => string }) => {
  const cx = 600;
  const cy = 214;
  const split = { x: 654, y: 180 };
  const incoming = `M1190,62 C980,52 770,118 ${split.x},${split.y}`;
  const falling = `M${split.x},${split.y} C632,204 596,236 580,222 S592,204 ${cx},${cy}`;
  const escaping = `M${split.x},${split.y} C712,142 540,96 420,112 S130,58 10,34`;
  // Estelas finas sobre el disco: las interiores giran más rápido
  const streaks = [
    { rx: 92, ry: 14, speed: '1.4s' },
    { rx: 122, ry: 18.5, speed: '2.2s' },
    { rx: 156, ry: 24, speed: '3.2s' },
    { rx: 192, ry: 29.5, speed: '4.4s' },
  ];
  const ringPath = (rx: number, ry: number, half: 'back' | 'front') => half === 'back'
    ? `M${cx - rx},${cy} A${rx},${ry} 0 0,1 ${cx + rx},${cy}`
    : `M${cx + rx},${cy} A${rx},${ry} 0 0,1 ${cx - rx},${cy}`;
  const disk = (half: 'back' | 'front') => (
    <g transform={`rotate(-7 ${cx} ${cy})`} mask="url(#sa3-beam)">
      <g clipPath={`url(#sa3-${half})`}>
        <ellipse cx={cx} cy={cy} rx="236" ry="36" fill="url(#sa3-disk)" filter="url(#sa3-soft)" />
        {streaks.map((streak) => (
          <path key={streak.rx} className="sa-disk-streak sa-spin" d={ringPath(streak.rx, streak.ry, half)}
            style={{ animationDuration: streak.speed }} />
        ))}
      </g>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Proceso de Penrose')}>
      <defs>
        {/* Efecto Doppler: el lado que se acerca brilla más */}
        <linearGradient id="sa3-doppler" gradientUnits="userSpaceOnUse" x1={cx - 230} y1="0" x2={cx + 230} y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.28" />
        </linearGradient>
        <mask id="sa3-beam" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect width={W} height={H} fill="url(#sa3-doppler)" />
        </mask>
        {/* Disco de acreción: caliente y blanco por dentro, rojo y tenue por fuera */}
        <radialGradient id="sa3-disk">
          <stop offset="30%" stopColor="#fff4dc" stopOpacity="0" />
          <stop offset="36%" stopColor="#fff4dc" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#ffc68a" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#ff8a5c" stopOpacity="0.55" />
          <stop offset="88%" stopColor="#d9442c" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#d9442c" stopOpacity="0" />
        </radialGradient>
        <filter id="sa3-soft" x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <clipPath id="sa3-back"><rect x="0" y="0" width={W} height={cy} /></clipPath>
        <clipPath id="sa3-front"><rect x="0" y={cy} width={W} height={H - cy} /></clipPath>
        <radialGradient id="sa3-glow">
          <stop offset="55%" stopColor="#ff7a59" stopOpacity="0" />
          <stop offset="70%" stopColor="#ff9a62" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ff7a59" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r="150" fill="url(#sa3-glow)" />

      {/* Mitad trasera del disco, detrás del horizonte */}
      {disk('back')}

      {/* Imagen curvada del disco por encima y por debajo del horizonte */}
      <path className="sa-lensed" d={`M${cx - 74},${cy + 4} A74,70 0 0,1 ${cx + 74},${cy + 4}`} />
      <path className="sa-lensed is-thin" d={`M${cx - 62},${cy + 6} A62,40 0 0,0 ${cx + 62},${cy + 6}`} />

      <circle cx={cx} cy={cy} r="56" className="sa-horizon" />
      <circle cx={cx} cy={cy} r="58.5" className="sa-photon" />

      {disk('front')}

      <ellipse className="sa-ergo" cx={cx} cy={cy} rx="80" ry="72" />

      {/* Lo que entra, se divide y sale */}
      <path className="sa-path" d={incoming} />
      <path className="sa-path" d={escaping} />
      <path className="sa-streak is-in" d={incoming} pathLength={1}>
        <animate attributeName="stroke-dashoffset" values="0.3;-1;-1" keyTimes="0;0.42;1" dur="7s" repeatCount="indefinite" />
      </path>
      <path className="sa-streak is-out" d={escaping} pathLength={1}>
        <animate attributeName="stroke-dashoffset" values="0.3;0.3;-1;-1" keyTimes="0;0.42;0.66;1" dur="7s" repeatCount="indefinite" />
      </path>
      <circle r="4" className="sa-body">
        <animateMotion dur="7s" repeatCount="indefinite" path={incoming} keyPoints="0;1;1" keyTimes="0;0.42;1" calcMode="linear" />
        <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.05;0.41;0.42;1" dur="7s" repeatCount="indefinite" />
      </circle>
      <circle r="3" className="sa-body is-falling">
        <animateMotion dur="7s" repeatCount="indefinite" path={falling} keyPoints="0;0;1;1" keyTimes="0;0.42;0.6;1" calcMode="linear" />
        <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.42;0.43;0.6;1" dur="7s" repeatCount="indefinite" />
      </circle>
      <circle r="5.5" className="sa-body is-out">
        <animateMotion dur="7s" repeatCount="indefinite" path={escaping} keyPoints="0;0;1;1" keyTimes="0;0.42;0.66;1" calcMode="linear" />
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.42;0.43;0.62;0.66;1" dur="7s" repeatCount="indefinite" />
      </circle>
      <circle cx={split.x} cy={split.y} r="2" className="sa-split">
        <animate attributeName="r" values="2;2;22;22" keyTimes="0;0.42;0.5;1" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;0.9;0;0" keyTimes="0;0.415;0.425;0.5;1" dur="7s" repeatCount="indefinite" />
      </circle>

      <Label x={1010} y={44}>{t('Entra')}</Label>
      <Label x={120} y={30}>{t('Sale con más energía')}</Label>
      <line className="sa-leader" x1={cx + 62} y1={cy + 52} x2={cx + 120} y2={cy + 112} />
      <Label x={cx + 124} y={cy + 122}>{t('Ergosfera')}</Label>
      <line className="sa-leader" x1={cx - 30} y1={cy + 30} x2={cx - 120} y2={cy + 118} />
      <Label x={cx - 124} y={cy + 128} anchor="end">{t('Horizonte de sucesos')}</Label>
    </svg>
  );
};

/* ---------------- Lámina ---------------- */

const SHKADOV = {
  title: 'Motor de Shkadov',
  text: 'Un espejo gigante devuelve parte de la luz de la estrella. La que escapa por el otro lado la empuja, y la estrella viaja con sus planetas durante millones de años.',
  Diagram: ShkadovDiagram,
};
const LIFTING = {
  title: 'Star lifting',
  text: 'Campos magnéticos arrancan plasma por los polos. Con menos masa, la estrella arde más despacio y vive más: su evolución se vuelve gestionable.',
  Diagram: LiftingDiagram,
};
const PENROSE = {
  title: 'Proceso de Penrose',
  text: 'Un objeto que entra en la ergosfera de un agujero negro en rotación puede dividirse: una parte cae y la otra sale con más energía de la que trajo.',
  Diagram: PenroseDiagram,
};

/* Qué diagrama acompaña a cada tema */
const DIAGRAMS: Record<string, typeof SHKADOV> = {
  'stellar-engines': SHKADOV,
  shkadov: SHKADOV,
  'star-lifting': LIFTING,
  'stellar-husbandry': LIFTING,
  'black-hole-engineering': PENROSE,
};

export const StudyDiagram = memo(({ conceptId }: { conceptId: string }) => {
  const { t } = useLocale();
  const rootRef = useRef<HTMLElement>(null);
  const entry = DIAGRAMS[conceptId];

  // Fuera de la vista las animaciones SMIL y CSS se detienen
  useEffect(() => {
    const root = rootRef.current;
    const svg = root?.querySelector('svg');
    if (!root || !svg) return;
    const observer = new IntersectionObserver(([item]) => {
      root.classList.toggle('is-live', item.isIntersecting);
      if (item.isIntersecting) svg.unpauseAnimations();
      else svg.pauseAnimations();
    }, { rootMargin: '120px 0px' });
    observer.observe(root);
    return () => observer.disconnect();
  }, [conceptId]);

  if (!entry) return null;
  const { Diagram } = entry;
  return (
    <figure className="mo-study-diagram" ref={rootRef}>
      <p className="mo-kicker">{t('Cómo funciona')}</p>
      <Diagram t={t} />
      <figcaption>
        <strong>{t(entry.title)}</strong>
        {t(entry.text)}
      </figcaption>
    </figure>
  );
});
