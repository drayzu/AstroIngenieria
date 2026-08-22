import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { allConcepts, chapters, conceptById, plausibilityLabels, scaleLabels } from '../../data/astroData';
import { Grain } from '../shared/Grain';
import {
  PLANE_H,
  PLANE_W,
  buildPlanSpec,
  plausibilityColor,
  type PlanSpec,
} from './planSpec';
import './archivoPlanos.css';

const chapterIndexByConcept = new Map<string, { chapter: (typeof chapters)[number]; index: number }>();
chapters.forEach((chapter) => {
  chapter.concepts.forEach((concept, index) => {
    chapterIndexByConcept.set(concept.id, { chapter, index });
  });
});

const initialIndex = Math.max(
  allConcepts.findIndex((concept) => concept.id === 'oneill-cylinder'),
  0,
);

const strokeClass = (stroke?: string) => {
  if (stroke === 'accent') return 'pl-o-accent';
  if (stroke === 'dim') return 'pl-o-dim';
  if (stroke === 'ghost') return 'pl-o-ghost';
  return 'pl-o-ink';
};

const PlanSvg = ({ spec, animate }: { spec: PlanSpec; animate?: boolean }) => (
  <svg
    className={animate ? 'pl-svg pl-animates' : 'pl-svg'}
    viewBox={`0 0 ${PLANE_W} ${PLANE_H}`}
    role="img"
    aria-label="Plano técnico generativo"
  >
    {spec.ops.map((op, index) => {
      const delay = Math.min(index * 22, 2400);
      const dashed = 'dash' in op && Boolean(op.dash);
      const drawClass = animate && !dashed ? 'pl-draw' : 'pl-fade';
      const style = animate ? { animationDelay: `${delay}ms` } : undefined;
      const cls = strokeClass('stroke' in op ? op.stroke : undefined);
      const width = 'w' in op ? op.w : undefined;
      const dash = 'dash' in op ? op.dash : undefined;

      if (op.type === 'line') {
        return (
          <line
            key={index}
            x1={op.x1}
            y1={op.y1}
            x2={op.x2}
            y2={op.y2}
            className={`${cls} ${drawClass}`}
            strokeWidth={width ?? 1}
            strokeDasharray={dash}
            pathLength={dashed ? undefined : 1}
            style={style}
          />
        );
      }
      if (op.type === 'circle') {
        return (
          <circle
            key={index}
            cx={op.cx}
            cy={op.cy}
            r={op.r}
            className={`${cls} ${drawClass}`}
            strokeWidth={width ?? 1}
            strokeDasharray={dash}
            pathLength={dashed ? undefined : 1}
            style={style}
          />
        );
      }
      if (op.type === 'path') {
        return (
          <path
            key={index}
            d={op.d}
            className={`${cls} ${drawClass}`}
            strokeWidth={width ?? 1}
            strokeDasharray={dash}
            pathLength={dashed ? undefined : 1}
            style={style}
          />
        );
      }
      if (op.type === 'rect') {
        const transform = op.rotate
          ? `rotate(${op.rotate} ${op.x + op.width / 2} ${op.y + op.height / 2})`
          : undefined;
        return (
          <rect
            key={index}
            x={op.x}
            y={op.y}
            width={op.width}
            height={op.height}
            transform={transform}
            className={`${cls} ${drawClass}`}
            strokeWidth={width ?? 1}
            strokeDasharray={dash}
            pathLength={dashed ? undefined : 1}
            style={style}
          />
        );
      }
      if (op.type === 'dot') {
        return (
          <circle
            key={index}
            cx={op.cx}
            cy={op.cy}
            r={op.r}
            className={`pl-fill ${op.dim ? 'pl-o-ghost' : 'pl-o-ink'} pl-fade`}
            style={style}
          />
        );
      }
      if (op.type === 'dim') {
        return (
          <g key={index} className={`pl-dim-group ${animate ? 'pl-fade' : ''}`} style={style}>
            <line x1={op.x1} y1={op.y} x2={op.x2} y2={op.y} className="pl-o-dim" strokeWidth={1} />
            <line x1={op.x1} y1={op.y - 6} x2={op.x1} y2={op.y + 6} className="pl-o-dim" strokeWidth={1} />
            <line x1={op.x2} y1={op.y - 6} x2={op.x2} y2={op.y + 6} className="pl-o-dim" strokeWidth={1} />
            <text
              x={(op.x1 + op.x2) / 2}
              y={op.y - 8}
              textAnchor="middle"
              className="pl-o-ink pl-text pl-text-bright"
              fontSize={10}
            >
              {op.label}
            </text>
          </g>
        );
      }
      const transform = op.rotate ? `rotate(${op.rotate} ${op.x} ${op.y})` : undefined;
      return (
        <text
          key={index}
          x={op.x}
          y={op.y}
          transform={transform}
          textAnchor={op.anchor ?? 'start'}
          className={`pl-text ${animate ? 'pl-fade' : ''} ${
            op.accent ? 'pl-o-accent' : op.dim ? 'pl-o-dim' : op.bright ? 'pl-o-ink pl-text-bright' : 'pl-o-ink'
          }`}
          fontSize={op.size ?? 9}
          style={style}
        >
          {op.s}
        </text>
      );
    })}
  </svg>
);

const MetricBar = ({ label, value }: { label: string; value: number }) => (
  <div className="pl-metric">
    <span className="pl-metric-label">{label}</span>
    <span className="pl-metric-track">
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className={i < value ? 'is-on' : ''} />
      ))}
    </span>
    <span className="pl-metric-value">{value}/5</span>
  </div>
);

export default function ArchivoPlanos() {
  const [index, setIndex] = useState(initialIndex);
  const [gridOpen, setGridOpen] = useState(false);

  const concept = allConcepts[index];
  const placement = chapterIndexByConcept.get(concept.id);
  const chapter = placement?.chapter ?? chapters[0];
  const indexInChapter = placement?.index ?? 0;

  const spec = useMemo(
    () => buildPlanSpec(concept, chapter, indexInChapter),
    [concept, chapter, indexInChapter],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % allConcepts.length);
      } else if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + allConcepts.length) % allConcepts.length);
      } else if (event.key.toLocaleLowerCase('es') === 'g') {
        setGridOpen((open) => !open);
      } else if (event.key === 'Escape') {
        setGridOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const drawingNo = `FG-${chapter.number}-${String(indexInChapter + 1).padStart(3, '0')}`;
  const related = concept.related
    .map((id) => conceptById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="pl-root" style={{ '--pl-accent': chapter.color } as CSSProperties}>
      <Grain opacity={0.06} blend="overlay" zIndex={30} />

      <aside className="pl-rail" aria-label="Archivo por misión">
        <p className="pl-rail-title">ARCHIVO</p>
        <p className="pl-rail-sub">{allConcepts.length} planos · 8 tipologías</p>
        <nav className="pl-rail-list">
          {chapters.map((item) => {
            const active = item.id === chapter.id;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? 'pl-rail-item is-active' : 'pl-rail-item'}
                style={{ '--pl-accent': item.color } as CSSProperties}
                onClick={() => {
                  const target = allConcepts.findIndex((c) => c.chapterId === item.id);
                  if (target >= 0) {
                    setIndex(target);
                    setGridOpen(false);
                  }
                }}
              >
                <span className="pl-rail-num">{item.number}</span>
                <span className="pl-rail-name">{item.title}</span>
                <span className="pl-rail-count">{item.concepts.length}</span>
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          className={gridOpen ? 'pl-grid-toggle is-open' : 'pl-grid-toggle'}
          onClick={() => setGridOpen((open) => !open)}
        >
          {gridOpen ? 'Cerrar mosaico' : 'Mosaico general'} <kbd>G</kbd>
        </button>
      </aside>

      <main className="pl-main" key={gridOpen ? 'grid' : `plan-${concept.id}`}>
        {gridOpen ? (
          <div className="pl-mosaic" role="listbox" aria-label="Todos los planos">
            {allConcepts.map((item, itemIndex) => {
              const itemPlacement = chapterIndexByConcept.get(item.id);
              const itemChapter = itemPlacement?.chapter ?? chapters[0];
              const mini = buildPlanSpec(item, itemChapter, itemPlacement?.index ?? 0, { mini: true });
              return (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === concept.id ? 'pl-cell is-active' : 'pl-cell'}
                  style={{ '--pl-accent': itemChapter.color } as CSSProperties}
                  onClick={() => {
                    setIndex(itemIndex);
                    setGridOpen(false);
                  }}
                >
                  <PlanSvg spec={mini} />
                  <span className="pl-cell-meta">
                    <span className="pl-cell-no">
                      FG-{itemChapter.number}-{String((itemPlacement?.index ?? 0) + 1).padStart(3, '0')}
                    </span>
                    <span className="pl-cell-title">{item.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <header className="pl-head">
              <div className="pl-head-left">
                <span className="pl-head-no">{drawingNo}</span>
                <h1 className="pl-head-title">{concept.title}</h1>
              </div>
              <div className="pl-head-right">
                <span className="pl-chip">{scaleLabels[concept.scale]}</span>
                <span
                  className="pl-chip pl-chip-plaus"
                  style={{ '--pl-stamp': plausibilityColor(concept.plausibility) } as CSSProperties}
                >
                  {plausibilityLabels[concept.plausibility]}
                </span>
                <span className="pl-nav">
                  <button type="button" onClick={() => setIndex((c) => (c - 1 + allConcepts.length) % allConcepts.length)}>
                    ←
                  </button>
                  <span className="pl-nav-count">
                    {index + 1} / {allConcepts.length}
                  </span>
                  <button type="button" onClick={() => setIndex((c) => (c + 1) % allConcepts.length)}>
                    →
                  </button>
                </span>
              </div>
            </header>

            <div className="pl-stage">
              <PlanSvg spec={spec} animate />
            </div>

            <aside className="pl-dossier">
              <p className="pl-dossier-kicker">{chapter.title}</p>
              <p className="pl-dossier-summary">{concept.summary}</p>
              <p className="pl-dossier-idea">
                <span>IDEA CLAVE</span>
                {concept.keyIdea}
              </p>
              <div className="pl-dossier-metrics">
                <MetricBar label="ENERGÍA" value={concept.metrics.energia} />
                <MetricBar label="MATERIALES" value={concept.metrics.materiales} />
                <MetricBar label="MADUREZ" value={concept.metrics.madurez} />
                <MetricBar label="MARAVILLA" value={concept.metrics.maravilla} />
              </div>
              {related.length > 0 && (
                <div className="pl-dossier-related">
                  <span className="pl-dossier-label">PLANOS VINCULADOS</span>
                  <div className="pl-related-chips">
                    {related.slice(0, 6).map((item) => (
                      <button key={item.id} type="button" onClick={() => {
                        const target = allConcepts.findIndex((c) => c.id === item.id);
                        if (target >= 0) setIndex(target);
                      }}>
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(concept.sources ?? []).length > 0 && (
                <div className="pl-dossier-sources">
                  <span className="pl-dossier-label">REFERENCIAS</span>
                  {(concept.sources ?? []).slice(0, 3).map((source) => (
                    <span key={source.url} className="pl-source">
                      {source.publisher} — {source.title}
                    </span>
                  ))}
                </div>
              )}
              <p className="pl-dossier-hint">
                <kbd>←</kbd> <kbd>→</kbd> cambiar plano · <kbd>G</kbd> mosaico · cada plano se genera
                desde los datos de su concepto
              </p>
            </aside>
          </>
        )}
      </main>
    </div>
  );
}
