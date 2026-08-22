import { useEffect, useRef, type RefObject } from 'react';

interface StarfieldProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  dim?: boolean;
}

interface Star {
  x: number;
  y: number;
  z: number;
  tint: number;
  phase: number;
  ox: number;
  oy: number;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  tint: number;
  curve: number;
}

interface CometOptions {
  fromLeft?: boolean;
  big?: boolean;
  speed?: number;
  angle?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Wave {
  x: number;
  y: number;
  r: number;
  alpha: number;
  delay: number;
}

interface Flash {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

interface SketchState {
  nodes: { x: number; y: number }[];
  lastAdd: number;
}

interface AmbientNode {
  ox: number;
  oy: number;
  phase: number;
}

/* Constelación ambiental: clúster autónomo que cubre el cielo de borde a borde.
   Deriva más lento que las estrellas (cielo profundo) y vive en ciclos:
   aparece, titila y se despide, renaciendo por el lado derecho. */
interface AmbientConstellation {
  x: number;
  y: number;
  nodes: AmbientNode[];
  edges: [number, number][];
  t0: number;
  dur: number;
}

const TINTS = [
  [245, 241, 232],
  [201, 168, 106],
  [143, 208, 255],
];

export const StarfieldCanvas = ({ scrollRef, dim = false }: StarfieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const dimRef = useRef(dim);
  dimRef.current = dim;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let width = 0;
    let height = 0;
    let vscale = 1;
    let stars: Star[] = [];
    let comets: Comet[] = [];
    let waves: Wave[] = [];
    let flashes: Flash[] = [];
    let sparkles: { x: number; y: number; vx: number; vy: number; life: number; tint: number; size: number; grav: number }[] = [];
    let raf = 0;
    let time = 0;
    let scrollVel = 0;
    let lastScroll = scrollRef.current?.scrollTop ?? 0;
    let dimLevel = 0;
    let running = true;
    let disposed = false;
    let nextComet = time + 4 + Math.random() * 5;
    let nextTease = time + 7;
    let lastSpace = -999;
    let warpBoost = 0;
    let charge: { x: number; y: number; t0: number; dx: number; dy: number } | null = null;
    let sketch: SketchState | null = null;
    let ambient: AmbientConstellation[] = [];
    // El hero es zona sin constelaciones: puntero sobre él y su banda en viewport
    let overHero = false;
    let heroH = 0;
    const trailLast = { x: -9999, y: -9999 };

    // Capa frontal para meteoros y destellos: viajan por encima del museo
    const fxCtx = fxRef.current?.getContext('2d') ?? null;

    const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const seed = () => {
      const count = Math.round((width * height) / 5200);
      stars = Array.from({ length: Math.min(560, Math.max(180, count)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0.25 + Math.random() * 0.75,
        tint: Math.random() < 0.82 ? 0 : Math.random() < 0.5 ? 1 : 2,
        phase: Math.random() * Math.PI * 2,
        ox: 0,
        oy: 0,
      }));
    };

    const sizeCanvas = (target: HTMLCanvasElement | null) => {
      if (!target) return;
      target.width = Math.round(width * dpr);
      target.height = Math.round(height * dpr);
      // Caja CSS idéntica al espacio lógico de dibujo: sin esto, un canvas
      // fixed con inset:0 usa su tamaño intrínseco (backing) y con zoom o
      // dpr != 1 los efectos se dibujan desplazados respecto al puntero.
      target.style.width = `${width}px`;
      target.style.height = `${height}px`;
      target.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /* ---- Constelaciones ambientales ---- */

    const ambientCount = () => Math.min(9, Math.max(5, Math.round(width / 320)));

    const makeAmbientShape = () => {
      const count = 3 + Math.floor(Math.random() * 4);
      const nodes: AmbientNode[] = Array.from({ length: count }, () => {
        const ang = Math.random() * Math.PI * 2;
        const rad = 18 + Math.random() * 72;
        return {
          ox: Math.cos(ang) * rad,
          oy: Math.sin(ang) * rad * 0.72,
          phase: Math.random() * Math.PI * 2,
        };
      });
      // Cada nodo se une a sus 1-2 vecinos más cercanos, sin aristas repetidas
      const seen = new Set<string>();
      const edges: [number, number][] = [];
      const addEdge = (i: number, j: number) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        edges.push(i < j ? [i, j] : [j, i]);
      };
      nodes.forEach((node, i) => {
        nodes
          .map((other, j) => ({ j, d: Math.hypot(node.ox - other.ox, node.oy - other.oy) }))
          .filter(({ j }) => j !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, Math.random() < 0.55 ? 2 : 1)
          .forEach(({ j }) => addEdge(i, j));
      });
      return { nodes, edges };
    };

    const spawnAmbient = (x: number, stagger = false) => {
      const shape = makeAmbientShape();
      ambient.push({
        x,
        y: height * (0.06 + Math.random() * 0.66),
        ...shape,
        t0: stagger ? time - Math.random() * 8 : time,
        dur: 14 + Math.random() * 10,
      });
    };

    // Columnas equidistantes con jitter: cobertura de borde a borde desde el arranque
    const seedAmbient = () => {
      ambient = [];
      const count = ambientCount();
      for (let i = 0; i < count; i += 1) {
        const x = ((i + 0.5) / count) * width + (Math.random() - 0.5) * (width / count) * 0.5;
        spawnAmbient(x, true);
      }
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      // Releer el dpr: cambia con el zoom de página y al mover la ventana
      // entre monitores con distinto DPI.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      vscale = Math.min(width, height) / 900;
      // Altura del hero: define la banda del cielo sin constelaciones
      const heroEl = document.querySelector('.mo-hero');
      heroH = heroEl instanceof HTMLElement ? heroEl.offsetHeight : height;
      sizeCanvas(canvas);
      sizeCanvas(fxRef.current);
      seed();
      seedAmbient();
    };

    const onScroll = () => {
      const top = scrollRef.current?.scrollTop ?? 0;
      scrollVel = scrollVel * 0.82 + (top - lastScroll) * 0.18;
      lastScroll = top;
    };

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      overHero = Boolean((event.target as HTMLElement | null)?.closest('.mo-hero'));
      if (mouse.sx < -999) {
        mouse.sx = mouse.x;
        mouse.sy = mouse.y;
      }
      // Arrastre de la resortera
      if (charge) {
        charge.dx = event.clientX;
        charge.dy = event.clientY;
      }
    };

    /* ---- Meteoros ---- */

    const spawnComet = (options?: CometOptions) => {
      const big = options?.big ?? false;
      const speed = (options?.speed ?? (big ? 8.5 + Math.random() * 3.5 : 6 + Math.random() * 5)) * vscale;
      let vx: number;
      let vy: number;
      if (options?.vx !== undefined && options?.vy !== undefined) {
        vx = options.vx * vscale;
        vy = options.vy * vscale;
      } else {
        const angleDeg = options?.angle ?? (18 + Math.random() * 16);
        const angle = (Math.PI / 180) * angleDeg;
        const fromLeft = options?.fromLeft ?? Math.random() < 0.5;
        vx = (fromLeft ? 1 : -1) * Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }
      comets.push({
        x: options?.x ?? (options?.fromLeft === false ? width + 40 : -40),
        y: options?.y ?? height * (0.05 + Math.random() * 0.55),
        vx,
        vy,
        life: 1,
        size: (big ? 3 + Math.random() : 1.7 + Math.random() * 1.1) * (0.75 + 0.25 * vscale),
        tint: big ? 1 : Math.random() < 0.55 ? 0 : Math.random() < 0.55 ? 1 : 2,
        curve: big ? 0.02 + Math.random() * 0.03 : (Math.random() - 0.35) * 0.05,
      });
    };

    const spawnSparkleBurst = (
      x: number,
      y: number,
      count: number,
      power: number,
    ) => {
      for (let s = 0; s < count; s += 1) {
        const ang = (Math.PI * 2 * s) / count + Math.random() * 0.5;
        const spd = (1.4 + Math.random() * (3.4 + power * 3)) * vscale;
        const ember = Math.random() < 0.24;
        sparkles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 1,
          tint: Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2,
          size: ember ? 3 + Math.random() * 1.2 : 1.3 + Math.random() * 1.4,
          grav: ember ? 0.05 : 0.018,
        });
      }
      if (sparkles.length > 160) sparkles.splice(0, sparkles.length - 160);
    };

    /* Lluvia caótica: cada pulsación elige un escenario distinto */
    const showerSide = () => {
      const side = Math.random() < 0.5;
      spawnComet({ fromLeft: side, big: true, angle: 14 + Math.random() * 14 });
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i += 1) {
        window.setTimeout(() => {
          if (disposed || document.visibilityState !== 'visible') return;
          spawnComet({
            fromLeft: Math.random() < 0.8 ? side : !side,
            speed: 4 + Math.random() * 6,
            // Dispersión amplia: toda la altura y ángulos variados
            angle: 8 + Math.random() * 30,
            y: height * (0.02 + Math.random() * 0.85),
          });
        }, 130 + i * (140 + Math.random() * 240));
      }
    };

    const showerCross = () => {
      spawnComet({ fromLeft: true, big: true, angle: 16 + Math.random() * 10 });
      window.setTimeout(() => {
        if (disposed || document.visibilityState !== 'visible') return;
        spawnComet({ fromLeft: false, big: true, angle: 18 + Math.random() * 10 });
      }, 260 + Math.random() * 200);
      for (let i = 0; i < 4; i += 1) {
        window.setTimeout(() => {
          if (disposed || document.visibilityState !== 'visible') return;
          const side = i % 2 === 0;
          spawnComet({
            fromLeft: side,
            speed: 4.5 + Math.random() * 5.5,
            angle: 8 + Math.random() * 28,
            y: height * (0.05 + Math.random() * 0.85),
          });
        }, 150 + i * (180 + Math.random() * 220));
      }
    };

    const showerRadial = () => {
      const cx = width * (0.2 + Math.random() * 0.6);
      const cy = height * (0.1 + Math.random() * 0.4);
      flashes.push({ x: cx, y: cy, r: 3, alpha: 0.45 });
      spawnSparkleBurst(cx, cy, 18 + Math.floor(Math.random() * 8), 0.7);
      const shots = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i <= shots; i += 1) {
        const ang = Math.random() * Math.PI * 2;
        spawnComet({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * 7.5,
          vy: Math.abs(Math.sin(ang)) * 4.5 + 1.5,
          big: true,
        });
      }
    };

    const showerBurst = () => {
      const side = Math.random() < 0.5;
      const baseAngle = 15 + Math.random() * 8;
      const count = 8 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i += 1) {
        window.setTimeout(() => {
          if (disposed || document.visibilityState !== 'visible') return;
          spawnComet({
            fromLeft: side,
            speed: 8 + Math.random() * 5,
            angle: baseAngle + (Math.random() - 0.5) * 18,
            y: height * (0.02 + Math.random() * 0.85),
          });
        }, i * (70 + Math.random() * 90));
      }
    };

    const launchShower = () => {
      window.dispatchEvent(new CustomEvent('mo-shower'));
      const pick = Math.floor(Math.random() * 4);
      if (pick === 0) showerSide();
      else if (pick === 1) showerCross();
      else if (pick === 2) showerRadial();
      else showerBurst();
    };

    /* ---- Constelación dibujable ---- */

    const nearestStarPos = (x: number, y: number, maxDist: number) => {
      let bestX = x;
      let bestY = y;
      let bestD = maxDist;
      for (const star of stars) {
        const d = Math.hypot(star.x - x, star.y - y);
        if (d < bestD) {
          bestD = d;
          bestX = star.x;
          bestY = star.y;
        }
      }
      return { x: bestX, y: bestY };
    };

    const addSketchNode = (x: number, y: number) => {
      if (!sketch || time - sketch.lastAdd > 6) {
        sketch = { nodes: [], lastAdd: time };
      }
      if (sketch.nodes.length >= 16) return;
      sketch.nodes.push(nearestStarPos(x, y, 30));
      sketch.lastAdd = time;
    };

    /* ---- Interacción ---- */

    const onDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const interactive = Boolean(target?.closest('button, a, input, textarea'));
      const x = event.clientX;
      const y = event.clientY;

      if (!interactive && event.shiftKey) {
        addSketchNode(x, y);
        return;
      }

      // Clic cargado tipo resortera: mantener presionado y arrastrar en
      // cualquier sala del museo (los controles interactivos quedan fuera)
      if (!interactive) {
        charge = { x, y, t0: time, dx: x, dy: y };
      }
    };

    const releaseCharge = () => {
      if (!charge) return;
      const power = Math.min(1, (time - charge.t0) / 1.1);
      const x = charge.x;
      const y = charge.y;

      // Vector de resortera: tirar hacia atrás lanza hacia adelante
      const px = x - charge.dx;
      const py = y - charge.dy;
      const pull = Math.hypot(px, py);

      charge = null;
      if (power < 0.06) return;

      // Explosión residual en el punto de origen
      flashes.push({ x, y, r: 4, alpha: 0.2 + 0.3 * power });
      waves.push({ x, y, r: 6, alpha: 0.35 + 0.5 * power, delay: 0 });
      spawnSparkleBurst(x, y, Math.round(8 + 14 * power), power * 0.7);

      if (pull < 24) {
        // Sin arrastre: supernova clásica proporcional a la carga
        if (power > 0.25) waves.push({ x, y, r: 0, alpha: 0.25 + 0.6 * power, delay: 0.14 });
        spawnSparkleBurst(x, y, Math.round(10 + 20 * power), power);
        const launched = power > 0.8 ? 2 : 1;
        for (let i = 0; i < launched; i += 1) {
          spawnComet({
            x,
            y,
            fromLeft: Math.random() < 0.5,
            speed: 7.5 + Math.random() * 4,
            angle: -(6 + Math.random() * 20),
            big: power > 0.6,
          });
        }
        if (power > 0.85) launchShower();
        return;
      }

      // Lanzamiento del meteorito en sentido contrario al arrastre
      const norm = pull || 1;
      const speed = Math.min(17, 5 + pull * 0.075 + power * 4);
      spawnComet({
        x,
        y,
        vx: (px / norm) * speed,
        vy: (py / norm) * speed,
        big: true,
      });
    };

    const onUp = () => {
      releaseCharge();
    };

    const onWarp = () => {
      warpBoost = Math.min(34, warpBoost + 22);
    };

    const spawnAmbientComet = () => {
      const fromLeft = Math.random() < 0.5;
      const speed = (7 + Math.random() * 5) * vscale;
      const angle = (Math.PI / 180) * (18 + Math.random() * 16);
      comets.push({
        x: fromLeft ? -40 : width + 40,
        y: Math.random() * height * 0.45,
        vx: (fromLeft ? 1 : -1) * Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: (1.7 + Math.random()) * (0.75 + 0.25 * vscale),
        tint: Math.random() < 0.82 ? 0 : 1,
        curve: (Math.random() - 0.35) * 0.05,
      });
    };

    const onVisibility = () => {
      running = !document.hidden;
      if (running) {
        lastScroll = scrollRef.current?.scrollTop ?? 0;
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
      }
    };

    const frame = () => {
      if (!running) return;
      time += 0.016;
      scrollVel *= 0.92;
      warpBoost *= 0.93;
      const targetDim = dimRef.current ? 0.22 : 1;
      dimLevel += (targetDim - dimLevel) * 0.06;

      mouse.sx += (mouse.x - mouse.sx) * 0.055;
      mouse.sy += (mouse.y - mouse.sy) * 0.055;
      const parX = mouse.sx > -999 ? (mouse.sx / width - 0.5) * 2 : 0;
      const parY = mouse.sy > -999 ? (mouse.sy / height - 0.5) * 2 : 0;

      // Modo atracción: si nadie pulsa espacio, el cielo lanza un meteoro de cortesía
      if (
        time > nextTease &&
        time - lastSpace > 20 &&
        (scrollRef.current?.scrollTop ?? 0) < window.innerHeight * 0.9
      ) {
        spawnAmbientComet();
        nextTease = time + 9 + Math.random() * 7;
      }

      ctx.clearRect(0, 0, width, height);
      fxCtx?.clearRect(0, 0, width, height);
      const warp = Math.min(40, Math.abs(scrollVel) * 0.055 + warpBoost);
      const dir = Math.sign(scrollVel) || 1;

      const drawn: { x: number; y: number; z: number }[] = [];

      /* ---- Capa trasera: estrellas ---- */
      for (const star of stars) {
        star.x -= 0.05 * star.z;
        star.y -= scrollVel * 0.045 * star.z;
        if (star.x < -60) star.x = width + 60;
        if (star.x > width + 60) star.x = -60;
        if (star.y < -80) star.y = height + 80;
        if (star.y > height + 80) star.y = -80;

        // Gravedad sutil del cursor: las estrellas cercanas se inclinan hacia él.
        // Usa la posición REAL del puntero (sin suavizar) para que el halo
        // gravitacional viva exactamente bajo el punto, nunca detrás.
        if (mouse.x > -999) {
          const gx = mouse.x - star.x;
          const gy = mouse.y - star.y;
          const gd = Math.hypot(gx, gy);
          const radiusG = 170;
          if (gd < radiusG && gd > 0.001) {
            const f = Math.pow(1 - gd / radiusG, 2) * 12;
            star.ox += ((gx / gd) * f - star.ox) * 0.09;
            star.oy += ((gy / gd) * f - star.oy) * 0.09;
          } else {
            star.ox *= 0.88;
            star.oy *= 0.88;
          }
        } else {
          star.ox *= 0.88;
          star.oy *= 0.88;
        }

        const px = star.x + star.ox + parX * star.z * 16;
        const py = star.y + star.oy + parY * star.z * 11;

        const [r, g, b] = TINTS[star.tint];
        const twinkle = 0.55 + 0.45 * Math.sin(time * (0.6 + star.z) + star.phase);
        const alpha = (0.16 + star.z * 0.5) * twinkle * dimLevel;
        const size = star.z * 1.5 + 0.3;

        if (warp > 1.2) {
          const len = warp * star.z * dir;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = size * 0.9;
          ctx.beginPath();
          ctx.moveTo(px, py - len * 0.5);
          ctx.lineTo(px, py + len * 0.5);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }

        if (mouse.x > -999) {
          const dc = Math.hypot(px - mouse.x, py - mouse.y);
          if (dc < 230 && drawn.length < 26) drawn.push({ x: px, y: py, z: star.z });
        }
      }

      /* ---- Capa frontal: chispas, supernova, meteoros, ondas, carga, boceto ---- */
      if (fxCtx) {
        // Constelación del cursor: viaja por encima del museo para no lavarse
        // contra la nebulosa del hero (mismo lenguaje que el boceto shift+clic).
        // Sobre el hero se apaga: allí manda la estela fugaz del cursor.
        const degree = new Map<number, number>();

        if (drawn.length > 1 && dimLevel > 0.4 && !overHero) {
          for (let i = 0; i < drawn.length; i += 1) {
            for (let j = i + 1; j < drawn.length; j += 1) {
              if ((degree.get(i) ?? 0) >= 3 || (degree.get(j) ?? 0) >= 3) continue;
              const dx = drawn[i].x - drawn[j].x;
              const dy = drawn[i].y - drawn[j].y;
              const d = Math.hypot(dx, dy);
              if (d < 126) {
                degree.set(i, (degree.get(i) ?? 0) + 1);
                degree.set(j, (degree.get(j) ?? 0) + 1);
                const near = 1 - Math.min(1, Math.hypot((drawn[i].x + drawn[j].x) / 2 - mouse.x, (drawn[i].y + drawn[j].y) / 2 - mouse.y) / 230);
                const lineAlpha = Math.min(1, 0.95 * (1 - d / 126) * near * dimLevel);
                fxCtx.lineCap = 'round';
                fxCtx.strokeStyle = `rgba(226,204,158,${(lineAlpha * 0.42).toFixed(3)})`;
                fxCtx.lineWidth = 4.4;
                fxCtx.beginPath();
                fxCtx.moveTo(drawn[i].x, drawn[i].y);
                fxCtx.lineTo(drawn[j].x, drawn[j].y);
                fxCtx.stroke();
                fxCtx.strokeStyle = `rgba(250,240,214,${lineAlpha.toFixed(3)})`;
                fxCtx.lineWidth = 2;
                fxCtx.beginPath();
                fxCtx.moveTo(drawn[i].x, drawn[i].y);
                fxCtx.lineTo(drawn[j].x, drawn[j].y);
                fxCtx.stroke();
              }
            }
          }
        }

        if (!overHero) {
          for (const node of drawn) {
            const pulse = 0.75 + 0.25 * Math.sin(time * 2.2 + node.x);
            fxCtx.fillStyle = `rgba(232,208,160,${(0.42 * pulse * dimLevel).toFixed(3)})`;
            fxCtx.beginPath();
            fxCtx.arc(node.x, node.y, node.z * 6.2, 0, Math.PI * 2);
            fxCtx.fill();
          }
        }

        // Constelaciones ambientales: presencia sutil de borde a borde.
        // Mueren en pantalla o salen por la izquierda y renacen a la derecha.
        // En la banda del hero se desvanecen: esa zona queda solo con estrellas.
        const wantedAmbient = ambientCount();
        ambient = ambient.filter((c) => time - c.t0 < c.dur && c.x > -140);
        while (ambient.length < wantedAmbient) {
          spawnAmbient(width + 60 + Math.random() * 120);
        }
        const heroBottom = heroH - (scrollRef.current?.scrollTop ?? 0);
        for (const c of ambient) {
          c.x -= 0.032;
          const age = time - c.t0;
          const heroFade = Math.max(0, Math.min(1, (c.y - heroBottom) / 140));
          const fade = Math.min(1, age / 2.2) * Math.min(1, (c.dur - age) / 2.6) * heroFade;
          if (fade <= 0.01) continue;
          // Eco magnético: el cursor aviva ligeramente la constelación cercana
          let boost = 1;
          if (mouse.x > -999) {
            const dc = Math.hypot(mouse.x - c.x, mouse.y - c.y);
            if (dc < 300) boost += 0.5 * (1 - dc / 300);
          }
          const alpha = Math.min(1, 0.3 * fade * boost * dimLevel);
          fxCtx.lineCap = 'round';
          for (const [a, b] of c.edges) {
            const ax = c.x + c.nodes[a].ox;
            const ay = c.y + c.nodes[a].oy;
            const bx = c.x + c.nodes[b].ox;
            const by = c.y + c.nodes[b].oy;
            fxCtx.strokeStyle = `rgba(226,204,158,${(alpha * 0.45).toFixed(3)})`;
            fxCtx.lineWidth = 3;
            fxCtx.beginPath();
            fxCtx.moveTo(ax, ay);
            fxCtx.lineTo(bx, by);
            fxCtx.stroke();
            fxCtx.strokeStyle = `rgba(250,240,214,${alpha.toFixed(3)})`;
            fxCtx.lineWidth = 1.2;
            fxCtx.beginPath();
            fxCtx.moveTo(ax, ay);
            fxCtx.lineTo(bx, by);
            fxCtx.stroke();
          }
          for (const node of c.nodes) {
            const nx = c.x + node.ox;
            const ny = c.y + node.oy;
            const twinkle = 0.7 + 0.3 * Math.sin(time * 1.6 + node.phase);
            const halo = fxCtx.createRadialGradient(nx, ny, 0, nx, ny, 9);
            halo.addColorStop(0, `rgba(232,208,160,${(alpha * twinkle * 0.55).toFixed(3)})`);
            halo.addColorStop(1, 'rgba(232,208,160,0)');
            fxCtx.fillStyle = halo;
            fxCtx.beginPath();
            fxCtx.arc(nx, ny, 9, 0, Math.PI * 2);
            fxCtx.fill();
            fxCtx.fillStyle = `rgba(250,244,224,${Math.min(1, alpha * twinkle * 1.3).toFixed(3)})`;
            fxCtx.beginPath();
            fxCtx.arc(nx, ny, 1.6, 0, Math.PI * 2);
            fxCtx.fill();
          }
        }

        // Destello de estrella fugaz del cursor: solo sobre el hero, donde no
        // hay constelaciones. El polvo dorado se queda atrás del movimiento.
        if (mouse.x > -999) {
          if (trailLast.x < -999) {
            trailLast.x = mouse.x;
            trailLast.y = mouse.y;
          }
          const tdx = mouse.x - trailLast.x;
          const tdy = mouse.y - trailLast.y;
          const moved = Math.hypot(tdx, tdy);
          if (overHero && moved > 15) {
            trailLast.x = mouse.x;
            trailLast.y = mouse.y;
            const burst = moved > 90 ? 2 : 1;
            for (let s = 0; s < burst; s += 1) {
              sparkles.push({
                x: mouse.x + (Math.random() - 0.5) * 7,
                y: mouse.y + (Math.random() - 0.5) * 7,
                vx: -tdx * 0.018 + (Math.random() - 0.5) * 0.5,
                vy: -tdy * 0.018 + (Math.random() - 0.5) * 0.5,
                life: 0.9,
                tint: Math.random() < 0.6 ? 1 : 0,
                size: 1.1 + Math.random() * 1.6,
                grav: 0.01,
              });
            }
            if (sparkles.length > 160) sparkles.splice(0, sparkles.length - 160);
          } else if (!overHero) {
            // Fuera del hero se mantiene sincronizado: sin ráfaga al reentrar
            trailLast.x = mouse.x;
            trailLast.y = mouse.y;
          }
        }

        sparkles = sparkles.filter((sp) => sp.life > 0.02);
        for (const sp of sparkles) {
          sp.x += sp.vx;
          sp.y += sp.vy;
          sp.vx *= 0.965;
          sp.vy = sp.vy * 0.965 + sp.grav;
          sp.life -= sp.size > 2.6 ? 0.018 : 0.024;
          const [sr, sg, sb] = TINTS[sp.tint];
          fxCtx.fillStyle = `rgba(${sr},${sg},${sb},${Math.min(1, sp.life * 1.15 * dimLevel).toFixed(3)})`;
          fxCtx.beginPath();
          fxCtx.arc(sp.x, sp.y, sp.size * sp.life + 0.5, 0, Math.PI * 2);
          fxCtx.fill();
        }

        flashes = flashes.filter((flash) => flash.alpha > 0.02);
        for (const flash of flashes) {
          flash.r += 3.4;
          flash.alpha *= 0.87;
          const gradient = fxCtx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, flash.r * 2.4);
          gradient.addColorStop(0, `rgba(255,250,235,${flash.alpha.toFixed(3)})`);
          gradient.addColorStop(0.45, `rgba(230,204,150,${(flash.alpha * 0.5).toFixed(3)})`);
          gradient.addColorStop(1, 'rgba(230,204,150,0)');
          fxCtx.fillStyle = gradient;
          fxCtx.beginPath();
          fxCtx.arc(flash.x, flash.y, flash.r * 2.4, 0, Math.PI * 2);
          fxCtx.fill();
        }

        if (time > nextComet) {
          spawnAmbientComet();
          nextComet = time + 6 + Math.random() * 6;
        }
        comets = comets.filter((comet) => comet.life > 0);
        for (const comet of comets) {
          comet.x += comet.vx;
          comet.y += comet.vy;
          comet.vy += comet.curve;
          comet.life -= comet.size > 2.4 ? 0.009 : 0.012;
          if (comet.x < -140 || comet.x > width + 140 || comet.y > height + 90) comet.life = 0;
          const tailLen = 9 + comet.size * 4.5;
          const tailX = comet.x - comet.vx * tailLen;
          const tailY = comet.y - comet.vy * tailLen;
          const [tr, tg, tb] = TINTS[comet.tint];
          const gradient = fxCtx.createLinearGradient(comet.x, comet.y, tailX, tailY);
          gradient.addColorStop(0, `rgba(${tr},${tg},${tb},${0.95 * comet.life * dimLevel})`);
          gradient.addColorStop(1, 'rgba(245,241,232,0)');
          fxCtx.strokeStyle = gradient;
          fxCtx.lineWidth = comet.size * 1.6;
          fxCtx.lineCap = 'round';
          fxCtx.beginPath();
          fxCtx.moveTo(comet.x, comet.y);
          fxCtx.lineTo(tailX, tailY);
          fxCtx.stroke();
          fxCtx.fillStyle = `rgba(255,252,244,${comet.life * dimLevel})`;
          fxCtx.beginPath();
          fxCtx.arc(comet.x, comet.y, comet.size, 0, Math.PI * 2);
          fxCtx.fill();
          const halo = fxCtx.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, comet.size * 7);
          halo.addColorStop(0, `rgba(230,204,150,${(comet.size > 2.4 ? 0.5 : 0.22) * comet.life * dimLevel})`);
          halo.addColorStop(1, 'rgba(230,204,150,0)');
          fxCtx.fillStyle = halo;
          fxCtx.beginPath();
          fxCtx.arc(comet.x, comet.y, comet.size * 7, 0, Math.PI * 2);
          fxCtx.fill();
        }

        waves = waves.filter((wave) => wave.alpha > 0.02);
        for (const wave of waves) {
          if (wave.delay > 0) {
            wave.delay -= 0.016;
            continue;
          }
          wave.r += 7;
          wave.alpha *= 0.94;
          if (wave.r <= 0) continue;
          fxCtx.strokeStyle = `rgba(201,168,106,${(wave.alpha * 0.5 * dimLevel).toFixed(3)})`;
          fxCtx.lineWidth = 1.2;
          fxCtx.beginPath();
          fxCtx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
          fxCtx.stroke();
        }

        // Resortera: anillo de carga + línea de mira + trayectoria proyectada
        if (charge) {
          const p = Math.min(1, (time - charge.t0) / 1.1);
          const ringR = 24 + p * 12;
          const glow = 0.5 + 0.35 * p + (p >= 1 ? 0.15 * Math.sin(time * 9) : 0);
          fxCtx.strokeStyle = `rgba(230,204,158,${glow.toFixed(3)})`;
          fxCtx.lineWidth = 2.4;
          fxCtx.lineCap = 'round';
          fxCtx.beginPath();
          fxCtx.arc(charge.x, charge.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
          fxCtx.stroke();
          fxCtx.strokeStyle = `rgba(245,241,232,${(0.16 * dimLevel).toFixed(3)})`;
          fxCtx.lineWidth = 1;
          fxCtx.beginPath();
          fxCtx.arc(charge.x, charge.y, ringR, 0, Math.PI * 2);
          fxCtx.stroke();

          const pullX = charge.x - charge.dx;
          const pullY = charge.y - charge.dy;
          const pullDist = Math.hypot(pullX, pullY);

          if (pullDist >= 6) {
            // Línea de arrastre punteada (hacia atrás)
            fxCtx.setLineDash([5, 7]);
            fxCtx.strokeStyle = `rgba(245,241,232,${(0.4 * dimLevel).toFixed(3)})`;
            fxCtx.lineWidth = 1.4;
            fxCtx.beginPath();
            fxCtx.moveTo(charge.x, charge.y);
            fxCtx.lineTo(charge.dx, charge.dy);
            fxCtx.stroke();

            // Trayectoria proyectada del lanzamiento (sentido contrario)
            const normP = pullDist || 1;
            const projLen = Math.min(260, 60 + pullDist * 1.5);
            fxCtx.setLineDash([]);
            const grad = fxCtx.createLinearGradient(charge.x, charge.y, charge.x + (pullX / normP) * projLen, charge.y + (pullY / normP) * projLen);
            grad.addColorStop(0, `rgba(230,204,158,${(0.55 * dimLevel).toFixed(3)})`);
            grad.addColorStop(1, 'rgba(230,204,158,0)');
            fxCtx.strokeStyle = grad;
            fxCtx.lineWidth = 2.2;
            fxCtx.beginPath();
            fxCtx.moveTo(charge.x, charge.y);
            fxCtx.lineTo(charge.x + (pullX / normP) * projLen, charge.y + (pullY / normP) * projLen);
            fxCtx.stroke();
          } else {
            // Sin arrastre: partículas convergiendo al punto de carga
            if (sparkles.length < 150) {
              const ang = Math.random() * Math.PI * 2;
              const d = (70 + Math.random() * 50) * vscale;
              const spd = (1.6 + p * 1.6) * vscale;
              sparkles.push({
                x: charge.x + Math.cos(ang) * d,
                y: charge.y + Math.sin(ang) * d,
                vx: -Math.cos(ang) * spd,
                vy: -Math.sin(ang) * spd,
                life: 0.85,
                tint: 1,
                size: 1.4 + Math.random(),
                grav: 0,
              });
            }
          }
        }

        // Constelación dibujada: líneas doradas entre nodos, se desvanece sola
        if (sketch && sketch.nodes.length > 0) {
          const fade = Math.max(0, Math.min(1, 1 - (time - sketch.lastAdd - 4.5) / 1.5));
          if (fade <= 0) {
            sketch = null;
          } else {
            fxCtx.lineCap = 'round';
            for (let i = 1; i < sketch.nodes.length; i += 1) {
              const a = sketch.nodes[i - 1];
              const b = sketch.nodes[i];
              fxCtx.strokeStyle = `rgba(226,204,158,${(0.4 * fade * dimLevel).toFixed(3)})`;
              fxCtx.lineWidth = 3.6;
              fxCtx.beginPath();
              fxCtx.moveTo(a.x, a.y);
              fxCtx.lineTo(b.x, b.y);
              fxCtx.stroke();
              fxCtx.strokeStyle = `rgba(250,244,224,${(0.85 * fade * dimLevel).toFixed(3)})`;
              fxCtx.lineWidth = 1.4;
              fxCtx.beginPath();
              fxCtx.moveTo(a.x, a.y);
              fxCtx.lineTo(b.x, b.y);
              fxCtx.stroke();
            }
            sketch.nodes.forEach((node, index) => {
              const twinkleN = 0.7 + 0.3 * Math.sin(time * 3 + index * 1.3);
              const haloS = fxCtx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 11);
              haloS.addColorStop(0, `rgba(232,208,160,${(0.5 * fade * twinkleN * dimLevel).toFixed(3)})`);
              haloS.addColorStop(1, 'rgba(232,208,160,0)');
              fxCtx.fillStyle = haloS;
              fxCtx.beginPath();
              fxCtx.arc(node.x, node.y, 11, 0, Math.PI * 2);
              fxCtx.fill();
              fxCtx.fillStyle = `rgba(255,250,238,${(fade * dimLevel).toFixed(3)})`;
              fxCtx.beginPath();
              fxCtx.arc(node.x, node.y, 2.4, 0, Math.PI * 2);
              fxCtx.fill();
            });
          }
        }
      }

      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        charge = null;
        sketch = null;
        return;
      }
      if (event.code !== 'Space') return;
      // Ignorar auto-repetición y ráfagas encadenadas: una lluvia por pulsación
      if (event.repeat) return;
      if (time - lastSpace < 0.65) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea')) return;
      if ((scrollRef.current?.scrollTop ?? 0) > window.innerHeight * 0.9) return;
      event.preventDefault();
      lastSpace = time;
      launchShower();
    };
    const onComet = () => spawnAmbientComet();
    window.addEventListener('mo-comet', onComet);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mo-warp', onWarp);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('blur', onUp);
    const scrollEl = scrollRef.current;
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mo-comet', onComet);
      window.removeEventListener('mo-warp', onWarp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onUp);
      scrollEl?.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [scrollRef]);

  return (
    <>
      <canvas ref={canvasRef} className="mo-starfield" aria-hidden="true" />
      <canvas ref={fxRef} className="mo-starfx" aria-hidden="true" />
    </>
  );
};
