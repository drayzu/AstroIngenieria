import { NEW_TOOLS, type LabTool, type NewTool } from './registry';
import { translate, type Locale } from '../../../i18n/messages';
import { light, reflectBeams } from './light';
import { matter } from './matter';
import { stars } from './stars';
import { structures } from './structures';
import { angle, clamp, disposeSprites, dist, line, orb, ring, segmentDistance, TAU, type Beam, type Environment, type FamilyModule, type LabBody, type Phenomenon, type Point } from './shared';

const modules: Record<string, FamilyModule> = { Luz: light, Materia: matter, Estrellas: stars, Estructuras: structures };
const moduleFor = (f: Phenomenon) => modules[NEW_TOOLS.find(t => t.id === f.id)!.category];
export class Collection {
  readonly effects: Phenomenon[] = [];
  beams: Beam[] = [];
  quality = 1;
  private active: Phenomenon | null = null;
  private creating = false;
  private snapshot: string | null = null;
  private slow = 0;

  create(id: LabTool, p: Point, time: number, random: () => number): boolean {
    const tool = NEW_TOOLS.find(t => t.id === id); if (!tool) return false;
    const f: Phenomenon = { ...p, id: id as NewTool, born: time, age: 0, color: tool.color, angle: 0, radius: 100, handles: [], grains: [], energy: 0, phase: 0, speed: 0, values: [], last: { ...p }, held: -2, released: false, pulses: [] };
    moduleFor(f).create(f, random);
    // A hard allocation budget independent of frame rate; effects fade naturally at 90 s.
    while (this.effects.length >= 12 || this.particleCount + f.grains.length > 1600) this.effects.shift();
    this.effects.push(f);
    if (tool.creation === 'drag') { this.active = f; f.held = 0; this.creating = true; moduleFor(f).drag(f, 0, p); }
    return true;
  }
  get particleCount() { return this.effects.reduce((n, f) => n + f.grains.length, 0); }
  down(p: Point): string | null {
    for (const f of [...this.effects].reverse()) {
      if (f.id === 'dyson' && Math.abs(dist(f, p) - 70) < 20) {
        const sector = (Math.round((angle(f, p) - f.age * .08) / TAU * 12) % 12 + 12) % 12;
        f.values[sector] = f.values[sector] ? 0 : 1;
        return f.values[sector] ? 'Colector abierto: una ventana deja escapar la luz.' : 'Colector cerrado: la energía alimenta el haz.';
      }
      let i = f.handles.findIndex(h => dist(h, p) < 23);
      if (i < 0 && dist(f, p) >= 26) continue;
      if (i < 0) i = -1;
      this.active = f; this.snapshot = JSON.stringify(f); f.held = i; this.creating = false;
      return NEW_TOOLS.find(t => t.id === f.id)!.hint + ' · Esc deshace este gesto.';
    }
    return null;
  }
  move(p: Point) { if (this.active) moduleFor(this.active).drag(this.active, this.active.held, p); }
  up(): boolean {
    if (!this.active) return false;
    this.active.released = true; this.active.held = -2; this.active = null; this.creating = false; this.snapshot = null; return true;
  }
  cancel(): boolean {
    if (!this.active) return false;
    if (this.creating) this.effects.splice(this.effects.indexOf(this.active), 1);
    else if (this.snapshot) Object.assign(this.active, JSON.parse(this.snapshot));
    this.active.held = -2; this.active = null; this.creating = false; this.snapshot = null; return true;
  }
  clear() { this.cancel(); this.effects.length = 0; this.beams = []; }
  dispose() { this.clear(); disposeSprites(); }
  resize(sx: number, sy: number) {
    this.cancel(); for (const f of this.effects) { f.x *= sx; f.y *= sy; for (const p of [...f.handles, ...f.grains]) { p.x *= sx; p.y *= sy; } for (const g of f.grains) g.trail = []; }
  }
  update(env: Environment) {
    this.slow += (env.frameDuration > .038 ? 1 : -1) * env.frameDuration;
    this.slow = clamp(this.slow, 0, 3); this.quality = this.slow > 1 ? .5 : 1;
    const beams: Beam[] = []; const context = { ...env, quality: this.quality, beams };
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const f = this.effects[i]; f.age = env.time - f.born;
      if (f.age > 90 && f !== this.active) { this.effects.splice(i, 1); continue; }
      f.energy *= Math.exp(-env.dt * .7); moduleFor(f).update(f, context); f.released = false;
    }
    this.beams = reflectBeams(beams, this.effects.filter(f => f.id === 'mirrors'));
  }
  pressure(body: LabBody, dt: number) {
    for (const beam of this.beams) {
      const d = segmentDistance(body, beam.a, beam.b);
      if (d > 30) continue;
      const a = angle(beam.a, beam.b), normal = 'angle' in body ? Number(body.angle) : a;
      const force = Math.cos(normal - a) ** 2 * beam.power * (1 - d / 30) * 100 * dt / 60;
      body.vx += Math.cos(a) * force; body.vy += Math.sin(a) * force;
    }
  }
  project(p: Point): Point {
    let x = p.x, y = p.y;
    for (const f of this.effects) if (f.id === 'lens') {
      const d = dist(p, f); if (d < 1 || d > f.radius * 2.5) continue;
      const shift = Math.exp(-(((d - f.radius) / (f.radius * .6)) ** 2)) * f.radius * .32;
      x += (p.x - f.x) / d * shift; y += (p.y - f.y) / d * shift;
    }
    return { x, y };
  }
  draw(c: CanvasRenderingContext2D, pointer: Point, locale: Locale = 'es') {
    c.save(); c.globalCompositeOperation = 'screen';
    for (const beam of this.beams) { line(c, [beam.a, beam.b], beam.color, 8, beam.power * .018); line(c, [beam.a, beam.b], beam.color, 1, beam.power * .23); }
    for (const f of this.effects) {
      c.save();
      c.globalAlpha = Math.min(1, f.age * 2.5, Math.max(0, (90 - f.age) / 5));
      moduleFor(f).draw(f, c, this.quality);
      const near = dist(pointer, f) < 230;
      const alpha = near || this.active === f ? .8 : .28;
      for (const h of f.handles) { ring(c, h, 6, f.color, 1, 0, alpha); orb(c, h, 1.5, f.color, alpha); }
      if (f.id !== 'eclipse' && f.id !== 'accretion') { ring(c, f, 4, f.color, 1, 0, alpha * .6); }
      if (this.creating && f === this.active) line(c, [f, f.handles[0]], f.color, 1, .5);
      if (near) {
        const title = translate(NEW_TOOLS.find(t => t.id === f.id)!.name, locale);
        c.font = '10px sans-serif'; c.globalCompositeOperation = 'source-over'; c.strokeStyle = '#101929'; c.lineWidth = 3; c.lineJoin = 'round';
        c.globalAlpha *= .8; c.strokeText(title, f.x + 12, f.y + 23); c.fillStyle = f.color; c.fillText(title, f.x + 12, f.y + 23);
      }
      c.restore();
    }
    c.restore();
  }
  /** Exposed geometry supports deterministic validation without DOM-only test hooks. */
  handles(id: NewTool) { return this.effects.find(f => f.id === id)?.handles.map(p => ({ ...p })) ?? []; }
}
