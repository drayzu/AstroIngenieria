import type { LabBody, Point } from '../CosmicLab';
import type { NewTool } from './registry';
export type { Point, LabBody };
export const TAU = Math.PI * 2;
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const polar = (p: Point, r: number, a: number): Point => ({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
export const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
export interface Grain extends LabBody { seed: number; trail: Point[] }
export interface Beam { a: Point; b: Point; color: string; power: number }
export interface Environment {
  time: number; dt: number; frameDuration: number; quality: number; width: number; height: number;
  bodies: LabBody[]; plasma?: Point[]; beams: Beam[]; random: () => number;
  moveBody: (body: LabBody, dt: number) => Point;
  recycleBody: (body: LabBody) => void;
  gas: (p: Point, velocity: Point, radius: number) => void;
  jet: (p: Point, velocity: Point) => void;
}
export interface Phenomenon extends Point {
  id: NewTool; born: number; age: number; color: string; angle: number; radius: number;
  handles: Point[]; grains: Grain[]; energy: number; phase: number; speed: number;
  values: number[]; last: Point; held: number; released: boolean; pulses: { age: number; node: number }[];
}
export interface FamilyModule {
  create: (f: Phenomenon, random: () => number) => void;
  update: (f: Phenomenon, env: Environment) => void;
  draw: (f: Phenomenon, ctx: CanvasRenderingContext2D, quality: number) => void;
  drag: (f: Phenomenon, index: number, p: Point) => void;
}
export function grain(p: Point, seed: number, size = 1): Grain { return { x: p.x, y: p.y, seed, size, vx: 0, vy: 0, life: 1, layer: 'museum', trail: [] }; }
export function line(ctx: CanvasRenderingContext2D, points: Point[], color: string, width = 1, alpha = 1) {
  if (!points.length) return;
  const priorAlpha = ctx.globalAlpha; ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  // A restrained dark edge keeps fine luminous filaments readable over pale rooms.
  const mode = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = priorAlpha * alpha * .45;
  ctx.strokeStyle = '#17233c'; ctx.lineWidth = width + 1.3; ctx.stroke();
  ctx.globalCompositeOperation = mode; ctx.globalAlpha = priorAlpha * alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.stroke(); ctx.globalAlpha = priorAlpha;
}
export function orb(ctx: CanvasRenderingContext2D, p: Point, r: number, color: string, alpha = 1) {
  const priorAlpha = ctx.globalAlpha; ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.1, r), 0, TAU); ctx.fill(); ctx.globalAlpha = priorAlpha;
}
// Small cached sprites keep the numerous decorative lights inexpensive.
const sprites = new Map<string, HTMLCanvasElement>();
export function glow(ctx: CanvasRenderingContext2D, p: Point, r: number, color: string, alpha = 1) {
  let canvas = sprites.get(color);
  if (!canvas) {
    canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const c = canvas.getContext('2d')!; const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color); g.addColorStop(.15, color + 'b0'); g.addColorStop(.48, color + '35'); g.addColorStop(1, color + '00');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); sprites.set(color, canvas);
  }
  const priorAlpha = ctx.globalAlpha; ctx.globalAlpha *= alpha; ctx.drawImage(canvas, p.x - r, p.y - r, r * 2, r * 2); ctx.globalAlpha = priorAlpha;
}
export function planet(ctx: CanvasRenderingContext2D, p: Point, r: number, color: string) {
  ctx.save(); ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(p.x - r * .45, p.y - r * .45, 0, p.x, p.y, r);
  g.addColorStop(0, color); g.addColorStop(.55, '#333848'); g.addColorStop(1, '#080c18');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.restore();
}
export function ring(ctx: CanvasRenderingContext2D, p: Point, r: number, color: string, squash = 1, rotation = 0, alpha = .5, start = 0, end = TAU) {
  const priorAlpha = ctx.globalAlpha; ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(.1, r), Math.max(.1, r * squash), rotation, start, end);
  const mode = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#17233c'; ctx.globalAlpha = priorAlpha * alpha * .45; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.globalCompositeOperation = mode; ctx.strokeStyle = color; ctx.globalAlpha = priorAlpha * alpha; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = priorAlpha;
}
export function pushTrail(g: Grain, max = 22) { g.trail.push({ x: g.x, y: g.y }); if (g.trail.length > max) g.trail.shift(); }
export function translate(f: Phenomenon, p: Point) {
  const dx = p.x - f.x, dy = p.y - f.y;
  for (const h of f.handles) { h.x += dx; h.y += dy; }
  f.x = p.x; f.y = p.y;
}
export function axisDrag(f: Phenomenon, index: number, p: Point) {
  if (index < 0) translate(f, p);
  else { f.handles[index] = { ...p }; f.angle = angle(f, p); f.radius = clamp(dist(f, p), 24, 220); }
}
/** Segment distance is used for fast impacts as well as continuous light pressure. */
export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}
export function hit(p: Point, radius: number, env: Environment) {
  return env.bodies.find(b => b.life > 0 && segmentDistance(p, b, { x: b.x + b.vx * env.dt * 60, y: b.y + b.vy * env.dt * 60 }) < radius + b.size);
}
export function disposeSprites() { sprites.clear(); }
