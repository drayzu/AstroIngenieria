import { angle, axisDrag, clamp, dist, glow, grain, hit, line, orb, polar, pushTrail, ring, TAU, translate, type FamilyModule, type Point } from './shared';

export const stars: FamilyModule = {
  create(f, random) {
    f.radius = 110; f.angle = -.6; f.speed = .55;
    f.handles = f.id === 'kilonova' ? [polar(f, 65, Math.PI), polar(f, 65, 0)]
      : f.id === 'butterfly' ? [polar(f, 145, -.6), polar(f, 145, Math.PI - .6)] : [polar(f, 110, f.angle)];
    f.values = [0, 0, 0];
    if (f.id === 'kilonova' || f.id === 'bow') for (let i = 0; i < (f.id === 'bow' ? 90 : 200); i++) f.grains.push(grain(f, random(), .6 + random() * 1.4));
  },
  drag(f, i, p) {
    if (f.id === 'bow') { const dx = p.x - f.x, dy = p.y - f.y; f.angle = Math.atan2(dy, dx); f.speed = clamp(Math.hypot(dx, dy) * 3, 0, 250); translate(f, p); return; }
    if (i < 0) { translate(f, p); return; }
    if (f.id === 'kilonova' || f.id === 'butterfly') { f.handles[i] = { ...p }; return; }
    const prev = f.angle; axisDrag(f, i, p);
    if (f.id === 'pulsar' || f.id === 'pinwheel') f.speed = clamp(f.speed + Math.atan2(Math.sin(f.angle - prev), Math.cos(f.angle - prev)) * 2, -3, 3);
  },
  update(f, env) {
    if (f.id === 'pulsar' || f.id === 'pinwheel') {
      if (f.held < 0) f.angle += f.speed * env.dt;
      f.handles[0] = polar(f, f.radius, f.angle);
    }
    if (f.id === 'pulsar' || f.id === 'quasar') {
      for (let i = 0; i < 2; i++) env.beams.push({ a: { x: f.x, y: f.y }, b: polar(f, f.id === 'pulsar' ? 400 : 310 + f.energy * 100, f.angle + i * Math.PI), color: f.color, power: .4 + f.energy });
      if (f.id === 'quasar' && hit(f, 30, env)) f.energy = 1;
    }
    if (f.id === 'butterfly' && hit(f, 160, env)) f.energy = 1;
    if (f.id === 'kilonova') {
      if (!f.values[0] && dist(f.handles[0], f.handles[1]) < 30) {
        f.values[0] = 1; f.values[1] = f.age; f.energy = 1;
        f.x = (f.handles[0].x + f.handles[1].x) / 2; f.y = (f.handles[0].y + f.handles[1].y) / 2;
        f.grains.forEach((g, i) => { Object.assign(g, { x: f.x, y: f.y }); const a = i * 2.399; const v = 20 + g.seed * 150; g.vx = Math.cos(a) * v; g.vy = Math.sin(a) * v; });
      }
      if (f.values[0]) for (const g of f.grains) { g.x += g.vx * env.dt; g.y += g.vy * env.dt; g.vx *= Math.exp(-env.dt * .23); g.vy *= Math.exp(-env.dt * .23); pushTrail(g, 28); }
    }
    if (f.id === 'bow') {
      f.speed *= Math.exp(-env.dt * 1.3);
      env.gas(f, { x: Math.cos(f.angle) * f.speed, y: Math.sin(f.angle) * f.speed }, 125);
      for (let i = 0; i < f.grains.length; i++) {
        const g = f.grains[i]; g.life -= env.dt * .4;
        if (g.life <= 0 || f.age < .1) { Object.assign(g, polar(f, 28 + g.seed * 18, f.angle + (g.seed - .5) * 2)); g.life = 1; g.trail = []; }
        g.x -= Math.cos(f.angle) * env.dt * (15 + f.speed * .5); g.y -= Math.sin(f.angle) * env.dt * (15 + f.speed * .5); g.y += Math.sin(f.age * 2 + i) * env.dt * 12;
      }
    }
  },
  draw(f, c, quality) {
    if (f.id === 'pulsar' || f.id === 'quasar') {
      const quasar = f.id === 'quasar';
      for (let side = 0; side < 2; side++) for (let j = 0; j < (quasar ? 12 : 7) * quality; j++) {
        const pts: Point[] = [];
        for (let k = 0; k < 45; k++) {
          const d = k * (quasar ? 7 : 9), offset = Math.sin(k * .24 - f.age * 5 + j) * (quasar ? 5 : 1) + (j / quality - (quasar ? 6 : 3)) * d * .013;
          const p = polar(f, d, f.angle + side * Math.PI); pts.push({ x: p.x - Math.sin(f.angle) * offset, y: p.y + Math.cos(f.angle) * offset });
        }
        line(c, pts, f.color, quasar ? 1.3 : .8, .1 + f.energy * .2);
      }
      for (let i = 0; i < 10; i++) ring(c, f, 18 + i * 3, quasar ? '#efc89f' : '#adc8ee', .3, f.angle + Math.PI / 2, .15);
      glow(c, f, 48 + f.energy * 15, f.color, .6); orb(c, f, quasar ? 7 : 5, '#e1ddf5');
    } else if (f.id === 'kilonova') {
      if (!f.values[0]) {
        line(c, f.handles, '#d6b89a', 1, .15);
        f.handles.forEach((p, i) => { glow(c, p, 33, i ? '#e4b9f3' : '#aebffd', .75); ring(c, p, 18, '#bcb5e4', .5, f.age * (i ? 1 : -1), .55); orb(c, p, 4, '#e5dbea'); });
      } else {
        const age = f.age - f.values[1], fade = Math.exp(-age * .07);
        for (let i = 0; i < f.grains.length; i += Math.ceil(1 / quality)) {
          const g = f.grains[i]; line(c, g.trail, i % 3 ? '#d5a869' : '#c78a90', .8, fade * .35); glow(c, g, 5 + age * .3, '#efc98c', fade * .35);
          if (i % 11 === 0) line(c, [g, { x: g.x + Math.sin(i) * 18, y: g.y + Math.cos(i) * 20 }, { x: g.x + Math.sin(i) * 28, y: g.y + Math.cos(i + 1) * 30 }], '#e3c58a', .7, fade * .4);
        }
        glow(c, f, 38, '#f3c882', Math.exp(-age * .3)); ring(c, f, age * 85 + 10, '#dcc595', .7, 0, Math.exp(-age));
      }
    } else if (f.id === 'pinwheel') {
      const opening = clamp(f.radius / 110, .3, 2);
      for (let arm = 0; arm < 3; arm++) for (let ribbon = 0; ribbon < 10 * quality; ribbon++) {
        const pts: Point[] = [];
        for (let i = 0; i < 120; i++) { const u = i / 120; pts.push(polar(f, 12 + u * 195 * opening, f.angle + arm * TAU / 3 - u * 9 / opening + ribbon * .026 * (1 + u))); }
        line(c, pts, arm % 2 ? '#dca5ce' : '#e9b197', .7, .12);
        if (ribbon % 3 === 0) for (let i = 12; i < pts.length; i += 6) glow(c, pts[i], 4 + i * .055, arm % 2 ? '#b991d1' : '#daa091', .16 * (1 - i / 150));
      }
      glow(c, f, 25, '#f1c39c', .8); glow(c, f.handles[0], 17, '#b6c9f1', .7);
    } else if (f.id === 'butterfly') {
      f.handles.forEach((end, side) => {
        const a = angle(f, end), length = dist(f, end);
        for (let ribbon = 0; ribbon < 28 * quality; ribbon++) {
          const phase = ribbon / (28 * quality) * TAU, pts: Point[] = [];
          for (let k = 0; k <= 40; k++) { const u = k / 40, r = Math.sin(Math.PI * u) * length * .38 * Math.sin(phase + u * 2 + f.age * .1); const p = polar(f, u * length, a); pts.push({ x: p.x - Math.sin(a) * r, y: p.y + Math.cos(a) * r + f.energy * Math.sin(u * 19 + f.age * 8) * 10 }); }
          line(c, pts, side ? '#d5a3cf' : '#8cbcd7', 2, .1);
          if (ribbon % 4 === 0) for (let k = 8; k < pts.length - 5; k += 5) glow(c, pts[k], 12 + Math.sin(k / 40 * Math.PI) * 13, side ? '#b185bf' : '#739fbd', .11);
        }
        glow(c, polar(f, length * .55, a), 60, side ? '#b185bf' : '#739fbd', .14);
      });
      for (let i = 0; i < 8; i++) ring(c, f, 10 + i * 3, '#e5b1a4', .3, angle(f, f.handles[0]) + Math.PI / 2, .25);
      glow(c, f, 17, '#ead4c1', .75);
    } else {
      f.grains.forEach((g, i) => { if (i % Math.ceil(1 / quality) === 0) glow(c, g, 9, '#80c9ce', Math.max(0, g.life) * .15); });
      for (let j = 0; j < 7; j++) {
        const pts: Point[] = []; for (let i = -35; i <= 35; i++) { const u = i / 35 * 1.3, r = (35 + j * 4) / (.7 + Math.cos(u) * .5); const p = polar(f, r, f.angle + u); pts.push(p); }
        line(c, pts, j % 2 ? '#b8b6ed' : '#83e5e3', 1, .1 + f.speed / 1200);
      }
      glow(c, f, 22, '#b8e9e5', .8);
    }
  },
};
