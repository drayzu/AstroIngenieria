import { angle, axisDrag, clamp, dist, glow, grain, hit, line, orb, planet, polar, pushTrail, ring, TAU, translate, type FamilyModule } from './shared';

export const matter: FamilyModule = {
  create(f, random) {
    f.radius = 110; f.values = [.35, 0, 0];
    f.handles = f.id === 'resonance' ? [polar(f, 60, 0), polar(f, 100, 2), polar(f, 140, 4)]
      : f.id === 'tidal' ? [polar(f, 135, -.5)] : [polar(f, 115, .35)];
    if (f.id === 'resonance') { f.values = [60, 100, 140]; f.grains = [...f.handles.map((p, i) => grain(p, i, 4)), grain(f, 0)]; }
    else for (let i = 0; i < (f.id === 'meteors' ? 70 : 150); i++) {
      const a = random() * TAU, r = 65 + random() * 115;
      const p = f.id === 'tidal' ? f.handles[0] : polar(f, r, a);
      const g = grain(p, random(), 1 + random() * 2.8); g.vx = -Math.sin(a) * .25; g.vy = Math.cos(a) * .25;
      if (f.id === 'meteors' || f.id === 'asteroids' && i >= 110) g.life = 0;
      f.grains.push(g);
    }
  },
  drag(f, i, p) {
    if (f.id === 'accretion') { translate(f, p); return; }
    if (i < 0) { translate(f, p); return; }
    if (f.id === 'resonance') { f.values[i] = clamp(dist(f, p), 25, 220); f.handles[i] = { ...p }; return; }
    if (f.id === 'tidal') { f.handles[0] = { ...p }; return; }
    axisDrag(f, i, p);
    if (f.id === 'rings') f.values[0] = clamp(Math.abs(p.y - f.y) / 115, .12, .85);
    if (f.id === 'asteroids') for (const g of f.grains) {
      const u = g.seed; g.x = f.x + (p.x - f.x) * u + Math.sin(u * 80) * 12; g.y = f.y + (p.y - f.y) * u + Math.cos(u * 61) * 18; g.trail = [];
    }
  },
  update(f, env) {
    if (f.id === 'rings') {
      const body = hit(f, 135, env);
      if (body) { f.energy = 1; f.values[1] = angle(f, body); }
    } else if (f.id === 'accretion') {
      for (const g of f.grains) if (g.life > 0 && dist(g, f) < 19 + f.values[1] * .22) {
        g.life = 0; f.values[1]++; f.energy = 1;
      }
    } else if (f.id === 'tidal' && f.values[1] === 0 && dist(f, f.handles[0]) < 78) {
      f.values[1] = 1; f.energy = 1;
      f.grains.forEach((g, i) => { const p = polar(f.handles[0], 10 * env.random(), i * 2.4); Object.assign(g, p); const a = angle(f, p); g.vx = -Math.sin(a) * (1 + env.random()); g.vy = Math.cos(a) * (1 + env.random()); });
    }
    if (f.id === 'resonance') {
      f.grains.slice(0, 3).forEach((g, i) => {
        const r = f.values[i], a = f.age * Math.pow(85 / r, 1.5) + i * 2;
        Object.assign(g, polar(f, r, a)); f.handles[i] = { x: g.x, y: g.y }; pushTrail(g, 150);
      });
      const tracer = f.grains[3];
      tracer.x = f.x + (f.grains[0].x - f.x) * .9 + (f.grains[1].x - f.x) * .65;
      tracer.y = f.y + (f.grains[0].y - f.y) * .9 + (f.grains[1].y - f.y) * .65;
      pushTrail(tracer, 900); return;
    }
    for (let i = 0; i < f.grains.length; i++) {
      const g = f.grains[i];
      if (f.id === 'meteors') {
        if (g.x < -100 || g.x > env.width + 100 || g.y < -100 || g.y > env.height + 100) g.life = 0;
        if (g.life <= 0 && f.age < 65 && i < 70 * env.quality && (f.age * 15 + i) % 9 < 1) {
          const p = polar(f, (g.seed - .5) * f.radius * 2, f.angle + Math.PI / 2);
          env.recycleBody(g);
          Object.assign(g, p); g.size = 1 + g.seed * 2.8; g.vx = Math.cos(f.angle) * (3 + g.seed * 6); g.vy = Math.sin(f.angle) * (3 + g.seed * 6); g.life = 1; g.trail = [];
        }
        if (g.life > 0) { const prev = env.moveBody(g, env.dt); if (dist(prev, g.trail.at(-1) ?? prev) > 80) g.trail = []; pushTrail(g, 12); g.life -= env.dt * .22; }
      } else if (f.id === 'asteroids') {
        if (g.life <= 0) continue;
        const body = hit(g, 8, env);
        if (body) {
          g.vx += body.vx * env.dt * 4; g.vy += body.vy * env.dt * 4;
          if (g.size > 1.8) {
            // Reuse a dormant fragment slot: impacts never allocate unbounded bodies.
            const fragment = f.grains.find(p => p.life <= 0);
            if (fragment) {
              env.recycleBody(fragment);
              Object.assign(fragment, { x: g.x + 4, y: g.y - 3, life: 1, size: g.size * .48, vx: g.vx + .7, vy: g.vy - .5 });
              g.size *= .55; g.vx -= .3; g.vy += .4;
            }
          }
          f.energy = 1;
        }
        if (g.life <= 0) continue;
        env.moveBody(g, env.dt);
      } else if (f.id === 'tidal' && f.values[1]) {
        const dx = f.x - g.x, dy = f.y - g.y, d = Math.hypot(dx, dy);
        const force = 9000 / Math.pow(d * d + 900, 1.5);
        g.vx += dx * force * env.dt; g.vy += dy * force * env.dt;
        g.x += g.vx * env.dt * 60; g.y += g.vy * env.dt * 60; pushTrail(g, 20);
      } else if (f.id === 'accretion' && g.life > 0) { g.x += g.vx * env.dt * 10; g.y += g.vy * env.dt * 10; }
    }
  },
  draw(f, c, quality) {
    if (f.id === 'rings') {
      const squash = f.values[0];
      const drawHalf = (front: boolean) => {
        for (let i = 0; i < 36 * quality; i++) {
          const r = 65 + i / quality * 1.8;
          const start = front ? 0 : Math.PI, end = front ? Math.PI : TAU;
          const gap = (f.values[1] + TAU) % TAU;
          if (f.energy > .05 && gap > start && gap < end) {
            ring(c, f, r, '#d9bd99', squash, -.18, .2, start, Math.max(start, gap - f.energy * .12));
            ring(c, f, r, '#d9bd99', squash, -.18, .2, Math.min(end, gap + f.energy * .12), end);
          } else ring(c, f, r, i % 3 ? '#d9bd99' : '#8fadd1', squash, -.18, .13 + (i % 4) * .04, start, end);
        }
      };
      drawHalf(false); planet(c, f, 43, '#d6b293');
      c.save(); c.beginPath(); c.arc(f.x, f.y, 42, 0, TAU); c.clip();
      for (let i = -3; i <= 3; i++) line(c, [{ x: f.x - 45, y: f.y + i * 12 }, { x: f.x + 45, y: f.y + i * 12 - 12 }], '#9f896e', 5, .15);
      c.restore(); drawHalf(true);
      if (f.energy > .01) for (let i = 0; i < 18; i++) {
        const a = f.values[1] + i * .03 + (1 - f.energy) * .6, p = polar(f, 90 + i * 2, a);
        p.y = f.y + (p.y - f.y) * squash; glow(c, p, 5, '#ebd7b0', f.energy * .5);
      }
    } else if (f.id === 'accretion') {
      f.grains.forEach((g, i) => { if (g.life > 0 && i % Math.ceil(1 / quality) === 0) orb(c, g, g.size, '#b9a7a0', .65); });
      const r = 16 + f.values[1] * .22; planet(c, f, r, '#bb9c84');
      for (let i = 0; i < 5; i++) line(c, [polar(f, r * .3, i * 1.3), polar(f, r * .7, i * 1.3 + .2), polar(f, r * .95, i * 1.3)], '#ffbc7d', 1, .2 + f.energy * .7);
      for (let i = 0; i < Math.min(4, Math.floor(f.values[1] / 12)); i++) { const p = polar(f, r + 18 + i * 10, f.age * .7 + i * 2); planet(c, p, 3, '#c7c9da'); }
    } else if (f.id === 'tidal') {
      planet(c, f, 40, '#8f9fc8'); ring(c, f, 77, '#9a99ca', 1, 0, .15);
      if (!f.values[1]) { c.save(); const moon = f.handles[0], stretch = Math.max(1, 110 / dist(f, moon)); c.translate(moon.x, moon.y); c.rotate(angle(f, moon)); c.scale(stretch, 1 / Math.sqrt(stretch)); planet(c, { x: 0, y: 0 }, 14, '#cdc5cc'); c.restore(); }
      else f.grains.forEach((g, i) => { if (i % Math.ceil(1 / quality) === 0) { line(c, g.trail, '#c8b8dc', .8, .22); orb(c, g, g.size * .65, '#d4c5df', .6); } });
    } else if (f.id === 'resonance') {
      glow(c, f, 25, '#b4ede4', .7);
      f.grains.slice(0, 3).forEach((g, i) => { ring(c, f, f.values[i], '#90babb', 1, 0, .1); line(c, g.trail, ['#8fe1df', '#b5b1f4', '#e1c68e'][i], 1, .5); glow(c, g, 13, '#b1e3df'); });
      line(c, [...f.grains.slice(0, 3), f.grains[0]], '#d2ddec', .7, .18);
      line(c, f.grains[3].trail, '#deb6e3', 1.2, .55);
    } else if (f.id === 'asteroids') {
      f.grains.forEach((g, i) => { if (g.life <= 0 || i % Math.ceil(1 / quality)) return; c.save(); c.translate(g.x, g.y); c.rotate(g.seed * TAU + f.age * .05); c.fillStyle = i % 3 ? '#998d85' : '#c6b5a0'; c.beginPath(); for (let k = 0; k < 5; k++) { const a = k * TAU / 5; c.lineTo(Math.cos(a) * g.size * 1.5, Math.sin(a) * g.size); } c.closePath(); c.fill(); c.restore(); });
    } else {
      f.grains.forEach(g => { if (g.life > 0) { line(c, g.trail, g.seed > .5 ? '#acd9fb' : '#f2d6ad', g.size * .6, g.life * .5); glow(c, g, 5 + g.size, '#afdafa', g.life * .75); } });
      line(c, [f, f.handles[0]], '#7ea8c6', 1, .2);
    }
  },
};
