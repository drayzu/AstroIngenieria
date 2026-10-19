/* Cuadros vivos en las salas de los capítulos (por ahora tras ?vivo=salas).

   En una sala cuelgan muchas obras a la vez y el navegador admite pocos
   contextos WebGL, así que un solo contexto, fuera de la página, dibuja las
   obras más a la vista (como mucho dos) y copia cada una a su propio lienzo
   2D, que va encima de su imagen. Las demás quedan como fotos. Usa el mismo
   shader que la sala de estudio (livingPainting.ts).

   Sin lecturas de layout por cuadro: los tamaños vienen de ResizeObserver y
   la visibilidad de IntersectionObserver. La deriva con el scroll ya la hace
   el CSS de cada marco (view()); aquí solo se suma la mirada del mouse. */

import { startProgram, whenReady } from './glProgram';
import { isScrollWarping } from './chapterWarp';
import { driftTarget, easeOut, findLight, FRAGMENT, VERTEX } from './livingPainting';
import { isObraFlightRunning } from './obraFlight';

const MAX_ACTIVE = 2;
// Cuánto de la obra tiene que verse para que cobre vida: la mayor parte de
// ella, o (si es más grande que la pantalla) un cuarto de la pantalla
const MIN_RATIO = 0.55;
const MIN_COVER = 0.25;
const UNFOLD_MS = 1200;
// Salas que revelan sus obras a su manera: la imagen viva se adelantaría
const SKIP = '.is-blueprint, .is-silence';

export const livingRoomsEnabled = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('vivo') === 'salas';

interface Work {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  src: string;
  depthSrc: string;
  mood: number;
  ratio: number;
  width: number;
  height: number;
  activeSince: number;
  images: [ImageBitmap, ImageBitmap] | null;
  loading: boolean;
}

interface Textures { image: WebGLTexture; depth: WebGLTexture; aspect: number; natural: [number, number]; light: { x: number; y: number; level: number } }

const works = new Set<Work>();
const byCanvas = new Map<Element, Work>();
const textureCache = new Map<string, Textures>();
let gl: WebGLRenderingContext | null = null;
let glCanvas: HTMLCanvasElement | null = null;
let program: WebGLProgram | null = null;
let compiling = false;
const uniforms: Record<string, WebGLUniformLocation | null> = {};
let frame = 0;
let lastPointer = -1e9;
let lastFrame = 0;
const target = { x: 0, y: 0 };
const off = { x: 0, y: 0 };
const vel = { x: 0, y: 0 };
let quality = 1;
let slowFrames = 0;
let pausedTimer = 0;
let intersection: IntersectionObserver | null = null;
let sizes: ResizeObserver | null = null;

const onPointer = (event: PointerEvent) => {
  if (event.pointerType !== 'mouse') return;
  target.x = -Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
  target.y = -Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));
  lastPointer = performance.now();
};

const setup = () => {
  if (gl || compiling) return;
  glCanvas = document.createElement('canvas');
  gl = glCanvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return;
  compiling = true;
  const pending = startProgram(gl, VERTEX, FRAGMENT);
  whenReady(pending, () => {
    compiling = false;
    const context = gl;
    if (!context) return;
    program = pending.finish();
    if (!program) return;
    context.useProgram(program);
    for (const name of ['uImg', 'uDepth', 'uRect', 'uOff', 'uZoom', 'uStrength', 'uLife', 'uTime', 'uAspect', 'uMood', 'uLight', 'uLightLevel']) {
      uniforms[name] = context.getUniformLocation(program, name);
    }
    context.bindBuffer(context.ARRAY_BUFFER, context.createBuffer());
    context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW);
    const position = context.getAttribLocation(program, 'p');
    context.enableVertexAttribArray(position);
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
    context.uniform1i(uniforms.uImg, 0);
    context.uniform1i(uniforms.uDepth, 1);
    context.uniform1f(uniforms.uZoom, 0);
    context.viewport(0, 0, 1, 1);
    context.drawArrays(context.TRIANGLES, 0, 3);
    schedule();
  });
  intersection = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const work = byCanvas.get(entry.target);
      if (!work) continue;
      const seen = entry.intersectionRect;
      const cover = (seen.width * seen.height) / Math.max(1, window.innerWidth * window.innerHeight);
      work.ratio = entry.isIntersecting ? Math.max(entry.intersectionRatio, cover >= MIN_COVER ? 1 : 0) : 0;
    }
    schedule();
  }, { threshold: [0, 0.25, 0.4, 0.55, 0.7, 0.85, 1] });
  sizes = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const work = byCanvas.get(entry.target);
      if (!work) continue;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.25) * quality;
      work.width = Math.max(1, Math.round(entry.contentRect.width * ratio));
      work.height = Math.max(1, Math.round(entry.contentRect.height * ratio));
      work.canvas.width = work.width;
      work.canvas.height = work.height;
      work.activeSince = -1;
    }
    schedule();
  });
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', () => {
    lastFrame = 0;
    schedule();
  });
};

const upload = (context: WebGLRenderingContext, unit: number, source: ImageBitmap) => {
  const texture = context.createTexture()!;
  context.activeTexture(context.TEXTURE0 + unit);
  context.bindTexture(context.TEXTURE_2D, texture);
  context.texImage2D(context.TEXTURE_2D, 0, context.RGB, context.RGB, context.UNSIGNED_BYTE, source);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
  return texture;
};

// Pocas obras con textura a la vez; la más vieja se libera
/* Imagen y profundidad reducidas al tamaño del marco y decodificadas fuera
   del hilo principal (desde un blob). Decodificar en el hilo principal al
   pasar de una obra a otra trababa el scroll */
let loadsInFlight = 0;
let uploadedThisFrame = false;
const bitmap = async (url: string, resizeWidth: number) => {
  const blob = await (await fetch(url)).blob();
  return createImageBitmap(blob, { resizeWidth, resizeQuality: 'medium' });
};
const prepare = (work: Work) => {
  work.loading = true;
  loadsInFlight++;
  const resizeWidth = Math.max(64, Math.min(2048, Math.round(work.width * 1.15)));
  Promise.all([bitmap(work.src, resizeWidth), bitmap(work.depthSrc, Math.min(resizeWidth, 960))])
    .then((images) => {
      work.images = images;
      schedule();
    })
    .catch(() => { work.loading = false; })
    .finally(() => { loadsInFlight--; });
};

const texturesFor = (context: WebGLRenderingContext, work: Work): Textures | null => {
  const cached = textureCache.get(work.src);
  if (cached) {
    textureCache.delete(work.src);
    textureCache.set(work.src, cached);
    return cached;
  }
  // Como mucho una subida a la GPU por cuadro
  if (!work.images || uploadedThisFrame) return null;
  uploadedThisFrame = true;
  const [image, depth] = work.images;
  const made = { image: upload(context, 0, image), depth: upload(context, 1, depth), aspect: image.width / image.height, natural: [image.width, image.height] as [number, number], light: findLight(image) };
  image.close();
  depth.close();
  work.images = null;
  work.loading = false;
  textureCache.set(work.src, made);
  while (textureCache.size > 5) {
    const [oldest, textures] = textureCache.entries().next().value as [string, Textures];
    context.deleteTexture(textures.image);
    context.deleteTexture(textures.depth);
    textureCache.delete(oldest);
  }
  return made;
};

const draw = (now: number) => {
  frame = 0;
  const context = gl;
  if (!context || !program || !glCanvas || document.visibilityState !== 'visible') return;
  // Con la sala de estudio encima, en un vuelo o en un salto no se dibuja:
  // las obras quedan tapadas y la transición necesita todo el cuadro
  if (document.querySelector('.mo-studio') || isObraFlightRunning() || isScrollWarping()) {
    lastFrame = 0;
    if (!pausedTimer) pausedTimer = window.setTimeout(() => { pausedTimer = 0; schedule(); }, 400);
    return;
  }
  const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
  // Si el equipo no da abasto, menos píxeles por obra
  if (lastFrame && now - lastFrame > 24 && quality > 0.6) {
    if (++slowFrames > 45) {
      quality = Math.max(0.6, quality - 0.2);
      slowFrames = 0;
      for (const work of works) {
        const ratio = Math.min(window.devicePixelRatio || 1, 1.25) * quality;
        work.width = Math.max(1, Math.round(work.canvas.clientWidth * ratio));
        work.height = Math.max(1, Math.round(work.canvas.clientHeight * ratio));
        work.canvas.width = work.width;
        work.canvas.height = work.height;
      }
    }
  } else slowFrames = Math.max(0, slowFrames - 1);
  lastFrame = now;
  if (now - lastPointer > 2500) driftTarget(target, now);
  vel.x += ((target.x - off.x) * 30 - vel.x * 10) * dt;
  vel.y += ((target.y - off.y) * 30 - vel.y * 10) * dt;
  off.x += vel.x * dt;
  off.y += vel.y * dt;

  const candidates = [...works].filter((work) => work.ratio >= MIN_RATIO).sort((a, b) => b.ratio - a.ratio);
  const active = new Set(candidates.slice(0, MAX_ACTIVE));
  for (const work of works) {
    if (!active.has(work)) {
      if (work.activeSince >= 0 || work.canvas.classList.contains('is-on')) {
        work.activeSince = -1;
        work.canvas.classList.remove('is-on');
      }
      continue;
    }
  }
  // Las obras que se acercan se preparan antes de cobrar vida, de a dos
  for (const work of works) {
    if (loadsInFlight >= 2) break;
    if (work.ratio > 0 && !work.images && !work.loading && !textureCache.has(work.src)) prepare(work);
  }
  uploadedThisFrame = false;

  const needW = Math.max(1, ...[...active].map((work) => work.width));
  const needH = Math.max(1, ...[...active].map((work) => work.height));
  if (glCanvas.width < needW || glCanvas.height < needH) {
    glCanvas.width = Math.max(glCanvas.width, needW);
    glCanvas.height = Math.max(glCanvas.height, needH);
  }
  context.uniform2f(uniforms.uOff, off.x, off.y);
  context.uniform1f(uniforms.uTime, now / 1000);
  for (const work of active) {
    const textures = texturesFor(context, work);
    if (!textures) continue;
    if (work.activeSince < 0) work.activeSince = now;
    const unfold = easeOut((now - work.activeSince) / UNFOLD_MS);
    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, textures.image);
    context.activeTexture(context.TEXTURE1);
    context.bindTexture(context.TEXTURE_2D, textures.depth);
    // object-fit: cover, centrado, como la imagen del marco
    const fit = Math.max(work.width / textures.natural[0], work.height / textures.natural[1]);
    const w = (textures.natural[0] * fit) / work.width;
    const h = (textures.natural[1] * fit) / work.height;
    context.viewport(0, 0, work.width, work.height);
    context.uniform4f(uniforms.uRect, (1 - w) / 2, (1 - h) / 2, w, h);
    context.uniform1f(uniforms.uAspect, textures.aspect);
    context.uniform1f(uniforms.uMood, work.mood);
    context.uniform2f(uniforms.uLight, textures.light.x, textures.light.y);
    context.uniform1f(uniforms.uLightLevel, textures.light.level);
    context.uniform1f(uniforms.uStrength, unfold);
    context.uniform1f(uniforms.uLife, unfold);
    context.drawArrays(context.TRIANGLES, 0, 3);
    // El viewport queda abajo a la izquierda del lienzo WebGL
    work.ctx.clearRect(0, 0, work.width, work.height);
    work.ctx.drawImage(glCanvas, 0, glCanvas.height - work.height, work.width, work.height, 0, 0, work.width, work.height);
    if (!work.canvas.classList.contains('is-on')) work.canvas.classList.add('is-on');
  }
  if (active.size) schedule();
};

const schedule = () => {
  if (!frame && program && works.size) frame = requestAnimationFrame(draw);
};

/* Registra el lienzo de una obra colgada. Devuelve con qué soltarlo */
export const registerRoomWork = (canvas: HTMLCanvasElement, src: string, depthSrc: string, mood = 0) => {
  if (canvas.closest(SKIP)) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  setup();
  const work: Work = { canvas, ctx, src, depthSrc, mood, ratio: 0, width: 1, height: 1, activeSince: -1, images: null, loading: false };
  works.add(work);
  byCanvas.set(canvas, work);
  intersection?.observe(canvas);
  sizes?.observe(canvas);
  return () => {
    works.delete(work);
    byCanvas.delete(canvas);
    intersection?.unobserve(canvas);
    sizes?.unobserve(canvas);
  };
};
