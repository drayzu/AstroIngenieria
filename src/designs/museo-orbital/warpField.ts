/* Campo del salto entre capítulos: velo, brillo del destino, destello y un
   túnel de estelas, todo en un solo lienzo WebGL que funciona igual dentro
   de un worker (OffscreenCanvas) que en el hilo principal. El worker es la
   vía normal: así el hiperespacio sigue fluido aunque la página se atasque
   al saltar (medir salas, montar el portal de destino, decodificar
   imágenes). Con el índice abierto, el mismo lienzo dibuja el mapa
   estelar: elegir un capítulo es zambullirse en su estrella y seguir de
   largo en el hiperespacio, sin corte. */

import { createMapScene, type MapFrame, type MapMessage } from './starMap';
import { createMapRenderer, type GlProgram, type MapLabel, type MapRenderer } from './starMapRender';

export type Rgb = [number, number, number];

export type WarpPlan = {
  // Instantes en ms de época (timeOrigin + now): el mismo reloj en ambos hilos
  t0: number;
  departMs: number;
  cruiseMs: number;
  direction: 1 | -1;
  from: Rgb;
  to: Rgb;
  // Desde el mapa estelar: índice de la estrella en la que se zambulle la
  // cámara (el velo ya está cerrado y el túnel nace de esa estrella)
  map?: number;
};

export type WarpFrame = {
  dist: number;
  expo: number;
  roll: number;
  stars: number;
  tint: Rgb;
  veil: number;
  vignette: number;
  glow: number;
  flash: number;
  flashRadius: number;
  // Punto de fuga (px CSS desde el centro, y hacia abajo): la estrella elegida
  center: [number, number];
};

export const epochNow = () => performance.timeOrigin + performance.now();

/* ---------------- Guion ---------------- */

const DEPTH = 12;
const NEAR = 0.45;
// Unidades por segundo a toda marcha, y la exposición que estira las estelas
const VMAX = 74;
const SHUTTER = 0.046;
// Al salir del hiperespacio las estelas se recogen de golpe en puntos
const SNAP_MS = 85;
export const DROP_MS = 720;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const span = (value: number, from: number, to: number) => clamp01((value - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export const createWarpClock = () => {
  let plan: WarpPlan | null = null;
  let arriveAt = Number.POSITIVE_INFINITY;
  let dist = 0;
  let last = 0;
  let speedAtArrival = VMAX;

  const start = (next: WarpPlan) => {
    plan = next;
    arriveAt = Number.POSITIVE_INFINITY;
    last = next.t0;
    speedAtArrival = VMAX;
  };

  const arrive = (at: number) => {
    arriveAt = at;
  };

  /* Devuelve el cuadro de ahora, o null cuando el salto terminó */
  const sample = (now: number): WarpFrame | null => {
    if (!plan) return null;
    const { departMs, cruiseMs, direction } = plan;
    const t = now - plan.t0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const fromMap = (plan.map ?? -1) >= 0;

    // Partida: primero puntos, luego estelas que se alargan; los bordes se
    // oscurecen antes que el centro y el velo termina de cerrarse justo
    // antes del salto real. Desde el mapa el velo ya está cerrado: las
    // estelas asoman cuando la cámara ya va lanzada hacia la estrella
    let speed = VMAX * easeIn(span(t, 0, departMs));
    let stars = fromMap ? smooth(span(t, departMs * 0.28, departMs * 0.9)) : smooth(span(t, 0, 160));
    let veil = fromMap ? 1 : easeIn(span(t, 40, departMs - 30));
    let vignette = fromMap ? 1 : smooth(span(t, 0, 300));
    let glow = 0.75 * easeOut(fromMap ? span(t, departMs * 0.42, departMs + 320) : span(t, 180, 700));
    let flash = 0;
    let flashRadius = 0.35;

    if (now < arriveAt) {
      speedAtArrival = speed;
    } else {
      const since = now - arriveAt;
      if (since > DROP_MS) {
        plan = null;
        return null;
      }
      speed = speedAtArrival * Math.exp(-since / SNAP_MS);
      stars *= 1 - smooth(span(since, 150, 470));
      veil *= 1 - easeOut(span(since, 0, 460));
      vignette *= 1 - easeOut(span(since, 60, 700));
      glow *= 1 - easeOut(span(since, 0, 380));
      // Destello del destino: sube rápido y se abre mientras se apaga
      const k = span(since, 0, 520);
      flash = 0.55 * (k < 0.22 ? easeOut(k / 0.22) : 1 - easeOut((k - 0.22) / 0.78));
      flashRadius = 0.35 + 1.15 * easeOut(k);
    }

    dist = (((dist + direction * speed * dt) % DEPTH) + DEPTH) % DEPTH;
    // El tinte pasa del capítulo de origen al de destino durante el tránsito
    const mix = smooth(span(t, departMs * 0.5, departMs + cruiseMs));
    const tint: Rgb = [
      plan.from[0] + (plan.to[0] - plan.from[0]) * mix,
      plan.from[1] + (plan.to[1] - plan.from[1]) * mix,
      plan.from[2] + (plan.to[2] - plan.from[2]) * mix,
    ];
    // Un giro lento de la cámara mientras viajamos
    const roll = direction * 0.22 * smooth(span(t, 0, departMs + cruiseMs + DROP_MS));
    return {
      dist,
      expo: direction * speed * SHUTTER,
      roll,
      stars,
      tint,
      veil,
      vignette,
      glow,
      flash,
      flashRadius,
      center: [0, 0],
    };
  };

  return { start, arrive, sample };
};

/* ---------------- Render ---------------- */

/* Fondo de pantalla completa: el velo (con alfa, tapa la página), la visión
   de túnel en los bordes y, sumando luz, el brillo del destino y el destello.
   Con el mapa abierto suma además un resplandor tenue detrás de la galaxia */
const SKY_VERTEX = /* glsl */ `
attribute vec2 aCorner;
void main() {
  gl_Position = vec4(aCorner, 0.0, 1.0);
}
`;

const SKY_FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec2 uViewport;
uniform vec2 uCenter;
uniform vec3 uTint;
uniform float uVeil;
uniform float uVignette;
uniform float uGlow;
uniform float uFlash;
uniform float uFlashRadius;
uniform float uHaze;
uniform vec2 uHazeCenter;
uniform vec3 uHazeColor;
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uViewport - uCenter) / uViewport.y;
  float r2 = dot(p, p);
  vec2 q = gl_FragCoord.xy / uViewport * 2.0 - 1.0;
  float edge = smoothstep(0.3, 1.3, length(q));
  float alpha = clamp(uVeil + (1.0 - uVeil) * uVignette * edge * 0.9, 0.0, 1.0);
  vec3 color = vec3(0.016, 0.02, 0.035) * alpha;
  color += uTint * (exp(-r2 / 0.03) * 0.5 + exp(-r2 / 0.2) * 0.16) * uGlow;
  float f2 = r2 / (uFlashRadius * uFlashRadius);
  color += mix(uTint, vec3(1.0, 0.98, 0.94), exp(-f2 * 26.0)) * exp(-f2 * 4.0) * uFlash;
  vec2 h = (gl_FragCoord.xy - 0.5 * uViewport - uHazeCenter) / uViewport.y;
  float h2 = dot(h, h);
  color += uHazeColor * (exp(-h2 / 0.045) * 0.055 + exp(-h2 / 0.3) * 0.04) * uHaze;
  // Tramado para que los degradados no formen escalones
  float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  color += (noise - 0.5) / 255.0;
  gl_FragColor = vec4(max(color, 0.0), alpha);
}
`;

/* Cada estela es un rectángulo en pantalla entre dónde está la estrella y
   dónde estaba hace una exposición. Quieta, es un punto redondo; las estelas
   largas reparten la misma luz y se atenúan (como en la intro). */
const STAR_VERTEX = /* glsl */ `
precision highp float;
attribute vec2 aCorner;
attribute vec4 aStar;
attribute vec3 aLook;
uniform float uDist;
uniform float uExpo;
uniform float uRoll;
uniform float uStars;
uniform float uFocal;
uniform vec2 uViewport;
uniform vec2 uCenter;
uniform float uDpr;
uniform vec3 uTint;
varying vec2 vLocal;
varying float vLen;
varying float vRadius;
varying vec3 vColor;

const float DEPTH = ${DEPTH.toFixed(1)};
const float NEAR = ${NEAR.toFixed(2)};

vec2 project(vec2 xy, float z) {
  return xy / z * uFocal * uViewport.y * 0.5;
}

void main() {
  float z = mod(aStar.z - uDist, DEPTH) + NEAR;
  float zTail = max(z + uExpo, NEAR * 0.6);
  float angle = aStar.x + uRoll;
  vec2 xy = vec2(cos(angle), sin(angle)) * aStar.y;
  vec2 h = project(xy, z);
  vec2 b = project(xy, zTail);
  float len = length(h - b);
  float cap = uViewport.y * 0.8;
  if (len > cap) {
    b = h - (h - b) * (cap / len);
    len = cap;
  }
  vec2 n = len > 1e-3 ? (h - b) / len : vec2(1.0, 0.0);
  vec2 side = vec2(-n.y, n.x);
  float r = aLook.z * clamp(2.4 / z, 0.55, 2.6) * uDpr * 0.5;
  vec2 p = mix(b - n * r, h + n * r, aCorner.x) + side * aCorner.y * r;
  vLocal = vec2(mix(-r, len + r, aCorner.x), aCorner.y * r);
  vLen = len;
  vRadius = r;
  // Aparecen desde la distancia y se apagan justo antes de rozar la cámara
  float far = 1.0 - smoothstep(DEPTH * 0.5, DEPTH + NEAR, z);
  float near = smoothstep(NEAR, NEAR + 0.35, z);
  vec3 base = mix(vec3(0.62, 0.74, 1.0), vec3(1.0, 0.86, 0.72), aLook.x);
  vColor = mix(base, uTint, aLook.y) * aStar.w * far * near * uStars * 1.8;
  // El túnel nace del punto de fuga: el centro, o la estrella elegida del mapa
  gl_Position = vec4((p + uCenter) / (0.5 * uViewport), 0.0, 1.0);
}
`;

export const STAR_FRAGMENT = /* glsl */ `
precision mediump float;
varying vec2 vLocal;
varying float vLen;
varying float vRadius;
varying vec3 vColor;
void main() {
  float x = clamp(vLocal.x, 0.0, vLen);
  float d = length(vec2(vLocal.x - x, vLocal.y));
  float core = 1.0 - smoothstep(vRadius * 0.2, vRadius, d);
  if (core <= 0.0) discard;
  float along = vLen > 1e-3 ? x / vLen : 1.0;
  float spread = (2.0 * vRadius) / (vLen + 2.0 * vRadius);
  float intensity = core * mix(0.08, 1.0, along * along) * (0.35 + 0.65 * spread);
  // Luz que suma sin tocar el alfa del lienzo
  gl_FragColor = vec4(vColor * intensity, 0.0);
}
`;

const FLOATS = 9;
const CORNERS = [
  [0, -1], [1, -1], [1, 1],
  [0, -1], [1, 1], [0, 1],
];

// Pseudoaleatorio con semilla: el túnel es el mismo en cada salto
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const buildStars = (count: number) => {
  const next = random(20251013);
  const data = new Float32Array(count * CORNERS.length * FLOATS);
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const theta = next() * Math.PI * 2;
    // Un tubo hueco: el punto de fuga queda limpio para el brillo del destino
    const radius = 0.22 + 2.9 * Math.pow(next(), 0.85);
    const z0 = next() * DEPTH;
    const bright = 0.3 + 0.7 * Math.pow(next(), 2.2);
    const warm = next();
    const tinted = next() < 0.34 ? 0.65 + 0.35 * next() : 0.08 + 0.2 * next();
    const width = 1.1 + 1.9 * Math.pow(next(), 3);
    for (const [cx, cy] of CORNERS) {
      data.set([cx, cy, theta, radius, z0, bright, warm, tinted, width], offset);
      offset += FLOATS;
    }
  }
  return data;
};

type Canvas = HTMLCanvasElement | OffscreenCanvas;

export const createWarpRenderer = (canvas: Canvas) => {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  }) as WebGLRenderingContext | null;
  if (!gl) return null;

  const link = (vertex: string, fragment: string): GlProgram => {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? 'warp shader');
      }
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'warp program');
    }
    const uniforms = new Map<string, WebGLUniformLocation | null>();
    return {
      program,
      attribute: (name: string) => gl.getAttribLocation(program, name),
      uniform: (name: string) => {
        if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
        return uniforms.get(name)!;
      },
    };
  };

  const sky = link(SKY_VERTEX, SKY_FRAGMENT);
  const star = link(STAR_VERTEX, STAR_FRAGMENT);
  // El mapa estelar del índice comparte lienzo: de él nace el salto. Si sus
  // shaders fallan, el salto sigue igual y el índice queda sin mapa
  let map: MapRenderer | null = null;
  try {
    map = createMapRenderer(gl, link, STAR_FRAGMENT);
  } catch {
    map = null;
  }

  // Un triángulo que cubre la pantalla
  const skyBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const starBuffer = gl.createBuffer();

  const skyCorner = sky.attribute('aCorner');
  const starAttributes: [number, number, number][] = [
    [star.attribute('aCorner'), 2, 0],
    [star.attribute('aStar'), 4, 2],
    [star.attribute('aLook'), 3, 6],
  ];

  gl.useProgram(star.program);
  // Lente de 72° verticales
  gl.uniform1f(star.uniform('uFocal'), 1 / Math.tan((72 * Math.PI) / 360));

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  // Alfa premultiplicado: el velo tapa, las estelas (alfa 0) suman luz
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  let vertices = 0;
  let starCount = 0;
  let viewport: [number, number] = [1, 1];
  let dpr = 1;

  const resize = (width: number, height: number, ratio: number) => {
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    gl.viewport(0, 0, w, h);
    viewport = [w, h];
    dpr = ratio;
    // Densidad por superficie: el teléfono dibuja menos estelas
    const count = Math.round(Math.min(1300, Math.max(520, (width * height) / 1050)));
    if (count !== starCount) {
      starCount = count;
      gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, buildStars(count), gl.STATIC_DRAW);
      vertices = count * CORNERS.length;
    }
  };

  /* Un cuadro del salto, del mapa o de los dos a la vez (la zambullida).
     Las posiciones llegan en px CSS con y hacia abajo; el lienzo usa sus
     propios px con y hacia arriba */
  const draw = (frame: WarpFrame | null, mapFrame: MapFrame | null = null) => {
    const tint = frame?.tint ?? mapFrame?.hazeColor ?? [255, 255, 255];
    const [r, g, b] = tint.map((value) => value / 255);
    const center = frame?.center ?? [0, 0];
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(sky.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
    for (const [location] of starAttributes) gl.disableVertexAttribArray(location);
    map?.release();
    gl.enableVertexAttribArray(skyCorner);
    gl.vertexAttribPointer(skyCorner, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(sky.uniform('uViewport'), viewport[0], viewport[1]);
    gl.uniform2f(sky.uniform('uCenter'), center[0] * dpr, -center[1] * dpr);
    gl.uniform3f(sky.uniform('uTint'), r, g, b);
    gl.uniform1f(sky.uniform('uVeil'), Math.max(frame?.veil ?? 0, mapFrame?.veil ?? 0));
    gl.uniform1f(sky.uniform('uVignette'), frame?.vignette ?? 0);
    gl.uniform1f(sky.uniform('uGlow'), frame?.glow ?? 0);
    gl.uniform1f(sky.uniform('uFlash'), frame?.flash ?? 0);
    gl.uniform1f(sky.uniform('uFlashRadius'), frame?.flashRadius ?? 1);
    if (mapFrame) {
      const [hr, hg, hb] = mapFrame.hazeColor.map((value) => value / 255);
      gl.uniform1f(sky.uniform('uHaze'), mapFrame.haze);
      gl.uniform2f(sky.uniform('uHazeCenter'), mapFrame.hazeCenter[0] * dpr, -mapFrame.hazeCenter[1] * dpr);
      gl.uniform3f(sky.uniform('uHazeColor'), hr, hg, hb);
    } else {
      gl.uniform1f(sky.uniform('uHaze'), 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(skyCorner);

    // El mapa queda detrás de las estelas: el túnel lo atraviesa
    if (mapFrame && map) {
      map.draw(mapFrame, viewport, dpr);
      map.release();
    }

    if (!frame || frame.stars <= 0.001) return;
    gl.useProgram(star.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
    for (const [location, size, offset] of starAttributes) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, FLOATS * 4, offset * 4);
    }
    gl.uniform2f(star.uniform('uViewport'), viewport[0], viewport[1]);
    gl.uniform2f(star.uniform('uCenter'), center[0] * dpr, -center[1] * dpr);
    gl.uniform1f(star.uniform('uDpr'), dpr);
    gl.uniform3f(star.uniform('uTint'), r, g, b);
    gl.uniform1f(star.uniform('uDist'), frame.dist);
    gl.uniform1f(star.uniform('uExpo'), frame.expo);
    gl.uniform1f(star.uniform('uRoll'), frame.roll);
    gl.uniform1f(star.uniform('uStars'), frame.stars);
    gl.drawArrays(gl.TRIANGLES, 0, vertices);
  };

  const clear = () => gl.clear(gl.COLOR_BUFFER_BIT);

  const setAtlas: MapRenderer['setAtlas'] = (image, labels, width, height) => {
    if (map) map.setAtlas(image, labels, width, height);
    else image?.close();
  };

  return { resize, draw, clear, setAtlas, hasMap: Boolean(map) };
};

export type WarpRenderer = NonNullable<ReturnType<typeof createWarpRenderer>>;

/* ---------------- Bucle compartido ---------------- */

export type WarpSize = { width: number; height: number; dpr: number };

// Atlas de los rótulos del mapa: lo dibuja el hilo principal con las fuentes del museo
export type MapLabelsMessage = {
  type: 'map-labels';
  image: ImageBitmap | null;
  labels: MapLabel[];
  width: number;
  height: number;
};

/* Mensajes del hilo principal al dibujante (worker o no) */
export type WarpMessage =
  | ({ type: 'start'; plan: WarpPlan } & WarpSize)
  | { type: 'arrive'; at: number }
  | MapMessage
  | MapLabelsMessage;

const IDLE_FRAME: WarpFrame = {
  dist: 0, expo: 0, roll: 0, stars: 1, tint: [255, 255, 255],
  veil: 0, vignette: 0, glow: 0, flash: 0, flashRadius: 1, center: [0, 0],
};

export const createWarpLoop = (
  renderer: WarpRenderer,
  schedule: (callback: () => void) => void,
  size: WarpSize,
) => {
  const clock = createWarpClock();
  const scene = createMapScene();
  let running = false;

  // Un cuadro de prueba al preparar: el driver compila de verdad los
  // shaders en el primer dibujo, y eso no debe caer en el primer salto ni en
  // la primera apertura del mapa (rótulos incluidos, con un atlas de 1 px)
  renderer.resize(size.width, size.height, size.dpr);
  renderer.draw({ ...IDLE_FRAME, stars: 0.0001 });
  renderer.draw(IDLE_FRAME);
  const warm = createMapScene();
  warm.handle({
    type: 'map-open',
    at: 0,
    colors: Array.from({ length: 11 }, (): Rgb => [255, 255, 255]),
    here: 1,
    reduced: true,
    view: { ...size, region: { x: 0, y: 0, w: size.width, h: size.height } },
  });
  const warmFrame = warm.sample(1000);
  if (warmFrame) {
    renderer.setAtlas(null, [{ index: 1, kind: 0, ox: 0, oy: 0, w: 1, h: 1, u: 0, v: 0, extent: 1 }], 1, 1);
    renderer.draw({ ...IDLE_FRAME, stars: 0.0001 }, {
      ...warmFrame, alpha: 0.003, lines: 0.003, rings: 0.003, dust: 0.003, labels: 0.003, veil: 0, haze: 0,
    });
    renderer.setAtlas(null, [], 1, 1);
  }
  renderer.clear();

  const tick = () => {
    const now = epochNow();
    const frame = clock.sample(now);
    const mapFrame = scene.sample(now);
    if (!frame && !mapFrame) {
      running = false;
      renderer.clear();
      return;
    }
    // La zambullida lleva el punto de fuga del túnel desde la estrella al centro
    if (frame && mapFrame?.vanish) frame.center = mapFrame.vanish;
    renderer.draw(frame, mapFrame);
    // Con movimiento reducido el mapa queda quieto: el último cuadro se queda en pantalla
    if (!frame && scene.isStill(now)) {
      running = false;
      return;
    }
    schedule(tick);
  };

  const wake = () => {
    if (running) return;
    running = true;
    tick();
  };

  const handle = (message: WarpMessage) => {
    switch (message.type) {
      case 'start': {
        const { plan } = message;
        renderer.resize(message.width, message.height, message.dpr);
        clock.start(plan);
        if (plan.map !== undefined && plan.map >= 0) scene.dive(plan.map, plan.t0, plan.departMs);
        break;
      }
      case 'arrive':
        clock.arrive(message.at);
        return;
      case 'map-labels':
        renderer.setAtlas(message.image, message.labels, message.width, message.height);
        break;
      case 'map-open':
      case 'map-view':
        renderer.resize(message.view.width, message.view.height, message.view.dpr);
        scene.handle(message);
        break;
      default:
        scene.handle(message);
    }
    wake();
  };

  return { handle };
};
