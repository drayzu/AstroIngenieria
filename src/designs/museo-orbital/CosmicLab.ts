/** Interactive, bounded experiments. Positions are CSS pixels; time is seconds.
 * Comet velocities use the museum's legacy pixels-per-60Hz-frame convention.
 * Everything else remains local to this laboratory, including its clock. */
export type LabTool = 'hand' | 'hole' | 'nebula' | 'plasma' | 'galaxy' | 'echo' | 'portal' | 'wave' | 'sail';
export const LAB_TOOLS: { id: LabTool; key: string; name: string; hint: string }[] = [
  { id: 'hand', key: '0', name: 'Explorar', hint: 'Clic mantenido: supernova · arrastra desde el cielo: cometa · Shift + clic: constelación.' },
  { id: 'hole', key: '1', name: 'Agujero negro', hint: 'Coloca una singularidad. Lanza un cometa cerca para curvar su trayectoria.' },
  { id: 'nebula', key: '2', name: 'Nebulosa', hint: 'Coloca una nube. Arrástrala en círculos para condensar estrellas; un gesto rápido dispersa el gas.' },
  { id: 'plasma', key: '3', name: 'Lazos de plasma', hint: 'Coloca una estrella. Agarra las puntas de sus arcos y crúzalos para liberar un chorro.' },
  { id: 'galaxy', key: '4', name: 'Galaxias', hint: 'Coloca dos galaxias. Arrastra un núcleo y suéltalo hacia el otro; prueba encuentros tangenciales.' },
  { id: 'echo', key: '5', name: 'Eco de luz', hint: 'Pulsa en distintos lugares para revelar otras capas del polvo. Las supernovas también producen ecos.' },
  { id: 'portal', key: '6', name: 'Agujero de gusano', hint: 'Coloca la primera boca y después la segunda. Puedes arrastrar ambas cuando estén conectadas.' },
  { id: 'wave', key: '7', name: 'Onda gravitacional', hint: 'Arrastra para orientar y dar amplitud a una onda. Al soltar, el cielo se estira y se comprime.' },
  { id: 'sail', key: '9', name: 'Velas solares', hint: 'Coloca una flota. Mueve su sol y arrastra su guía para orientar la luz; gira cada vela arrastrándola.' },
];
export interface LabState { tool: LabTool; hint: string; pendingPortal: boolean }
export interface Point { x: number; y: number }
export interface LabBody extends Point {
  vx: number; vy: number; size: number; life: number;
  tintRGB?: [number, number, number]; layer?: string;
}
interface Particle extends Point { vx: number; vy: number; seed: number; size: number }
interface Hole extends Point { born: number; fed: number }
interface Portal { a: Point; b: Point; pulseA: number; pulseB: number; born: number }
interface Cloud extends Point { particles: Particle[]; born: number; compression: number; spin: number }
interface BabyStar extends Point { born: number; size: number }
interface Plasma extends Point { tips: Point[]; rest: Point[]; cooldown: number; born: number; flash: number }
interface Core extends Point { vx: number; vy: number; mass: number }
interface Galaxy { cores: Core[]; particles: (Particle & { family: number })[]; born: number }
interface Echo extends Point { born: number; power: number }
interface Strain extends Echo { angle: number }
interface Sail extends LabBody { angle: number; born: number }
interface Lamp extends Point { angle: number }
interface Trace extends Point { t: number; start?: boolean }
type Drag =
  | { kind: 'portal'; end: 'a' | 'b'; start: Point }
  | { kind: 'cloud'; cloud: Cloud; lastAngle: number }
  | { kind: 'plasma'; plasma: Plasma; index: number; start: Point }
  | { kind: 'core'; core: Core; start: Point; vx: number; vy: number }
  | { kind: 'lamp' | 'beam' }
  | { kind: 'sail'; sail: Sail }
  | { kind: 'wave'; start: Point };
const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const smooth = (v: number) => { const x = clamp(v, 0, 1); return x * x * (3 - 2 * x); };
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const point = (x: number, y: number): Point => ({ x, y });

/** First entry into a circle, including a segment starting inside it. */
export function circleEntry(a: Point, b: Point, center: Point, radius: number): number | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  const ox = a.x - center.x, oy = a.y - center.y;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const aa = dx * dx + dy * dy;
  if (aa < 1e-10) return null;
  const bb = 2 * (ox * dx + oy * dy), disc = bb * bb - 4 * aa * c;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}

/** Softened radial gravity. The outer falloff has no force discontinuity. */
export function holeAcceleration(body: Point, hole: Point, radius: number): Point {
  const dx = hole.x - body.x, dy = hole.y - body.y, d = Math.hypot(dx, dy);
  if (d < 0.001 || d >= radius) return point(0, 0);
  const falloff = 1 - smooth((d - radius * 0.58) / (radius * 0.42));
  const acceleration = Math.min(1800, 18_000_000 / (d * d + 6400)) * falloff;
  return point(dx / d * acceleration, dy / d * acceleration);
}

function crossing(a: Point, b: Point, c: Point, d: Point): Point | null {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98 ? point(a.x + t * rx, a.y + t * ry) : null;
}

export class CosmicLab {
  tool: LabTool = 'hand';
  hint = LAB_TOOLS[0].hint;
  time = 0;
  width = 1280;
  height = 800;
  readonly holes: Hole[] = [];
  readonly clouds: Cloud[] = [];
  readonly babyStars: BabyStar[] = [];
  readonly plasmas: Plasma[] = [];
  readonly galaxies: Galaxy[] = [];
  readonly echoes: Echo[] = [];
  readonly strains: Strain[] = [];
  readonly sails: Sail[] = [];
  portal: Portal | null = null;
  pending: Point | null = null;
  lamp: Lamp | null = null;
  pointer = point(-1000, -1000);
  private drag: Drag | null = null;
  private pointerTime = 0;
  private traces = new WeakMap<LabBody, Trace[]>();
  private warpLocks = new WeakMap<LabBody, number>();
  private captures = new WeakMap<LabBody, { hole: Hole; angle: number; r: number; born: number; sign: number; size: number }>();
  private dust: (Point & { seed: number; size: number })[] = [];
  private sprites = new Map<string, HTMLCanvasElement>();
  private changed: (state: LabState) => void;
  private jet: (p: Point, velocity: Point) => void;
  private random: () => number;

  constructor(changed: (state: LabState) => void, jet: (p: Point, velocity: Point) => void, random = Math.random) {
    this.changed = changed;
    this.jet = jet;
    this.random = random;
  }

  private emit(hint = this.hint) {
    this.hint = hint;
    this.changed({ tool: this.tool, hint, pendingPortal: Boolean(this.pending) });
  }

  select(tool: LabTool) {
    this.cancel();
    this.tool = tool;
    this.emit(LAB_TOOLS.find(t => t.id === tool)!.hint);
  }

  clear() {
    this.cancel();
    this.holes.length = this.clouds.length = this.babyStars.length = this.plasmas.length = 0;
    this.galaxies.length = this.echoes.length = this.strains.length = this.sails.length = 0;
    this.portal = null;
    this.lamp = null;
    this.dust = [];
    this.traces = new WeakMap();
    this.warpLocks = new WeakMap();
    this.captures = new WeakMap();
    this.tool = 'hand';
    this.emit('Cielo despejado. Elige un fenómeno o lanza un cometa.');
  }

  cancel(): boolean {
    const hadGesture = Boolean(this.drag || this.pending || this.tool !== 'hand');
    if (this.drag?.kind === 'portal' && this.portal) Object.assign(this.portal[this.drag.end], this.drag.start);
    if (this.drag?.kind === 'core') { this.drag.core.vx = 0; this.drag.core.vy = 0; }
    this.drag = null;
    this.pending = null;
    this.tool = 'hand';
    if (hadGesture) this.emit(LAB_TOOLS[0].hint);
    return hadGesture;
  }

  resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    const sx = width / this.width, sy = height / this.height;
    const scale = (p: Point) => { p.x *= sx; p.y *= sy; };
    for (const p of [...this.holes, ...this.babyStars, ...this.echoes, ...this.strains, ...this.sails]) scale(p);
    for (const cloud of this.clouds) { scale(cloud); cloud.particles.forEach(scale); }
    for (const plasma of this.plasmas) { scale(plasma); plasma.tips.forEach(scale); plasma.rest.forEach(scale); }
    for (const galaxy of this.galaxies) { galaxy.cores.forEach(scale); galaxy.particles.forEach(scale); }
    if (this.lamp) scale(this.lamp);
    if (this.portal) { scale(this.portal.a); scale(this.portal.b); }
    this.cancel();
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    if (this.portal) {
      this.portal.a = this.inside(this.portal.a, 54); this.portal.b = this.inside(this.portal.b, 54);
      if (!this.validPair(this.portal.a, this.portal.b)) this.portal = null;
    }
    this.dust = [];
    this.traces = new WeakMap();
  }

  private inside(p: Point, margin = 55): Point {
    const mx = Math.min(margin, this.width / 4), my = Math.min(margin, this.height / 4);
    return point(clamp(p.x, mx, this.width - mx), clamp(p.y, my, this.height - my));
  }
  private validPair(a: Point, b: Point) { return distance(a, b) >= 115; }

  down(p: Point): boolean {
    this.pointer = { ...p };
    const at = this.inside(p);
    const born = this.time;
    if (this.tool === 'portal') {
      if (!this.pending) { this.pending = at; this.emit('Primera boca lista. Coloca la segunda · Esc cancela.'); }
      else if (!this.validPair(this.pending, at)) this.emit('Separa un poco más las bocas para que la salida quede libre.');
      else {
        this.portal = { a: this.pending, b: at, pulseA: -100, pulseB: -100, born };
        this.pending = null; this.tool = 'hand';
        this.emit('Puente conectado. Arrastra una boca para recolocarla; cometas, plasma y velas pueden atravesarlo.');
      }
      return true;
    }
    if (this.tool === 'wave') { this.drag = { kind: 'wave', start: at }; return true; }
    if (this.tool !== 'hand') {
      const selected = this.tool;
      if (selected === 'hole') {
        this.holes.push({ ...at, born, fed: -100 });
        if (this.holes.length > 3) this.holes.shift();
      } else if (selected === 'nebula') this.makeCloud(at);
      else if (selected === 'plasma') {
        const center = this.inside(at, 130);
        const tips = [point(center.x - 78, center.y - 115), point(center.x + 78, center.y - 115)];
        this.plasmas.push({ ...center, tips, rest: tips.map(p => ({ ...p })), born, cooldown: 0, flash: -100 });
        if (this.plasmas.length > 2) this.plasmas.shift();
      } else if (selected === 'galaxy') this.makeGalaxy(at);
      else if (selected === 'echo') this.blast(at, 1);
      else if (selected === 'sail') this.makeSails(at);
      this.tool = 'hand';
      this.emit(LAB_TOOLS.find(t => t.id === selected)!.hint.replace(/^Coloca[^.]*\. /, ''));
      return true;
    }
    if (this.portal) {
      for (const end of ['a', 'b'] as const) if (distance(p, this.portal[end]) < 49) {
        this.drag = { kind: 'portal', end, start: { ...this.portal[end] } }; return true;
      }
    }
    for (const plasma of this.plasmas) for (let index = 0; index < 2; index++) {
      if (distance(p, plasma.tips[index]) < 27) {
        this.drag = { kind: 'plasma', plasma, index, start: { ...plasma.tips[index] } }; return true;
      }
    }
    for (const galaxy of this.galaxies) for (const core of galaxy.cores) if (distance(p, core) < 30) {
      this.drag = { kind: 'core', core, start: { ...p }, vx: 0, vy: 0 }; return true;
    }
    if (this.lamp) {
      if (distance(p, this.beamTip()) < 24) { this.drag = { kind: 'beam' }; return true; }
      if (distance(p, this.lamp) < 26) { this.drag = { kind: 'lamp' }; return true; }
    }
    for (const sail of this.sails) if (distance(p, sail) < 20) { this.drag = { kind: 'sail', sail }; return true; }
    for (const cloud of this.clouds) if (distance(p, cloud) < 180) {
      this.drag = { kind: 'cloud', cloud, lastAngle: Math.atan2(p.y - cloud.y, p.x - cloud.x) };
      return true;
    }
    return false;
  }

  move(p: Point) {
    const elapsed = clamp(this.time - this.pointerTime, 1 / 120, 0.1);
    const vx = clamp((p.x - this.pointer.x) / elapsed, -1400, 1400);
    const vy = clamp((p.y - this.pointer.y) / elapsed, -1400, 1400);
    this.pointerTime = this.time;
    this.pointer = { ...p };
    const drag = this.drag;
    if (!drag) return;
    if (drag.kind === 'portal' && this.portal) {
      const next = this.inside(p, 54);
      if (this.validPair(next, this.portal[drag.end === 'a' ? 'b' : 'a'])) this.portal[drag.end] = next;
    } else if (drag.kind === 'plasma') drag.plasma.tips[drag.index] = this.inside(p, 24);
    else if (drag.kind === 'core') {
      const previous = { x: drag.core.x, y: drag.core.y };
      Object.assign(drag.core, this.inside(p, 28));
      // The inner disk follows a held nucleus; the outskirts lag into tidal tails.
      for (const galaxy of this.galaxies) if (galaxy.cores.includes(drag.core)) {
        for (const particle of galaxy.particles) {
          const follow = Math.exp(-distance(particle, previous) / 90) * 0.65;
          particle.x += (drag.core.x - previous.x) * follow;
          particle.y += (drag.core.y - previous.y) * follow;
        }
      }
      drag.vx = drag.vx * 0.4 + vx * 0.6; drag.vy = drag.vy * 0.4 + vy * 0.6;
    } else if (drag.kind === 'lamp' && this.lamp) Object.assign(this.lamp, this.inside(p, 30));
    else if (drag.kind === 'beam' && this.lamp) this.lamp.angle = Math.atan2(p.y - this.lamp.y, p.x - this.lamp.x);
    else if (drag.kind === 'sail') drag.sail.angle = Math.atan2(p.y - drag.sail.y, p.x - drag.sail.x);
    else if (drag.kind === 'cloud') {
      const cloud = drag.cloud;
      const angle = Math.atan2(p.y - cloud.y, p.x - cloud.x);
      const delta = angleDelta(angle, drag.lastAngle);
      drag.lastAngle = angle;
      const speed = Math.hypot(vx, vy);
      if (distance(p, cloud) < 190 && distance(p, cloud) > 25 && speed < 1100) {
        cloud.compression = Math.min(9, cloud.compression + Math.abs(delta));
        cloud.spin = clamp(cloud.spin + delta * 0.3, -1.8, 1.8);
      }
      for (const gas of cloud.particles) {
        const d = distance(gas, p);
        if (d > 95) continue;
        const w = (1 - d / 95) * 0.24;
        gas.vx += vx * w; gas.vy += vy * w;
        if (speed > 900) {
          gas.vx += (gas.x - p.x) * w * 7; gas.vy += (gas.y - p.y) * w * 7;
          cloud.compression *= 0.985;
        }
      }
    }
  }

  up(): boolean {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return false;
    if (drag.kind === 'core') {
      drag.core.vx = clamp(drag.vx * 0.45, -230, 230); drag.core.vy = clamp(drag.vy * 0.45, -230, 230);
    } else if (drag.kind === 'wave') {
      const dx = this.pointer.x - drag.start.x, dy = this.pointer.y - drag.start.y;
      this.strains.push({ ...drag.start, born: this.time, angle: Math.atan2(dy, dx), power: clamp(Math.hypot(dx, dy) / 300, 0.2, 1) });
      if (this.strains.length > 3) this.strains.shift();
      this.tool = 'hand'; this.emit('Onda liberada. Prueba otra orientación junto a una constelación.');
    }
    return true;
  }

  private makeCloud(at: Point) {
    const particles: Particle[] = [];
    for (let i = 0; i < 250; i++) {
      const angle = this.random() * TAU, r = Math.sqrt(this.random()) * 175;
      particles.push({ x: at.x + Math.cos(angle) * r, y: at.y + Math.sin(angle) * r * 0.68,
        vx: -Math.sin(angle) * 3, vy: Math.cos(angle) * 3, size: 16 + this.random() * 30, seed: this.random() });
    }
    this.clouds.push({ ...at, particles, born: this.time, compression: 0, spin: 0 });
    if (this.clouds.length > 2) this.clouds.shift();
  }

  private makeGalaxy(at: Point) {
    const center = this.inside(at, 170);
    const separation = Math.min(135, this.width * 0.2);
    const cores: Core[] = [
      { x: center.x - separation, y: center.y - 25, vx: 14, vy: 23, mass: 1 },
      { x: center.x + separation, y: center.y + 25, vx: -14, vy: -23, mass: 1 },
    ];
    const particles: Galaxy['particles'] = [];
    for (let family = 0; family < 2; family++) for (let i = 0; i < 230; i++) {
      const r = 15 + Math.pow(this.random(), 0.7) * 112;
      const angle = (i % 3) * TAU / 3 + r * 0.035 + this.random() * 0.48;
      const speed = Math.sqrt(900_000 * r * r / Math.pow(r * r + 1600, 1.5));
      particles.push({ x: cores[family].x + Math.cos(angle) * r, y: cores[family].y + Math.sin(angle) * r,
        vx: cores[family].vx - Math.sin(angle) * speed, vy: cores[family].vy + Math.cos(angle) * speed,
        family, seed: this.random(), size: 0.5 + this.random() * 1.3 });
    }
    this.galaxies.length = 0;
    this.galaxies.push({ cores, particles, born: this.time });
  }

  private makeSails(at: Point) {
    this.lamp = { ...this.inside(point(at.x - 145, at.y), 35), angle: 0 };
    this.sails.length = 0;
    for (let i = 0; i < 9; i++) this.sails.push({
      ...this.inside(point(at.x + (i % 3) * 36, at.y + (Math.floor(i / 3) - 1) * 44), 25),
      vx: 0, vy: 0, life: 1, size: 9, angle: (this.random() - 0.5) * 0.7, born: this.time,
    });
  }

  blast(at: Point, power: number) {
    this.echoes.push({ ...at, born: this.time, power });
    if (this.echoes.length > 4) this.echoes.shift();
    for (const cloud of this.clouds) for (const gas of cloud.particles) {
      const d = distance(gas, at);
      if (d > 420 || d < 1) continue;
      const push = 160 * power * (1 - d / 420);
      gas.vx += (gas.x - at.x) / d * push; gas.vy += (gas.y - at.y) / d * push;
    }
  }

  /** Only celestial geometry is projected; document/UI coordinates stay intact. */
  project(p: Point): Point {
    let x = p.x, y = p.y;
    for (const wave of this.strains) {
      const dx = p.x - wave.x, dy = p.y - wave.y, d = Math.hypot(dx, dy);
      const age = this.time - wave.born, front = d - age * 230;
      const strain = Math.sin(front / 45) * Math.exp(-((front / 150) ** 2)) * wave.power * 0.2 * (1 - smooth(age / 7));
      const cos = Math.cos(wave.angle), sin = Math.sin(wave.angle);
      const u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
      x += strain * (u * cos + v * sin); y += strain * (u * sin - v * cos);
    }
    return point(x, y);
  }

  step(dt: number, bodies: LabBody[]) {
    dt = clamp(dt, 0, 0.08);
    this.time += dt;
    const expire = <T extends { born: number }>(items: T[], life: number) => {
      for (let i = items.length - 1; i >= 0; i--) if (this.time - items[i].born > life) items.splice(i, 1);
    };
    expire(this.holes, 40); expire(this.clouds, 70); expire(this.babyStars, 55);
    expire(this.plasmas, 70); expire(this.galaxies, 80); expire(this.echoes, Math.hypot(this.width, this.height) / 160 + 2);
    expire(this.strains, 7); expire(this.sails, 90);
    if (this.portal && this.time - this.portal.born > 90 && this.drag?.kind !== 'portal') this.portal = null;
    if (this.sails.length === 0) this.lamp = null;
    const nearbyBodies = bodies.slice(0, 48);
    for (const cloud of this.clouds) {
      cloud.compression *= Math.exp(-dt * 0.025);
      const condense = cloud.compression > 2.8;
      let dense = 0;
      for (const gas of cloud.particles) {
        const d = distance(gas, cloud) || 1;
        if (d < 40) dense++;
        if (condense) {
          gas.vx += ((cloud.x - gas.x) * 2.6 - (gas.y - cloud.y) * cloud.spin * 0.35) * dt;
          gas.vy += ((cloud.y - gas.y) * 2.6 + (gas.x - cloud.x) * cloud.spin * 0.35) * dt;
        }
        for (const hole of this.holes) {
          const force = holeAcceleration(gas, hole, this.gravityRadius());
          gas.vx += force.x * dt * 0.3; gas.vy += force.y * dt * 0.3;
          if (distance(gas, hole) < 23) { gas.size *= Math.exp(-dt * 8); hole.fed = this.time; }
        }
        // Bounded local interaction, not all-pairs gas physics.
        for (const body of nearbyBodies) {
          const radius = 32 + body.size * 2;
          if (circleEntry(body, point(body.x + body.vx * dt * 60, body.y + body.vy * dt * 60), gas, radius) === null) continue;
          gas.vx += body.vx * 35 * dt; gas.vy += body.vy * 35 * dt;
        }
        gas.vx *= Math.exp(-dt * 1.6); gas.vy *= Math.exp(-dt * 1.6);
        gas.x += gas.vx * dt; gas.y += gas.vy * dt;
      }
      if (cloud.compression > 4.4 && dense > 34) {
        this.babyStars.push({ x: cloud.x, y: cloud.y, born: this.time, size: 6 + Math.min(5, dense / 30) });
        if (this.babyStars.length > 8) this.babyStars.shift();
        cloud.compression = 0;
        for (const gas of cloud.particles) {
          const angle = Math.atan2(gas.y - cloud.y, gas.x - cloud.x);
          gas.vx += Math.cos(angle) * 65; gas.vy += Math.sin(angle) * 65;
        }
        this.emit('Nació una estrella: tu remolino condensó la nebulosa. Prueba ahora una supernova junto a ella.');
      }
    }
    for (const plasma of this.plasmas) {
      plasma.cooldown = Math.max(0, plasma.cooldown - dt);
      for (let i = 0; i < 2; i++) if (!(this.drag?.kind === 'plasma' && this.drag.plasma === plasma && this.drag.index === i)) {
        const tip = plasma.tips[i], rest = plasma.rest[i];
        const ease = 1 - Math.exp(-dt * 0.85);
        tip.x += (rest.x - tip.x) * ease; tip.y += (rest.y - tip.y) * ease;
      }
      if (plasma.cooldown === 0) {
        const a = this.arcPoints(plasma, 0), b = this.arcPoints(plasma, 1);
        let hit: Point | null = null;
        for (let i = 1; i < a.length && !hit; i++) for (let j = 1; j < b.length && !hit; j++) hit = crossing(a[i - 1], a[i], b[j - 1], b[j]);
        if (hit) {
          const angle = Math.atan2(hit.y - plasma.y, hit.x - plasma.x);
          for (let i = 0; i < 9; i++) {
            const spread = angle + (i - 4) * 0.055;
            this.jet(hit, point(Math.cos(spread) * (7 + i * 0.4), Math.sin(spread) * (7 + i * 0.4)));
          }
          plasma.cooldown = 1.4; plasma.flash = this.time;
          this.emit('Reconexión: el plasma salió en un chorro. Puedes dirigirlo hacia una constelación o un portal.');
        }
      }
    }
    for (const galaxy of this.galaxies) {
      const substeps = Math.max(1, Math.ceil(dt / (1 / 60))), h = dt / substeps;
      for (let step = 0; step < substeps; step++) {
        for (const core of galaxy.cores) {
          if (this.drag?.kind === 'core' && this.drag.core === core) continue;
          for (const other of galaxy.cores) if (core !== other) {
            const dx = other.x - core.x, dy = other.y - core.y;
            const f = 900_000 * other.mass / Math.pow(dx * dx + dy * dy + 3600, 1.5);
            core.vx += dx * f * h; core.vy += dy * f * h;
          }
          core.x += core.vx * h; core.y += core.vy * h;
        }
        for (const star of galaxy.particles) {
          for (const core of galaxy.cores) {
            const dx = core.x - star.x, dy = core.y - star.y;
            const f = 900_000 * core.mass / Math.pow(dx * dx + dy * dy + 1600, 1.5);
            star.vx += dx * f * h; star.vy += dy * f * h;
          }
          star.x += star.vx * h; star.y += star.vy * h;
        }
      }
      if (galaxy.cores.length === 2 && this.time - galaxy.born > 2 && this.drag?.kind !== 'core') {
        const [a, b] = galaxy.cores;
        if (distance(a, b) < 32 && Math.hypot(a.vx - b.vx, a.vy - b.vy) < 260) {
          a.x = (a.x + b.x) / 2; a.y = (a.y + b.y) / 2;
          a.vx = (a.vx + b.vx) / 2; a.vy = (a.vy + b.vy) / 2; a.mass = 2;
          galaxy.cores.pop(); this.emit('Los núcleos se fusionaron. Sus estrellas conservan las colas del encuentro.');
        }
      }
    }
    for (const sail of this.sails) {
      if (this.lamp) {
        const dx = sail.x - this.lamp.x, dy = sail.y - this.lamp.y, d = Math.hypot(dx, dy) || 1;
        const beam = Math.exp(-((angleDelta(Math.atan2(dy, dx), this.lamp.angle) / 0.5) ** 2));
        const facing = Math.abs(Math.cos(sail.angle) * dx / d + Math.sin(sail.angle) * dy / d);
        const pressure = 90 * beam * facing * facing / (1 + d * d / 180_000);
        sail.vx += dx / d * pressure * dt / 60; sail.vy += dy / d * pressure * dt / 60;
      }
      this.moveBody(sail, dt);
      if (sail.x < 15 || sail.x > this.width - 15) { sail.vx *= -0.65; sail.x = clamp(sail.x, 15, this.width - 15); }
      if (sail.y < 15 || sail.y > this.height - 15) { sail.vy *= -0.65; sail.y = clamp(sail.y, 15, this.height - 15); }
    }
    for (let i = this.sails.length - 1; i >= 0; i--) if (this.sails[i].life <= 0) this.sails.splice(i, 1);
  }

  gravityRadius() { return clamp(Math.min(this.width, this.height) * 0.95, 620, 1000); }

  /** Integrate at <=120Hz for stable gravity, capture and swept portal entry.
   * Returns the start of the last continuous segment, so caller collisions never
   * strike letters/constellations along the teleportation gap. */
  moveBody(body: LabBody, dt: number): Point {
    let previous = point(body.x, body.y);
    if (body.layer && body.layer !== 'museum') return previous;
    const capture = this.captures.get(body);
    if (capture) {
      const age = this.time - capture.born;
      const r = capture.r * Math.max(0, 1 - age / 0.7);
      const angle = capture.angle + age * capture.sign * 5;
      body.x = capture.hole.x + Math.cos(angle) * r; body.y = capture.hole.y + Math.sin(angle) * r;
      body.size = Math.max(0.1, capture.size * (1 - age / 0.7));
      body.life = age >= 0.7 ? 0 : 1;
      this.record(body); return previous;
    }
    const steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const start = point(body.x, body.y);
      for (const hole of this.holes) {
        const force = holeAcceleration(body, hole, this.gravityRadius());
        body.vx += force.x * h / 60; body.vy += force.y * h / 60;
      }
      body.x += body.vx * h * 60; body.y += body.vy * h * 60;
      for (const hole of this.holes) if (circleEntry(start, body, hole, 23) !== null) {
        const dx = start.x - hole.x, dy = start.y - hole.y;
        this.captures.set(body, { hole, born: this.time, angle: Math.atan2(dy, dx), r: Math.min(28, Math.hypot(dx, dy)),
          sign: Math.sign(dx * body.vy - dy * body.vx) || 1, size: body.size });
        hole.fed = this.time; body.life = 1; this.record(body); return previous;
      }
      const portal = this.portal;
      if (!portal || this.time < (this.warpLocks.get(body) ?? -1)) continue;
      // Choose the first mouth crossed, not its order in the array.
      const hits = ([['a', 'b'], ['b', 'a']] as const).map(([from, to]) => ({ from, to, t: circleEntry(start, body, portal[from], 43) }))
        .filter(hit => hit.t !== null).sort((a, b) => a.t! - b.t!);
      const hit = hits[0];
      if (!hit) continue;
      const speed = Math.hypot(body.vx, body.vy);
      const ux = speed > 0.001 ? body.vx / speed : 1, uy = speed > 0.001 ? body.vy / speed : 0;
      const entry = point(start.x + (body.x - start.x) * hit.t!, start.y + (body.y - start.y) * hit.t!);
      const side = clamp((entry.x - portal[hit.from].x) * -uy + (entry.y - portal[hit.from].y) * ux, -35, 35);
      const exit = point(portal[hit.to].x + ux * 52 - uy * side, portal[hit.to].y + uy * 52 + ux * side);
      const remaining = distance(entry, body);
      // Preserve both speed and heading. Start a new trace at the exit.
      this.record(body, entry);
      previous = exit;
      body.x = exit.x + ux * remaining; body.y = exit.y + uy * remaining;
      this.record(body, exit, true);
      this.warpLocks.set(body, this.time + 0.45);
      portal[hit.from === 'a' ? 'pulseA' : 'pulseB'] = this.time;
      portal[hit.to === 'a' ? 'pulseA' : 'pulseB'] = this.time + 0.07;
    }
    this.record(body);
    return previous;
  }

  private record(body: LabBody, at: Point = body, start = false) {
    let trace = this.traces.get(body);
    if (!trace) { trace = []; this.traces.set(body, trace); }
    trace.push({ x: at.x, y: at.y, t: this.time, start });
    while (trace.length > 65 || (trace.length > 1 && this.time - trace[0].t > 0.7)) trace.shift();
  }

  drawTrail(ctx: CanvasRenderingContext2D, body: LabBody, rgb: number[]) {
    const trace = this.traces.get(body);
    if (!trace || trace.length < 2) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.7, body.size * 0.7);
    for (let i = 1; i < trace.length; i++) {
      if (trace[i].start) continue;
      const fade = clamp(1 - (this.time - trace[i].t) / 0.7, 0, 1);
      ctx.strokeStyle = `rgba(${rgb.join(',')},${fade * 0.65 * body.life})`;
      ctx.beginPath(); ctx.moveTo(trace[i - 1].x, trace[i - 1].y); ctx.lineTo(trace[i].x, trace[i].y); ctx.stroke();
    }
    ctx.restore();
  }

  private arcPoints(plasma: Plasma, index: number): Point[] {
    const tip = plasma.tips[index], side = index === 0 ? -1 : 1;
    const a = point(plasma.x + side * 8, plasma.y - 8), b = point(plasma.x + side * 40, plasma.y + 3);
    const control = point(tip.x * 2 - (a.x + b.x) * 0.5, tip.y * 2 - (a.y + b.y) * 0.5);
    return Array.from({ length: 33 }, (_, i) => {
      const t = i / 32, u = 1 - t;
      return point(u * u * a.x + 2 * u * t * control.x + t * t * b.x, u * u * a.y + 2 * u * t * control.y + t * t * b.y);
    });
  }
  private beamTip(): Point {
    return this.lamp ? point(this.lamp.x + Math.cos(this.lamp.angle) * 95, this.lamp.y + Math.sin(this.lamp.angle) * 95) : point(0, 0);
  }
  private echoAt(p: Point): number {
    let light = 0;
    for (const echo of this.echoes) {
      const front = distance(p, echo) - (this.time - echo.born) * 160;
      light += Math.exp(-((front / 32) ** 2)) * echo.power;
    }
    return Math.min(1, light);
  }
  private glow(ctx: CanvasRenderingContext2D, p: Point, radius: number, color: string, alpha: number) {
    if (alpha < 0.001 || radius < 0.1) return;
    let sprite = this.sprites.get(color);
    if (!sprite) {
      sprite = document.createElement('canvas'); sprite.width = sprite.height = 96;
      const c = sprite.getContext('2d')!;
      const gradient = c.createRadialGradient(48, 48, 0, 48, 48, 48);
      gradient.addColorStop(0, `rgba(${color},1)`); gradient.addColorStop(0.25, `rgba(${color},0.45)`); gradient.addColorStop(1, `rgba(${color},0)`);
      c.fillStyle = gradient; c.fillRect(0, 0, 96, 96); this.sprites.set(color, sprite);
    }
    ctx.globalAlpha = clamp(alpha, 0, 1); ctx.drawImage(sprite, p.x - radius, p.y - radius, radius * 2, radius * 2); ctx.globalAlpha = 1;
  }
  private handle(ctx: CanvasRenderingContext2D, p: Point, radius: number, color: string) {
    ctx.strokeStyle = `rgba(${color},0.7)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(${color},0.85)`; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, TAU); ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    if (this.echoes.length && !this.dust.length) {
      // Stable filaments: repeated flashes illuminate the same landscape.
      for (let i = 0; i < 430; i++) {
        const t = i / 430, branch = i % 5;
        const seed = (Math.sin(i * 127.1 + 45.7) * 43758.5453) % 1;
        this.dust.push({ x: t * this.width, y: (0.14 + branch * 0.16) * this.height + Math.sin(t * 14 + branch) * 65 + seed * 25, seed, size: 12 + Math.abs(seed) * 24 });
      }
    }
    for (const gas of this.dust) {
      const light = this.echoAt(gas);
      if (light > 0.015) this.glow(ctx, gas, gas.size, gas.seed > 0 ? '153,190,232' : '225,175,131', light * 0.3);
    }
    for (const cloud of this.clouds) {
      const fade = smooth((this.time - cloud.born) / 1.1) * smooth((70 - this.time + cloud.born) / 4);
      for (const gas of cloud.particles) {
        let starlight = 0;
        for (const star of this.babyStars) starlight += Math.max(0, 1 - distance(gas, star) / 200) * 0.25;
        const pulse = 0.85 + 0.15 * Math.sin(this.time * 0.8 + gas.seed * 15);
        this.glow(ctx, gas, gas.size, gas.seed > 0.65 ? '93,168,203' : gas.seed > 0.3 ? '124,92,172' : '224,151,159', fade * pulse * (0.11 + this.echoAt(gas) * 0.35 + starlight));
      }
      // Wisps provide structure inside the translucent gas.
      ctx.lineWidth = 0.65;
      for (let i = 1; i < cloud.particles.length; i += 5) {
        const a = cloud.particles[i - 1], b = cloud.particles[i];
        if (distance(a, b) > 65) continue;
        ctx.strokeStyle = `rgba(184,164,223,${fade * 0.13})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cloud.x, a.y, b.x, b.y); ctx.stroke();
      }
      if (this.drag?.kind === 'cloud' && this.drag.cloud === cloud) {
        const progress = clamp(cloud.compression / 4.4, 0, 1);
        ctx.strokeStyle = 'rgba(230,206,164,0.65)'; ctx.lineWidth = 1.4; ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, 23, -Math.PI / 2, -Math.PI / 2 + progress * TAU); ctx.stroke();
      }
    }
    for (const star of this.babyStars) {
      const fade = smooth((55 - this.time + star.born) / 3);
      this.glow(ctx, star, 85, '255,205,146', 0.65 * fade);
      this.glow(ctx, star, star.size * 2, '255,246,222', fade);
      ctx.strokeStyle = `rgba(255,235,198,${fade * 0.7})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(star.x - 20, star.y); ctx.lineTo(star.x + 20, star.y);
      ctx.moveTo(star.x, star.y - 20); ctx.lineTo(star.x, star.y + 20); ctx.stroke();
    }
    for (const galaxy of this.galaxies) {
      const fade = smooth((this.time - galaxy.born) / 0.7) * smooth((80 - this.time + galaxy.born) / 4);
      for (const star of galaxy.particles) {
        const rgb = star.family === 0 ? '166,201,250' : '244,189,132';
        if (star.seed > 0.72) this.glow(ctx, star, 7, rgb, fade * 0.16);
        ctx.fillStyle = `rgba(${rgb},${fade * (0.35 + star.seed * 0.5)})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }
      for (const core of galaxy.cores) {
        this.glow(ctx, core, 42 * core.mass, '255,219,169', fade * 0.65);
        this.glow(ctx, core, 9, '255,250,231', fade);
        if (distance(this.pointer, core) < 55) this.handle(ctx, core, 23, '230,214,184');
      }
    }
    for (const plasma of this.plasmas) {
      const flash = Math.max(0, 1 - (this.time - plasma.flash) / 0.7);
      this.glow(ctx, plasma, 42 + flash * 35, '255,160,83', 0.75);
      this.glow(ctx, plasma, 13, '255,238,199', 1);
      for (let index = 0; index < 2; index++) {
        const points = this.arcPoints(plasma, index);
        const color = index === 0 ? '255,172,95' : '162,187,255';
        for (let strand = 0; strand < 4; strand++) {
          ctx.strokeStyle = `rgba(${color},${strand === 0 ? 0.22 : 0.55})`; ctx.lineWidth = strand === 0 ? 9 : 0.9;
          ctx.beginPath();
          points.forEach((p, i) => {
            const wobble = Math.sin(i * 1.2 + this.time * 9 + strand * 2) * Math.sin(i / 32 * Math.PI) * strand * 0.85;
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x + wobble, p.y - wobble);
          }); ctx.stroke();
        }
        for (let dot = 0; dot < 5; dot++) {
          const p = points[Math.floor(((this.time * 0.65 + dot / 5) % 1) * 32)];
          this.glow(ctx, p, 5, '255,235,207', 0.85);
        }
        this.handle(ctx, plasma.tips[index], 8, color);
      }
    }
    if (this.lamp) {
      const tip = this.beamTip();
      ctx.save(); ctx.translate(this.lamp.x, this.lamp.y); ctx.rotate(this.lamp.angle);
      const light = ctx.createLinearGradient(0, 0, 650, 0);
      light.addColorStop(0, 'rgba(255,222,147,0.12)'); light.addColorStop(1, 'rgba(255,222,147,0)');
      ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(650, -245); ctx.lineTo(650, 245); ctx.closePath(); ctx.fill(); ctx.restore();
      this.glow(ctx, this.lamp, 35, '255,224,150', 0.75); this.glow(ctx, this.lamp, 9, '255,247,212', 1);
      ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(244,221,163,0.45)'; ctx.beginPath(); ctx.moveTo(this.lamp.x, this.lamp.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); ctx.setLineDash([]);
      this.handle(ctx, tip, 7, '244,221,163');
    }
    for (const sail of this.sails) {
      this.drawTrail(ctx, sail, [160,207,228]);
      ctx.save(); ctx.translate(sail.x, sail.y); ctx.rotate(sail.angle);
      const sheen = 0.45 + 0.4 * Math.abs(Math.cos(sail.angle - this.time * 0.15));
      ctx.fillStyle = `rgba(179,212,232,${sheen * sail.life})`; ctx.strokeStyle = 'rgba(237,237,219,0.85)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(0, -15); ctx.lineTo(11, 0); ctx.lineTo(0, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -15); ctx.lineTo(0, 15); ctx.stroke(); ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const hole of this.holes) this.drawHole(ctx, hole);
    if (this.portal) {
      this.drawPortal(ctx, this.portal.a, '103,214,233', this.portal.pulseA, false);
      this.drawPortal(ctx, this.portal.b, '183,151,250', this.portal.pulseB, true);
    }
    if (this.pending) {
      const next = this.inside(this.pointer, 54), valid = this.validPair(this.pending, next);
      ctx.setLineDash([3, 8]); ctx.strokeStyle = valid ? 'rgba(170,199,241,0.35)' : 'rgba(240,135,125,0.6)';
      ctx.beginPath(); ctx.moveTo(this.pending.x, this.pending.y); ctx.lineTo(next.x, next.y); ctx.stroke(); ctx.setLineDash([]);
      this.drawPortal(ctx, this.pending, '103,214,233', -100, false);
      ctx.globalAlpha = 0.6; this.drawPortal(ctx, next, valid ? '183,151,250' : '240,135,125', -100, true); ctx.globalAlpha = 1;
    } else if (this.tool !== 'hand' && this.pointer.x > 0) {
      this.handle(ctx, this.inside(this.pointer), this.tool === 'portal' ? 43 : 19, '195,204,227');
    }
    if (this.drag?.kind === 'wave') {
      ctx.strokeStyle = 'rgba(163,205,241,0.65)'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(this.drag.start.x, this.drag.start.y); ctx.lineTo(this.pointer.x, this.pointer.y); ctx.stroke();
      this.handle(ctx, this.drag.start, 12, '163,205,241');
    }
    ctx.restore();
  }

  private drawHole(ctx: CanvasRenderingContext2D, hole: Hole) {
    const fade = smooth((this.time - hole.born) / 0.6) * smooth((40 - this.time + hole.born) / 2);
    const feeding = Math.max(0, 1 - (this.time - hole.fed) / 1.5);
    ctx.save(); ctx.translate(hole.x, hole.y); ctx.scale(fade, fade);
    this.glow(ctx, point(0, 0), 80, '236,151,79', 0.35 + feeding * 0.3);
    // Lensed rear disk and a dark horizon, with the near disk occluding it.
    ctx.strokeStyle = 'rgba(255,203,133,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -6, 31, 34, 0, Math.PI, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 3, 28, 29, 0, 0, Math.PI); ctx.stroke();
    ctx.fillStyle = '#020307'; ctx.beginPath(); ctx.arc(0, 0, 23, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,234,193,0.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.stroke();
    for (let ring = 0; ring < 10; ring++) {
      const radius = 29 + ring * 3.7;
      ctx.strokeStyle = `rgba(255,${220 - ring * 9},${151 - ring * 7},${0.64 - ring * 0.045})`;
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 3, radius, radius * 0.22, -0.12, 0, Math.PI); ctx.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const angle = i * TAU / 24 + this.time * (1.2 + (i % 3) * 0.18), r = 34 + (i % 4) * 8;
      const p = point(Math.cos(angle) * r, Math.sin(angle) * r * 0.22 + 3);
      if (p.y < 0 && Math.hypot(p.x, p.y) < 24) continue;
      this.glow(ctx, p, 3.2, '255,218,157', 0.6);
    }
    ctx.restore();
  }

  private drawPortal(ctx: CanvasRenderingContext2D, p: Point, color: string, pulseAt: number, reverse: boolean) {
    const pulse = Math.max(0, 1 - Math.abs(this.time - pulseAt) / 0.45);
    const scale = 1 + pulse * (reverse ? 0.12 : -0.12);
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(scale, scale);
    this.glow(ctx, point(0, 0), 70, color, 0.28 + pulse * 0.25);
    const well = ctx.createRadialGradient(5, -4, 3, 0, 0, 43);
    well.addColorStop(0, '#050715'); well.addColorStop(0.7, '#101227'); well.addColorStop(1, `rgba(${color},0.4)`);
    ctx.fillStyle = well; ctx.beginPath(); ctx.arc(0, 0, 43, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${color},0.95)`; ctx.lineWidth = 2; ctx.stroke();
    // Nested spirals recede into a stable, generous circular aperture.
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let i = 0; i < 65; i++) {
        const t = i / 64, r = 4 + 36 * t;
        const angle = arm * TAU / 3 + t * 5 + this.time * (reverse ? -0.9 : 0.9);
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.strokeStyle = `rgba(${color},0.23)`; ctx.lineWidth = 1.2; ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const angle = i * TAU / 14 + this.time * (reverse ? -0.5 : 0.5);
      this.glow(ctx, point(Math.cos(angle) * 44, Math.sin(angle) * 44), 4, color, 0.6);
    }
    ctx.restore();
  }

  dispose() { this.sprites.clear(); this.clear(); }
}
