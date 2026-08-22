import type { AstroChapter, AstroConcept, Plausibility, VisualizationKind } from '../../types';
import { createRng, type Rng } from '../shared/conceptImages';

/**
 * Motor generativo de planos: cada concepto del atlas produce un dibujo técnico
 * único y determinista (misma semilla, mismo plano). La geometría nace de los
 * propios datos: tipología por visualization.kind, diales por métricas, sello
 * por plausibilidad y revisiones por fuentes.
 */

export type Stroke = 'ink' | 'dim' | 'accent' | 'ghost';

interface OpBase {
  stroke?: Stroke;
  w?: number;
  dash?: string;
}

export interface LineOp extends OpBase {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CircleOp extends OpBase {
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
}

export interface PathOp extends OpBase {
  type: 'path';
  d: string;
}

export interface RectOp extends OpBase {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: number;
}

export interface DotOp {
  type: 'dot';
  cx: number;
  cy: number;
  r: number;
  dim?: boolean;
}

export interface TextOp {
  type: 'text';
  x: number;
  y: number;
  s: string;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  mono?: boolean;
  bright?: boolean;
  accent?: boolean;
  dim?: boolean;
  rotate?: number;
}

export interface DimOp {
  type: 'dim';
  x1: number;
  x2: number;
  y: number;
  label: string;
}

export type DrawOp = LineOp | CircleOp | PathOp | RectOp | DotOp | TextOp | DimOp;

export interface PlanSpec {
  ops: DrawOp[];
  accent: string;
}

export const PLANE_W = 1040;
export const PLANE_H = 660;

const scaleSizeLabels: Record<AstroConcept['scale'], string> = {
  nave: '10¹ – 10³ m',
  habitat: '10² – 10⁶ m',
  orbital: '10⁶ – 10⁸ m',
  planetaria: '10⁷ – 10⁸ m',
  estelar: '10⁹ – 10¹² m',
  galactica: '10¹⁹ – 10²¹ m',
};

const plausibilityColors: Record<Plausibility, string> = {
  actual: '#7dd6a1',
  plausible: '#8fd0e8',
  frontera: '#e0a458',
  especulativo: '#e07b5c',
};

export const plausibilityColor = (level: Plausibility): string => plausibilityColors[level];

const plausibilityLabels: Record<Plausibility, string> = {
  actual: 'Actual',
  plausible: 'Plausible',
  frontera: 'Frontera',
  especulativo: 'Especulativo',
};

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [cx + Math.cos(rad) * r, cy + Math.sin(rad) * r];
};

const fixed = (point: [number, number]): [number, number] => [
  +point[0].toFixed(1),
  +point[1].toFixed(1),
];

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

const wrapText = (text: string, maxChars: number, maxLines = 3): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxChars && current) {
      lines.push(current.trim());
      current = word;
      if (lines.length === maxLines) {
        break;
      }
    } else {
      current = `${current} ${word}`;
    }
  }
  if (lines.length < maxLines && current.trim()) {
    lines.push(current.trim());
  }
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > maxChars ? `${last.slice(0, maxChars - 1)}…` : last;
  }
  return lines;
};

const tick = (cx: number, cy: number, r0: number, r1: number, deg: number, op: Omit<LineOp, 'type' | 'x1' | 'y1' | 'x2' | 'y2'>): LineOp => {
  const [x0, y0] = fixed(polar(cx, cy, r0, deg));
  const [x1, y1] = fixed(polar(cx, cy, r1, deg));
  return { type: 'line', x1: x0, y1: y0, x2: x1, y2: y1, ...op };
};

/* ── Tipologías: una por visualization.kind ─────────────────────────────── */

const rotatingHabitat = (rng: Rng, cx: number, cy: number, r: number, ops: DrawOp[]) => {
  ops.push({ type: 'circle', cx, cy, r, stroke: 'ink', w: 2 });
  ops.push({ type: 'circle', cx, cy, r: r * 0.94, stroke: 'dim', dash: '6 5' });
  ops.push({ type: 'circle', cx, cy, r: r * 0.6, stroke: 'ink', w: 1.4 });
  ops.push({ type: 'circle', cx, cy, r: 14, stroke: 'ink', w: 1.6 });
  const spokes = rng.int(8, 14);
  for (let i = 0; i < spokes; i += 1) {
    ops.push(tick(cx, cy, 14, r * 0.6, (360 / spokes) * i + rng.range(-4, 4), { stroke: 'dim' }));
  }
  const slits = rng.int(16, 24);
  for (let i = 0; i < slits; i += 1) {
    ops.push(tick(cx, cy, r - 10, r, (360 / slits) * i, { stroke: 'ghost' }));
  }
  ops.push({ type: 'path', d: arcPath(cx, cy, r + 26, -52, -18), stroke: 'accent', w: 1.6 });
  const [ax, ay] = fixed(polar(cx, cy, r + 26, -18));
  ops.push({
    type: 'path',
    d: `M ${ax - 7} ${ay + 2} L ${ax} ${ay - 5} L ${ax + 8} ${ay + 6}`,
    stroke: 'accent',
    w: 1.6,
  });
  ops.push({ type: 'text', x: ax + 16, y: ay + 4, s: 'ω', size: 15, mono: true, accent: true });
};

const orbitalNetwork = (rng: Rng, cx: number, cy: number, r: number, ops: DrawOp[]) => {
  ops.push({ type: 'circle', cx, cy, r: 26, stroke: 'ink', w: 1.8 });
  ops.push({ type: 'circle', cx, cy, r: 31, stroke: 'dim', dash: '3 4' });
  const rings = rng.int(2, 3);
  const nodes: [number, number][] = [];
  for (let ring = 0; ring < rings; ring += 1) {
    const rr = r * (0.45 + (0.55 * (ring + 1)) / rings);
    ops.push({
      type: 'circle',
      cx,
      cy,
      r: rr,
      stroke: ring === rings - 1 ? 'ink' : 'dim',
      dash: ring % 2 ? '7 6' : undefined,
    });
    const count = rng.int(3, 5);
    const offset = rng.range(0, 360);
    for (let i = 0; i < count; i += 1) {
      const [x, y] = fixed(polar(cx, cy, rr, offset + (360 / count) * i));
      nodes.push([x, y]);
      ops.push({ type: 'dot', cx: x, cy: y, r: 4 });
    }
  }
  const links = rng.int(4, 7);
  for (let i = 0; i < links; i += 1) {
    const a = nodes[rng.int(0, nodes.length - 1)];
    const b = nodes[rng.int(0, nodes.length - 1)];
    if (a !== b) {
      ops.push({ type: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'ghost' });
    }
  }
};

const dysonSwarm = (rng: Rng, cx: number, cy: number, r: number, ops: DrawOp[]) => {
  ops.push({ type: 'dot', cx, cy, r: 24 });
  ops.push({ type: 'circle', cx, cy, r: 32, stroke: 'dim', dash: '2 5' });
  for (let i = 0; i < 10; i += 1) {
    ops.push(tick(cx, cy, 34, 46, rng.range(0, 360), { stroke: 'accent', w: 1.2 }));
  }
  const arcs = rng.int(3, 4);
  for (let arc = 0; arc < arcs; arc += 1) {
    const rr = r * (0.5 + (0.5 * (arc + 1)) / arcs);
    const start = rng.range(0, 360);
    const span = rng.range(70, 160);
    ops.push({ type: 'path', d: arcPath(cx, cy, rr, start, start + span), stroke: 'dim', dash: '5 5' });
    const collectors = rng.int(5, 9);
    for (let i = 0; i < collectors; i += 1) {
      const [x, y] = fixed(polar(cx, cy, rr, start + (span / (collectors - 1)) * i));
      ops.push({ type: 'dot', cx: x, cy: y, r: 3 });
    }
  }
  const [lx, ly] = fixed(polar(cx, cy, r + 18, 24));
  ops.push({ type: 'line', x1: lx, y1: ly, x2: lx + 70, y2: ly - 40, stroke: 'dim' });
  ops.push({ type: 'rect', x: lx + 70, y: ly - 52, width: 12, height: 20, stroke: 'ink', w: 1.4 });
  ops.push({ type: 'text', x: lx + 92, y: ly - 38, s: 'COLECTOR', size: 8, mono: true });
};

const propulsionFan = (rng: Rng, cx: number, cy: number, r: number, ops: DrawOp[]) => {
  ops.push({
    type: 'path',
    d: `M ${cx - r} ${cy - 16} L ${cx - r - 26} ${cy - 30} L ${cx - r - 26} ${cy + 30} L ${cx - r} ${cy + 16} Z`,
    stroke: 'ink',
    w: 1.8,
  });
  ops.push({ type: 'circle', cx: cx - r - 34, cy, r: 7, stroke: 'dim' });
  const paths = rng.int(7, 11);
  for (let i = 0; i < paths; i += 1) {
    const spread = (i / (paths - 1) - 0.5) * 130;
    const endX = cx + r * 0.9;
    const cpX = cx + r * 0.15;
    ops.push({
      type: 'path',
      d: `M ${cx - r} ${cy} Q ${cpX} ${cy + spread * 0.5} ${endX} ${cy + spread}`,
      stroke: i === Math.floor(paths / 2) ? 'accent' : 'ghost',
      w: i === Math.floor(paths / 2) ? 1.6 : 1,
    });
    if (rng.unit() > 0.4) {
      const markX = cx + rng.range(-r * 0.4, r * 0.5);
      const t = (markX - (cx - r)) / (endX - (cx - r));
      const y = cy + spread * (t * t * 0.5 + t * 0.5);
      ops.push({
        type: 'path',
        d: `M ${markX - 4} ${y - 4} L ${markX + 4} ${y + 4} M ${markX - 4} ${y + 4} L ${markX + 4} ${y - 4}`,
        stroke: 'dim',
        w: 1,
      });
    }
  }
  ops.push({ type: 'line', x1: cx - r, y1: cy + r * 0.72, x2: cx + r, y2: cy + r * 0.72, stroke: 'dim' });
  ops.push({ type: 'text', x: cx + r, y: cy + r * 0.72 + 16, s: 'Δv', size: 10, mono: true, anchor: 'end' });
};

const planetaryLab = (rng: Rng, cx: number, cy: number, r: number, ops: DrawOp[]) => {
  ops.push({ type: 'circle', cx, cy, r: r * 1.12, stroke: 'dim', dash: '4 6' });
  ops.push({ type: 'circle', cx, cy, r, stroke: 'ink', w: 2 });
  const bands = rng.int(4, 6);
  for (let i = 1; i < bands; i += 1) {
    const y = cy - r + (2 * r * i) / bands;
    const dy = y - cy;
    const half = Math.sqrt(Math.max(r * r - dy * dy, 0));
    ops.push({ type: 'line', x1: cx - half, y1: y, x2: cx + half, y2: y, stroke: 'ghost' });
  }
  ops.push({
    type: 'path',
    d: `M ${cx} ${cy - r} A ${r * 0.42} ${r} 0 0 1 ${cx} ${cy + r}`,
    stroke: 'dim',
    dash: '3 4',
  });
  const mirrorA = rng.range(-40, -15);
  const [m0x, m0y] = fixed(polar(cx, cy, r * 1.45, mirrorA - 8));
  const [m1x, m1y] = fixed(polar(cx, cy, r * 1.45, mirrorA + 8));
  ops.push({ type: 'line', x1: m0x, y1: m0y, x2: m1x, y2: m1y, stroke: 'accent', w: 2 });
  for (let i = 0; i < 3; i += 1) {
    const t = 0.3 + i * 0.2;
    ops.push({
      type: 'line',
      x1: m0x + (m1x - m0x) * t,
      y1: m0y + (m1y - m0y) * t,
      x2: (m0x + (m1x - m0x) * t) * 0.7 + cx * 0.3,
      y2: (m0y + (m1y - m0y) * t) * 0.7 + cy * 0.3,
      stroke: 'ghost',
    });
  }
};

const stellarEngine = (rng: Rng, cx: number, cy: number, r: number, ops: DrawOp[]) => {
  ops.push({ type: 'dot', cx, cy, r: r * 0.34 });
  ops.push({ type: 'circle', cx, cy, r: r * 0.46, stroke: 'dim', dash: '3 5' });
  const rays = rng.int(8, 12);
  for (let i = 0; i < rays; i += 1) {
    ops.push(tick(cx, cy, r * 0.4, r * 0.5, rng.range(0, 360), { stroke: 'accent', w: 1 }));
  }
  ops.push({ type: 'path', d: arcPath(cx, cy, r * 0.78, 118, 242), stroke: 'ink', w: 2.2 });
  ops.push({ type: 'path', d: arcPath(cx, cy, r * 0.88, 122, 238), stroke: 'dim', dash: '5 4' });
  const beamY = r * 0.22;
  ops.push({ type: 'line', x1: cx + r * 0.5, y1: cy - beamY, x2: cx + r * 1.25, y2: cy - beamY * 1.9, stroke: 'accent', w: 1.6 });
  ops.push({ type: 'line', x1: cx + r * 0.5, y1: cy + beamY, x2: cx + r * 1.25, y2: cy + beamY * 1.9, stroke: 'accent', w: 1.6 });
  ops.push({
    type: 'path',
    d: `M ${cx + r * 1.25} ${cy - beamY * 1.9} L ${cx + r * 1.38} ${cy} L ${cx + r * 1.25} ${cy + beamY * 1.9}`,
    stroke: 'accent',
    w: 1.6,
  });
  ops.push({
    type: 'text',
    x: cx + r * 1.02,
    y: cy - beamY * 1.3 - 10,
    s: 'EMPUJE',
    size: 8,
    mono: true,
    accent: true,
  });
  ops.push({ type: 'line', x1: cx - r * 0.5, y1: cy, x2: cx - r * 0.95, y2: cy, stroke: 'dim', dash: '6 4' });
};

const stellarMap = (rng: Rng, cx: number, cy: number, r: number, ops: DrawOp[]) => {
  ops.push({ type: 'line', x1: cx - r * 1.1, y1: cy, x2: cx + r * 1.1, y2: cy, stroke: 'ghost' });
  ops.push({ type: 'line', x1: cx, y1: cy - r * 1.1, x2: cx, y2: cy + r * 1.1, stroke: 'ghost' });
  ops.push({ type: 'circle', cx, cy, r, stroke: 'dim', dash: '8 6' });
  ops.push({ type: 'circle', cx, cy, r: r * 0.55, stroke: 'ghost', dash: '4 6' });
  const stars = rng.int(14, 20);
  const points: [number, number][] = [];
  for (let i = 0; i < stars; i += 1) {
    const rr = Math.sqrt(rng.unit()) * r;
    const [x, y] = fixed(polar(cx, cy, rr, rng.range(0, 360)));
    points.push([x, y]);
    ops.push({ type: 'dot', cx: x, cy: y, r: +rng.range(1.4, 3.2).toFixed(1), dim: rng.unit() > 0.6 });
  }
  const lines = rng.int(3, 5);
  for (let i = 0; i < lines; i += 1) {
    const a = points[rng.int(0, points.length - 1)];
    const b = points[rng.int(0, points.length - 1)];
    if (a !== b) {
      ops.push({ type: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'ghost' });
    }
  }
  const [tx, ty] = fixed(polar(cx, cy, r * rng.range(0.2, 0.7), rng.range(0, 360)));
  ops.push({ type: 'rect', x: tx + 6, y: ty - 32, width: 24, height: 24, stroke: 'accent', w: 1.6 });
  ops.push({
    type: 'text',
    x: tx + 18,
    y: ty - 38,
    s: 'OBJETIVO',
    size: 8,
    mono: true,
    anchor: 'middle',
    accent: true,
  });
};

const civilizationGrid = (rng: Rng, cx: number, cy: number, r: number, ops: DrawOp[]) => {
  const levels = [
    { k: 'I', size: r * 0.42 },
    { k: 'II', size: r * 0.72 },
    { k: 'III', size: r * 1.02 },
  ];
  levels.forEach((level, index) => {
    const half = level.size;
    ops.push({
      type: 'rect',
      x: +(cx - half).toFixed(1),
      y: +(cy - half).toFixed(1),
      width: +(half * 2).toFixed(1),
      height: +(half * 2).toFixed(1),
      stroke: index === 2 ? 'ink' : 'dim',
      w: index === 2 ? 1.8 : 1.2,
    });
    const cells = 4 + index * 2;
    const step = (half * 2) / cells;
    for (let i = 1; i < cells; i += 1) {
      ops.push({
        type: 'line',
        x1: +(cx - half + i * step).toFixed(1),
        y1: +(cy - half).toFixed(1),
        x2: +(cx - half + i * step).toFixed(1),
        y2: +(cy + half).toFixed(1),
        stroke: 'ghost',
      });
      ops.push({
        type: 'line',
        x1: +(cx - half).toFixed(1),
        y1: +(cy - half + i * step).toFixed(1),
        x2: +(cx + half).toFixed(1),
        y2: +(cy - half + i * step).toFixed(1),
        stroke: 'ghost',
      });
    }
    const filled = rng.int(2, 4 + index * 2);
    for (let i = 0; i < filled; i += 1) {
      const gx = rng.int(0, cells - 1);
      const gy = rng.int(0, cells - 1);
      ops.push({
        type: 'dot',
        cx: +(cx - half + (gx + 0.5) * step).toFixed(1),
        cy: +(cy - half + (gy + 0.5) * step).toFixed(1),
        r: +(step * 0.22).toFixed(1),
      });
    }
    ops.push({
      type: 'text',
      x: +(cx + half + 10).toFixed(1),
      y: +(cy - half + 12).toFixed(1),
      s: `K-${level.k}`,
      size: 10,
      mono: true,
      accent: index === 2,
    });
  });
};

const typologies: Record<VisualizationKind, (rng: Rng, cx: number, cy: number, r: number, ops: DrawOp[]) => void> = {
  'rotating-habitat': rotatingHabitat,
  'orbital-network': orbitalNetwork,
  'dyson-swarm': dysonSwarm,
  'propulsion-fan': propulsionFan,
  'planetary-lab': planetaryLab,
  'stellar-engine': stellarEngine,
  'stellar-map': stellarMap,
  'civilization-grid': civilizationGrid,
};

/* ── Bloques de plano: marco, diales, sello, tablas ─────────────────────── */

const frameOps = (concept: AstroConcept, drawingNo: string, date: string): DrawOp[] => {
  const ops: DrawOp[] = [];
  ops.push({ type: 'rect', x: 10, y: 10, width: PLANE_W - 20, height: PLANE_H - 20, stroke: 'ink', w: 2 });
  ops.push({ type: 'rect', x: 18, y: 18, width: PLANE_W - 36, height: PLANE_H - 36, stroke: 'ghost', w: 1 });
  ops.push({ type: 'line', x1: 18, y1: 52, x2: PLANE_W - 18, y2: 52, stroke: 'ghost' });
  ops.push({ type: 'text', x: 34, y: 40, s: 'OFICINA DE DISEÑO — LA FORJA', size: 9, mono: true });
  ops.push({ type: 'text', x: PLANE_W / 2, y: 40, s: 'ATLAS DE ASTROINGENIERÍA', size: 9, mono: true, anchor: 'middle', dim: true });
  ops.push({ type: 'text', x: PLANE_W - 34, y: 40, s: `Nº ${drawingNo} · ${date}`, size: 9, mono: true, anchor: 'end', bright: true });
  ops.push({ type: 'text', x: 34, y: 76, s: `VISTA GENERAL — ${concept.title.toUpperCase()}`, size: 11.5, mono: true, bright: true });
  return ops;
};

const dialsOps = (metrics: AstroConcept['metrics'], cx0: number, cy: number): DrawOp[] => {
  const ops: DrawOp[] = [];
  const entries: [string, number][] = [
    ['ENERGÍA', metrics.energia],
    ['MATERIALES', metrics.materiales],
    ['MADUREZ', metrics.madurez],
    ['MARAVILLA', metrics.maravilla],
  ];
  entries.forEach(([label, value], index) => {
    const cx = cx0 + index * 97;
    ops.push({ type: 'path', d: arcPath(cx, cy, 34, 180, 360), stroke: 'dim' });
    const phi = 180 + (value / 5) * 180;
    const [vx, vy] = fixed(polar(cx, cy, 34, phi));
    ops.push({ type: 'path', d: arcPath(cx, cy, 34, 180, phi), stroke: 'accent', w: 2.4 });
    ops.push({ type: 'line', x1: cx, y1: cy, x2: vx, y2: vy, stroke: 'ink', w: 1.4 });
    ops.push({ type: 'dot', cx, cy, r: 2.4 });
    ops.push({ type: 'text', x: cx, y: cy + 18, s: label, size: 7.5, mono: true, anchor: 'middle' });
    ops.push({ type: 'text', x: cx, y: cy + 31, s: `${value}/5`, size: 9, mono: true, anchor: 'middle', bright: true });
  });
  ops.push({ type: 'text', x: cx0 - 30, y: cy + 2, s: 'PARÁMETROS', size: 8.5, mono: true, anchor: 'end' });
  return ops;
};

const stampOps = (level: Plausibility, cx: number, cy: number): DrawOp[] => {
  const label = plausibilityLabels[level].toUpperCase();
  return [
    { type: 'rect', x: cx - 92, y: cy - 32, width: 184, height: 64, stroke: 'accent', w: 2.4, rotate: -7 },
    { type: 'rect', x: cx - 84, y: cy - 24, width: 168, height: 48, stroke: 'accent', w: 1, rotate: -7 },
    { type: 'text', x: cx, y: cy - 6, s: 'PLAUSIBILIDAD', size: 8.5, mono: true, anchor: 'middle', accent: true, rotate: -7 },
    { type: 'text', x: cx, y: cy + 15, s: label, size: 15, mono: true, anchor: 'middle', bright: true, rotate: -7 },
  ];
};

const notesOps = (concept: AstroConcept): DrawOp[] => {
  const ops: DrawOp[] = [];
  ops.push({ type: 'line', x1: 646, y1: 402, x2: PLANE_W - 26, y2: 402, stroke: 'ghost' });
  ops.push({ type: 'text', x: 646, y: 422, s: 'NOTA', size: 8, mono: true, accent: true });
  wrapText(concept.advantages[0] ?? '—', 56, 2).forEach((line, i) => {
    ops.push({ type: 'text', x: 646, y: 436 + i * 13, s: line, size: 9, mono: true });
  });
  ops.push({ type: 'text', x: 646, y: 470, s: 'ATENCIÓN', size: 8, mono: true, accent: true });
  wrapText(concept.difficulties[0] ?? '—', 56, 2).forEach((line, i) => {
    ops.push({ type: 'text', x: 646, y: 484 + i * 13, s: line, size: 9, mono: true });
  });
  return ops;
};

const revisionOps = (concept: AstroConcept): DrawOp[] => {
  const ops: DrawOp[] = [];
  ops.push({ type: 'line', x1: 34, y1: 508, x2: 430, y2: 508, stroke: 'dim' });
  ops.push({ type: 'text', x: 34, y: 524, s: 'REVISIONES', size: 8.5, mono: true, bright: true });
  const rows = ['A — BORRADOR DE LA FORJA'];
  (concept.sources ?? []).slice(0, 2).forEach((source) => {
    rows.push(source.publisher.toUpperCase().slice(0, 34));
  });
  rows.push('B — EMISIÓN PARA CONSTRUCCIÓN');
  rows.slice(0, 4).forEach((row, i) => {
    ops.push({ type: 'text', x: 34, y: 546 + i * 22, s: row, size: 9, mono: true });
  });
  return ops;
};

const titleBlockOps = (
  concept: AstroConcept,
  chapter: AstroChapter,
  drawingNo: string,
  sizeLabel: string,
): DrawOp[] => {
  const ops: DrawOp[] = [];
  const x0 = 462;
  const y0 = 500;
  const x1 = PLANE_W - 18;
  ops.push({ type: 'rect', x: x0, y: y0, width: x1 - x0, height: 142, stroke: 'ink', w: 1.6 });
  ops.push({ type: 'line', x1: x0, y1: y0 + 34, x2: x1, y2: y0 + 34, stroke: 'ghost' });
  ops.push({ type: 'line', x1: x0, y1: y0 + 82, x2: x1, y2: y0 + 82, stroke: 'ghost' });
  ops.push({ type: 'line', x1: x0 + 330, y1: y0 + 34, x2: x0 + 330, y2: y0 + 82, stroke: 'ghost' });
  ops.push({ type: 'text', x: x0 + 12, y: y0 + 16, s: 'PROYECTO', size: 7.5, mono: true });
  ops.push({ type: 'text', x: x0 + 100, y: y0 + 16, s: 'ATLAS DE ASTROINGENIERÍA', size: 10.5, mono: true, bright: true });
  ops.push({ type: 'text', x: x1 - 12, y: y0 + 16, s: `ESCALA TÍPICA  ${sizeLabel}`, size: 9, mono: true, anchor: 'end' });
  ops.push({ type: 'text', x: x0 + 12, y: y0 + 48, s: 'TÍTULO', size: 7.5, mono: true });
  wrapText(concept.title.toUpperCase(), 40, 2).forEach((line, i) => {
    ops.push({ type: 'text', x: x0 + 12, y: y0 + 64 + i * 14, s: line, size: 12.5, mono: true, bright: true });
  });
  ops.push({ type: 'text', x: x0 + 342, y: y0 + 48, s: 'MISIÓN', size: 7.5, mono: true });
  wrapText(chapter.title.toUpperCase(), 24, 2).forEach((line, i) => {
    ops.push({ type: 'text', x: x0 + 342, y: y0 + 64 + i * 14, s: line, size: 10, mono: true });
  });
  ops.push({ type: 'text', x: x0 + 12, y: y0 + 98, s: 'Nº PLANO', size: 7.5, mono: true });
  ops.push({ type: 'text', x: x0 + 12, y: y0 + 120, s: drawingNo, size: 13, mono: true, bright: true });
  ops.push({ type: 'text', x: x0 + 200, y: y0 + 98, s: 'CATEGORÍA', size: 7.5, mono: true });
  ops.push({ type: 'text', x: x0 + 200, y: y0 + 120, s: concept.category.toUpperCase().slice(0, 26), size: 9.5, mono: true });
  ops.push({ type: 'text', x: x0 + 380, y: y0 + 98, s: 'PLAUSIBILIDAD', size: 7.5, mono: true });
  ops.push({
    type: 'text',
    x: x0 + 380,
    y: y0 + 120,
    s: plausibilityLabels[concept.plausibility].toUpperCase(),
    size: 9.5,
    mono: true,
    accent: true,
  });
  return ops;
};

const dimOps = (cx: number, y: number, r: number, label: string): DrawOp[] => [
  { type: 'dim', x1: cx - r, x2: cx + r, y, label },
];

/* ── Ensamblado ─────────────────────────────────────────────────────────── */

export interface BuildPlanOptions {
  mini?: boolean;
}

export const buildPlanSpec = (
  concept: AstroConcept,
  chapter: AstroChapter,
  indexInChapter: number,
  options: BuildPlanOptions = {},
): PlanSpec => {
  const rng = createRng(`${concept.id}::plano`);
  const ops: DrawOp[] = [];
  const drawingNo = `FG-${chapter.number}-${String(indexInChapter + 1).padStart(3, '0')}`;
  const date = `20${rng.int(51, 98)}`;

  if (options.mini) {
    typologies[chapter.visualization.kind](rng, PLANE_W / 2, PLANE_H / 2, 240, ops);
    return { ops, accent: chapter.color };
  }

  const focusCx = 320;
  const focusCy = 258;
  ops.push(...frameOps(concept, drawingNo, date));
  typologies[chapter.visualization.kind](rng, focusCx, focusCy, 178, ops);
  ops.push(...dimOps(focusCx, 470, 178, scaleSizeLabels[concept.scale]));
  ops.push(...dialsOps(concept.metrics, 694, 176));
  ops.push(...stampOps(concept.plausibility, 848, 322));
  ops.push(...notesOps(concept));
  ops.push(...revisionOps(concept));
  ops.push(...titleBlockOps(concept, chapter, drawingNo, scaleSizeLabels[concept.scale]));

  return { ops, accent: chapter.color };
};
