import { angle, axisDrag, clamp, dist, glow, hit, line, orb, planet, polar, ring, segmentDistance, TAU, translate, type FamilyModule, type Phenomenon, type Point } from './shared';

export const light: FamilyModule = {
  create(f) {
    f.radius = 110;
    f.handles = f.id === 'aurora' || f.id === 'interference' ? [polar(f, 115, Math.PI), polar(f, 115, 0)]
      : f.id === 'eclipse' ? [polar(f, 85, 0)] : f.id === 'mirrors' ? [polar(f, 100, 0), polar(f, 155, -1.1)] : [polar(f, 110, -.5)];
    f.values = [-Math.PI / 4, Math.PI / 4, 0];
    if (f.id === 'mirrors') f.handles[1] = { x: f.x + 100, y: f.y - 140 };
    if (f.id === 'mirrors') f.handles.push(polar(f.handles[0], 38, f.values[0]), polar(f.handles[1], 38, f.values[1]));
  },
  drag(f, i, p) {
    if (i < 0) translate(f, p);
    else if (f.id === 'mirrors') {
      if (i < 2) { const dx = p.x - f.handles[i].x, dy = p.y - f.handles[i].y; f.handles[i + 2].x += dx; f.handles[i + 2].y += dy; f.handles[i] = { ...p }; }
      else { f.values[i - 2] = angle(f.handles[i - 2], p); f.handles[i] = polar(f.handles[i - 2], 38, f.values[i - 2]); }
    } else if (['aurora', 'interference', 'eclipse'].includes(f.id)) f.handles[i] = { ...p };
    else axisDrag(f, i, p);
  },
  update(f, env) {
    if (f.id === 'aurora') {
      const body = hit(f, 170, env) ?? env.plasma?.find(p => segmentDistance(p, f.handles[0], f.handles[1]) < 40);
      if (body) { f.energy = 1; f.values[2] = clamp((body.x - f.handles[0].x) / (f.handles[1].x - f.handles[0].x || 1), 0, 1); }
    }
    if (f.id === 'prism') {
      const colors = ['#ff898b', '#ffce89', '#dcf196', '#8be9d4', '#92bcff', '#c1a1f5'];
      for (let i = 0; i < colors.length; i++) env.beams.push({ a: { x: f.x, y: f.y }, b: polar(f, 620, f.angle + (i - 2.5) * .105), color: colors[i], power: .6 });
    }
    if (f.id === 'mirrors') env.beams.push({ a: { x: f.x - 100, y: f.y }, b: { x: f.x + 900, y: f.y }, color: '#fff1ae', power: .85 });
  },
  draw(f, c, quality) {
    const t = f.age;
    if (f.id === 'aurora') {
      const [a, b] = f.handles; const n = Math.round(90 * quality);
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
        const fold = Math.sin(u * 14 + t * .7) * 22 + Math.sin(u * 27 - t * .4) * 8;
        const h = 55 + Math.sin(u * 8 + t * .5) * 25;
        const color = i % 3 === 0 ? '#ad91ed' : i % 3 === 1 ? '#74e6c2' : '#80bded';
        const g = c.createLinearGradient(x, y - h + fold, x, y + 35 + fold);
        g.addColorStop(0, color + '00'); g.addColorStop(.7, color + '40'); g.addColorStop(1, color + '00');
        c.strokeStyle = g; c.lineWidth = Math.max(2, dist(a, b) / n * 1.4); c.beginPath(); c.moveTo(x, y - h + fold); c.quadraticCurveTo(x + 14, y + fold, x - 5, y + 35 + fold); c.stroke();
        if (i % 3 === 0) glow(c, { x, y: y + fold }, 13, color, .25 + f.energy * Math.exp(-(((u - f.values[2]) * 9) ** 2)) * .65);
      }
    } else if (f.id === 'eclipse') {
      const moon = f.handles[0], alignment = Math.exp(-((dist(f, moon) / 32) ** 2));
      glow(c, f, 105, '#ffcc83', .45); orb(c, f, 39, '#ffd19b');
      for (let i = 0; i < 90 * quality; i++) {
        const a = i / (90 * quality) * TAU; const points = Array.from({ length: 14 }, (_, j) => polar(f, 40 + j * (3 + alignment * 3), a + Math.sin(j * .28 + t + a * 4) * .045));
        line(c, points, i % 2 ? '#ffd697' : '#ffad83', .7, .15 + alignment * .55);
      }
      planet(c, moon, 40, '#242b41');
      const edge = polar(f, 41, angle(f, moon) + Math.PI);
      if (dist(f, moon) < 50) glow(c, edge, 20, '#ffebb9', (1 - alignment) * .8);
    } else if (f.id === 'lens') {
      const r = f.radius;
      for (let i = 0; i < 28 * quality; i++) {
        const a = i * 2.399, radius = r * (.65 + (i % 7) * .05);
        ring(c, f, radius, i % 2 ? '#a1c6ff' : '#d9baff', .88, .2, .35, a + t * .025, a + .15 + .003 * r + t * .025);
        const p = polar(f, radius, a); glow(c, p, 5, '#c7d6ff', .6);
      }
      ring(c, f, r, '#8fa6e7', 1, 0, .3);
      glow(c, f, 22, '#8c92d8', .2);
    } else if (f.id === 'prism') {
      line(c, [polar(f, 190, f.angle + Math.PI), f], '#f4eee2', 8, .045);
      line(c, [polar(f, 190, f.angle + Math.PI), f], '#f4eee2', 1, .55);
      const vertices = Array.from({ length: 3 }, (_, i) => polar(f, 41, f.angle + i * TAU / 3));
      c.save(); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#1b2345cc'; c.beginPath(); c.moveTo(vertices[0].x, vertices[0].y); vertices.forEach(p => c.lineTo(p.x, p.y)); c.closePath(); c.fill(); c.restore();
      line(c, [...vertices, vertices[0]], '#c9bbf5', 1.5, .85); vertices.forEach(p => line(c, [p, f], '#96cced', 1, .4));
      glow(c, f, 28, '#9caeff', .3);
    } else if (f.id === 'interference') {
      const [a, b] = f.handles, span = dist(a, b), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, rot = angle(a, b);
      for (let i = 0; i < 13; i++) {
        const r = ((i * 16 + t * 22) % 205) + 4;
        ring(c, a, r, '#76ccdf', 1, 0, (1 - r / 215) * .24); ring(c, b, r, '#bea5f1', 1, 0, (1 - r / 215) * .24);
      }
      for (let j = -7; j <= 7; j++) {
        const pts: Point[] = [];
        for (let k = -30; k <= 30; k++) { const v = k * 4, u = j * 1700 / (span + 40) * Math.sqrt(1 + v * v / 10000); pts.push({ x: mid.x + u * Math.cos(rot) - v * Math.sin(rot), y: mid.y + u * Math.sin(rot) + v * Math.cos(rot) }); }
        line(c, pts, '#bce9ed', j === 0 ? 2 : 1, .16 + .12 * Math.sin(t * 3 + j) ** 2);
      }
      glow(c, a, 24, '#81dfef'); glow(c, b, 24, '#bca1f2');
    } else {
      glow(c, { x: f.x - 100, y: f.y }, 18, '#ffe0a0');
      f.handles.slice(0, 2).forEach((p, i) => {
        line(c, [polar(p, 36, f.values[i]), polar(p, 36, f.values[i] + Math.PI)], '#91aebc', 6, .55);
        line(c, [polar(p, 36, f.values[i]), polar(p, 36, f.values[i] + Math.PI)], '#d4f4f4', 1.5, .95);
        line(c, [p, f.handles[i + 2]], '#a9c8cd', 1, .4);
      });
    }
  },
};

/** Each branch is bounded to four reflections. A tiny offset prevents self hits. */
export function reflectBeams(beams: import('./shared').Beam[], mirrors: Phenomenon[]) {
  const output: import('./shared').Beam[] = [];
  for (const beam of beams.slice(0, 40)) {
    let a = beam.a, direction = angle(beam.a, beam.b), remaining = dist(beam.a, beam.b), power = beam.power;
    for (let bounce = 0; bounce <= 4 && remaining > 1; bounce++) {
      let nearest = remaining; let surface: number | null = null;
      const dx = Math.cos(direction), dy = Math.sin(direction);
      for (const f of mirrors) for (let i = 0; i < 2; i++) {
        const center = f.handles[i], tangent = f.values[i], sx = Math.cos(tangent), sy = Math.sin(tangent);
        const cross = dx * sy - dy * sx; if (Math.abs(cross) < .0001) continue;
        const ox = center.x - a.x, oy = center.y - a.y;
        const t = (ox * sy - oy * sx) / cross, u = (ox * dy - oy * dx) / cross;
        if (t > .5 && t < nearest && Math.abs(u) < 36) { nearest = t; surface = tangent; }
      }
      const b = polar(a, nearest, direction); output.push({ a, b, power, color: beam.color });
      if (surface === null) break;
      remaining -= nearest; direction = 2 * surface - direction; a = polar(b, 1, direction); power *= .78;
    }
  }
  return output;
}
