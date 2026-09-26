import { angle, axisDrag, clamp, dist, glow, grain, hit, line, orb, planet, polar, pushTrail, ring, TAU, translate, type FamilyModule, type Point } from './shared';

export const structures: FamilyModule = {
  create(f, random) {
    f.radius = 105; f.values = Array.from({ length: 12 }, () => 0); f.speed = 0;
    f.handles = f.id === 'web' ? Array.from({ length: 7 }, (_, i) => polar(f, i ? 90 + random() * 40 : 0, i * TAU / 6))
      : f.id === 'elevator' ? [polar(f, 150, -Math.PI / 2)] : [polar(f, 105, -.4)];
    if (f.id === 'swarm') for (let i = 0; i < 45; i++) f.grains.push(grain(polar(f, 20 + random() * 70, random() * TAU), random(), 2));
    if (f.id === 'engine') f.grains.push(grain(f, 0));
  },
  drag(f, i, p) {
    if (f.id === 'swarm') { f.energy = clamp(dist(f, p) / 35, 0, 1); translate(f, p); return; }
    if (i < 0) { translate(f, p); return; }
    if (f.id === 'web' || f.id === 'elevator') { f.energy = 1; f.handles[i] = { ...p }; return; }
    axisDrag(f, i, p);
    if (f.id === 'vortex') f.energy = clamp((110 - f.radius) / 85, 0, 1);
  },
  update(f, env) {
    if (f.id === 'web') {
      for (let i = 0; i < f.handles.length; i++) if (hit(f.handles[i], 30, env) && f.pulses.length < 8 && f.phase <= 0) { f.pulses.push({ age: 0, node: i }); f.phase = .2; }
      if (f.held >= 0 && f.phase <= 0 && f.pulses.length < 8) { f.pulses.push({ age: 0, node: f.held }); f.phase = .35; }
      f.pulses.forEach(p => p.age += env.dt); f.pulses = f.pulses.filter(p => p.age < 2); f.phase -= env.dt;
    }
    if (f.id === 'swarm') f.grains.forEach((g, i) => {
      const target = polar(f, 24 + Math.floor(i / 9) * 13, i * TAU / 9 + f.age * .25);
      g.vx += ((target.x - g.x) * 2 + Math.sin(i * 2.4) * f.energy * 110) * env.dt;
      g.vy += ((target.y - g.y) * 2 + Math.cos(i * 2.4) * f.energy * 110) * env.dt;
      g.vx *= Math.exp(-env.dt * 1.6); g.vy *= Math.exp(-env.dt * 1.6); g.x += g.vx * env.dt; g.y += g.vy * env.dt;
    });
    if (f.id === 'dyson') {
      const closed = 12 - f.values.reduce((a, b) => a + b, 0); f.phase = Math.min(1, f.phase + env.dt * closed / 60);
      env.beams.push({ a: f, b: polar(f, 300 + f.phase * 250, f.angle), color: '#f5d88d', power: f.phase * closed / 12 });
    }
    if (f.id === 'engine') {
      const velocity = { x: -Math.cos(f.angle) * 16, y: -Math.sin(f.angle) * 16 };
      if (f.held === -2) translate(f, { x: clamp(f.x + velocity.x * env.dt, 45, env.width - 45), y: clamp(f.y + velocity.y * env.dt, 45, env.height - 45) });
      const g = f.grains[0]; Object.assign(g, { x: f.x, y: f.y }); pushTrail(g, 180); env.gas(f, velocity, 100);
    }
    if (f.id === 'vortex' && f.released && f.energy > .1) {
      const n = Math.floor(f.energy * 12); for (let i = 0; i < n; i++) { const a = f.angle + (i - n / 2) * .06; env.jet(f, { x: Math.cos(a) * (4 + f.energy * 6), y: Math.sin(a) * (4 + f.energy * 6) }); }
      f.energy = 0; f.radius = 105; f.handles[0] = polar(f, f.radius, f.angle);
    }
  },
  draw(f, c, quality) {
    if (f.id === 'web') {
      for (let i = 0; i < f.handles.length; i++) for (let j = i + 1; j < f.handles.length; j++) {
        if (i !== 0 && j !== i + 1 && !(i === 1 && j === 6)) continue;
        const a = f.handles[i], b = f.handles[j];
        for (let branch = 0; branch < 3; branch++) {
          const pts: Point[] = []; for (let k = 0; k <= 25; k++) { const u = k / 25; pts.push({ x: a.x + (b.x - a.x) * u + Math.sin(u * Math.PI) * Math.sin(i + j + branch) * 14, y: a.y + (b.y - a.y) * u + Math.sin(u * Math.PI * 2 + branch) * Math.sin(u * Math.PI) * 10 }); }
          line(c, pts, branch ? '#8b9acb' : '#99d8e5', branch ? .7 : 1.4, .22);
        }
        for (const pulse of f.pulses) {
          const lag = pulse.node === i || pulse.node === j ? 0 : .5, u = (pulse.age - lag) * .9;
          if (u > 0 && u < 1) glow(c, { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, 12, '#b3e8fb', .8);
        }
      }
      f.handles.forEach((p, i) => glow(c, p, i ? 18 : 28, '#9bcce7', .65));
    } else if (f.id === 'swarm') {
      ring(c, f, 18, '#a3e0d3', 1, 0, .4);
      f.grains.forEach((g, i) => {
        c.save(); c.translate(g.x, g.y); c.rotate(angle(g, f)); c.fillStyle = '#9eaeba'; c.fillRect(-3, -2, 6, 4); c.fillStyle = i % 2 ? '#5c879c' : '#b6bb9f'; c.fillRect(-7, -1, 4, 2); c.fillRect(3, -1, 4, 2); c.restore();
        if (i % 3 === 0) glow(c, g, 5, '#c6e3df', .3);
      });
    } else if (f.id === 'dyson') {
      glow(c, f, 65, '#f1c578', .5); orb(c, f, 18, '#e7bb82');
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12 + f.age * .08, open = f.values[i];
        const p = polar(f, 68 + open * 18, a);
        c.save(); c.translate(p.x, p.y); c.rotate(a + Math.PI / 2 + open * .8); c.globalCompositeOperation = 'source-over';
        c.fillStyle = open ? '#43515d' : '#29333d'; c.strokeStyle = '#b5a06a'; c.lineWidth = 1; c.fillRect(-12, -7, 24, 14); c.strokeRect(-12, -7, 24, 14); c.restore();
        if (open) line(c, [polar(f, 26, a), polar(f, 140, a)], '#f4d398', 3, .12);
      }
      ring(c, f, 68, '#bdab78', .4, .3, .3); ring(c, f, 76, '#bdab78', .4, 1.7, .2);
    } else if (f.id === 'engine') {
      line(c, f.grains[0].trail, '#e3a981', 3, .18); glow(c, f, 50, '#efbc82', .55); orb(c, f, 17, '#f2d29f');
      for (let i = 0; i < 5; i++) ring(c, f, 48 + i * 2, '#a8bbcf', 1, 0, .18, f.angle - 1.2, f.angle + 1.2);
      for (let i = -5; i <= 5; i++) line(c, [polar(f, 24, f.angle + i * .18), polar(f, 50, f.angle + i * .2)], '#eadbb4', .8, .16);
    } else if (f.id === 'elevator') {
      planet(c, f, 30, '#85a8c2'); const end = f.handles[0];
      const cable = (u: number) => ({ x: f.x + (end.x - f.x) * u + Math.sin(u * Math.PI * 4 - f.age * 6) * Math.sin(u * Math.PI) * (3 + f.energy * 17), y: f.y + (end.y - f.y) * u });
      const pts = Array.from({ length: 65 }, (_, i) => cable(i / 64)); line(c, pts, '#a7cce0', 1.2, .8);
      for (let i = 0; i < 5; i++) glow(c, cable((f.age * .08 + i / 5) % 1), 7, '#b7e5ef', .75);
      c.save(); c.translate(end.x, end.y); c.rotate(angle(f, end) + Math.PI / 2); c.fillStyle = '#8299b2'; c.fillRect(-9, -4, 18, 8); c.fillStyle = '#527b9a'; c.fillRect(-27, -7, 16, 14); c.fillRect(11, -7, 16, 14); c.restore();
    } else {
      const pinch = clamp(f.radius / 105, .25, 1.7);
      for (let j = 0; j < 32 * quality; j++) {
        const pts: Point[] = []; const phase = j / (32 * quality) * TAU;
        for (let i = 0; i <= 90; i++) { const a = i / 90 * TAU, twist = a * 3 + phase + f.age * 1.8, r = 80 * pinch + Math.cos(twist) * 21; pts.push({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * .5 + Math.sin(twist) * 24 }); }
        line(c, pts, j % 3 ? '#a696e1' : '#82c7dc', .8, .16);
      }
      glow(c, f, 60, '#9586d4', .08 + f.energy * .2);
    }
  },
};
