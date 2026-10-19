/* Cuadros vivos: la imagen de una obra con su profundidad.

   Cada imagen tiene un mapa de profundidad (blanco cerca, negro lejos) que
   genera scripts/generateDepthMaps.mjs. Un shader recorre cada píxel desde
   cerca hacia lejos y encuentra qué parte de la imagen se ve desde la cámara
   movida: lo cercano se desplaza más que lo lejano y el ojo lo lee como 3D.
   Encima va la vida que sirve para cualquier imagen: polvo que flota entre
   los planos y un destello de sol que recorre lo cercano.

   El lienzo arranca idéntico a la imagen (sin desplazamiento ni zoom), así
   el cambio no se nota; después se despliega la profundidad. Si llegamos
   volando al cuadro, la cámara además sigue un poco hacia dentro. */

import depthMaps from '../../data/depthMaps.json';
import { startProgram, whenReady } from './glProgram';
import { readLook } from './lookAround';
import { isObraFlightRunning, OBRA_LANDED_EVENT } from './obraFlight';

const BASE = import.meta.env.BASE_URL;
const SELECTED = 'illustrations/selected/';
const hashes = depthMaps as Record<string, string>;

// ?vivo=0 deja las obras quietas, para comparar
const disabled = () => {
  if (typeof window === 'undefined') return true;
  if (new URLSearchParams(window.location.search).get('vivo') === '0') return true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
};

/* El mapa de profundidad de una imagen, o null si no tiene */
export const depthSourceFor = (src: string): string | null => {
  if (disabled()) return null;
  const key = src.startsWith(BASE) ? src.slice(BASE.length) : src.replace(/^\//, '');
  const hash = hashes[key];
  if (!hash || !key.startsWith(SELECTED)) return null;
  return `${BASE}illustrations/depth/${key.slice(SELECTED.length)}?v=${hash}`;
};

export const VERTEX = `attribute vec2 p; varying vec2 vP;
void main() { vP = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

export const FRAGMENT = `precision highp float;
varying vec2 vP;
uniform sampler2D uImg;
uniform sampler2D uDepth;
uniform vec4 uRect;
uniform vec2 uOff;
uniform float uZoom;
uniform float uStrength;
uniform float uLife;
uniform float uTime;
uniform float uAspect;
uniform float uMood;
uniform vec2 uLight;
uniform float uLightLevel;
// Plano que no se mueve, cuánto se desplaza lo demás y hacia dónde entra la cámara
const float F = 0.25;
const float S = 0.03;
const vec2 C = vec2(0.5, 0.45);
float depthAt(vec2 uv) { return texture2D(uDepth, uv).r; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { return noise(p) * 0.55 + noise(p * 2.1 + 3.7) * 0.3 + noise(p * 4.3 + 7.1) * 0.15; }
float lumAt(vec2 uv) { return dot(texture2D(uImg, uv).rgb, vec3(0.299, 0.587, 0.114)); }
vec2 uvAt(vec2 q, float h) {
  // El margen de 4 % que cubre los bordes es fijo (la imagen de abajo tiene el
  // mismo): si creciera con la profundidad, cada imagen nueva haría un zoom
  float scale = 1.04 * (1.0 + uZoom * (0.3 + h * 1.5));
  return C + (q - C - uOff * (h - F) * S * uStrength) / scale;
}
void main() {
  vec2 q = (vP - uRect.xy) / uRect.zw;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  // De cerca hacia lejos: el primer plano que alcanza el rayo es lo que se ve
  vec2 uv = uvAt(q, 0.0);
  float above = 1.0;
  for (int i = 0; i <= 16; i++) {
    float h = 1.0 - float(i) / 16.0;
    if (depthAt(uvAt(q, h)) >= h) {
      float a = h;
      float b = above;
      for (int j = 0; j < 6; j++) {
        float m = 0.5 * (a + b);
        if (depthAt(uvAt(q, m)) >= m) a = m; else b = m;
      }
      uv = uvAt(q, a);
      break;
    }
    above = h;
  }
  float d = depthAt(uv);
  vec3 col = texture2D(uImg, uv).rgb;
  if (uLife > 0.001) {
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    // Polvo en tres planos: solo se ve delante de lo que está más lejos
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float plane = 0.14 + 0.26 * fk;
      vec2 cellUv = uvAt(q, plane) * vec2(uAspect, 1.0) * (16.0 - fk * 4.0);
      cellUv += vec2(uTime * 0.05, -uTime * 0.03) * (1.0 + fk * 0.6);
      vec2 cell = floor(cellUv);
      float n = hash(cell + fk * 17.0);
      if (n < 0.14 && d < plane) {
        vec2 o = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
        float r = length(fract(cellUv) - 0.5 - o * 0.6);
        float mote = smoothstep(0.035 + 0.03 * fk, 0.0, r) * (0.55 + 0.45 * sin(uTime * 0.9 + n * 50.0));
        col += vec3(1.0, 0.9, 0.76) * mote * 0.32 * uLife;
      }
    }
    // Atmósfera del capítulo (uMood): cada sala respira a su manera
    float m = uMood;
    if (m > -0.5) {
    if (m < 0.5 || abs(m - 2.0) < 0.5) {
      // Introducción e industria: chispas de soldadura que saltan en las estructuras cercanas
      vec2 cell = floor(uv * vec2(70.0, 30.0));
      float slot = floor(uTime * 1.7 + hash(cell) * 9.0);
      float spark = step(0.997, hash(cell + slot * 0.37)) * smoothstep(0.45, 0.8, d) * smoothstep(0.12, 0.35, lum);
      float r = length(fract(uv * vec2(70.0, 30.0)) - 0.5);
      float flash = (1.0 - fract(uTime * 1.7 + hash(cell) * 9.0));
      col += vec3(0.75, 0.88, 1.0) * spark * smoothstep(0.35, 0.0, r) * flash * 0.35 * uLife;
    } else if (abs(m - 1.0) < 0.5) {
      // Hábitats: partículas grandes y desenfocadas que flotan en el aire de adentro
      for (int k = 0; k < 2; k++) {
        float fk = float(k);
        float plane = 0.45 + 0.3 * fk;
        vec2 cellUv = uvAt(q, plane) * vec2(uAspect, 1.0) * (6.0 - fk * 2.0);
        cellUv += vec2(uTime * 0.025, sin(uTime * 0.2 + fk) * 0.15 - uTime * 0.012);
        vec2 cell = floor(cellUv);
        float n = hash(cell + 31.0 + fk * 13.0);
        if (n < 0.07 && d < plane + 0.15) {
          vec2 o = vec2(hash(cell + 5.3), hash(cell + 9.1)) - 0.5;
          float r = length(fract(cellUv) - 0.5 - o * 0.5);
          float bokeh = smoothstep(0.16 + 0.06 * fk, 0.05, r) * (0.6 + 0.4 * sin(uTime * 0.5 + n * 30.0));
          col += vec3(1.0, 0.93, 0.82) * bokeh * 0.028 * uLife;
        }
      }
    }
    // Los demás capítulos no llevan atmósfera propia: el calor, el giro y las
    // nubes no se notaban, y el titilar de luces pixelaba las zonas claras
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const TOUCH = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

/* Sin mouse, la cámara deriva sola, despacio; en el teléfono además sigue
   la inclinación (la misma mirada del museo, lookAround.ts) */
export const driftTarget = (target: { x: number; y: number }, now: number) => {
  const t = now / 1000;
  target.x = Math.sin(t * 0.33) * 0.55;
  target.y = Math.sin(t * 0.23 + 1) * 0.35;
  if (!TOUCH) return;
  const look = readLook();
  target.x = Math.max(-1, Math.min(1, target.x * 0.5 - look.yaw / 0.052));
  target.y = Math.max(-1, Math.min(1, target.y * 0.5 - look.pitch / 0.03));
};

/* Atmósfera de cada capítulo en el shader (uMood) */
const MOODS: Record<string, number> = { intro: 0, habitats: 1, infrastructure: 2, planetary: 3, energy: 4, propulsion: 5, stellar: 6, civilizations: 7, search: 8 };
// ?atmosfera=0 apaga la atmósfera del capítulo (deja profundidad, polvo y destello)
const noMood = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('atmosfera') === '0';
export const moodOf = (chapterId?: string) => (noMood ? -1 : MOODS[chapterId ?? ''] ?? 0);

/* Dónde está la luz más fuerte de la imagen (0..1) y cuánto brilla: de ahí
   salen los rayos, el calor y el pulso. Se mide una vez, en miniatura */
export const findLight = (source: CanvasImageSource): { x: number; y: number; level: number } => {
  const w = 64;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { x: 0.5, y: 0.4, level: 0 };
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const lums: number[] = [];
  for (let i = 0; i < w * h; i++) lums.push((data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255);
  const threshold = [...lums].sort((a, b) => b - a)[Math.floor(lums.length * 0.02)];
  let sx = 0;
  let sy = 0;
  let sw = 0;
  lums.forEach((lum, i) => {
    if (lum < threshold) return;
    const weight = lum * lum;
    sx += ((i % w) + 0.5) / w * weight;
    sy += (Math.floor(i / w) + 0.5) / h * weight;
    sw += weight;
  });
  return sw ? { x: sx / sw, y: sy / sw, level: Math.min(1, Math.max(0, (threshold - 0.45) / 0.45)) } : { x: 0.5, y: 0.4, level: 0 };
};

export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

// Cuánto entra la cámara en el cuadro al llegar volando, y en cuánto tiempo (ms)
// Sin acercamiento al llegar: molestaba al entrar y al cambiar de imagen
const ARRIVAL_ZOOM = 0;
const ARRIVAL_MS = 2400;
const UNFOLD_MS = 1400;

/* Monta la obra viva sobre un lienzo. Devuelve con qué desmontarla */
export const mountLivingPainting = (canvas: HTMLCanvasElement, src: string, depthSrc: string, mood = 0) => {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return () => {};
  let alive = true;
  let frame = 0;
  let intersecting = false;
  let visible = false;
  let program: WebGLProgram | null = null;
  let loaded: HTMLImageElement[] | null = null;
  let image: HTMLImageElement | null = null;
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  // Si llegamos volando, la profundidad se despliega cuando el vuelo se posa
  const arriving = isObraFlightRunning();
  let landedAt = -1;
  let scale = 1;
  let slowFrames = 0;
  let lastFrame = 0;
  let lastPointer = -1e9;
  let scrollShift = 0;
  const target = { x: 0, y: 0 };
  const off = { x: 0, y: 0 };
  const vel = { x: 0, y: 0 };

  const texture = (unit: number, source: HTMLImageElement) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };

  // Al bajar por la sala, la imagen se mira un poco desde arriba
  const measureScroll = () => {
    const rect = canvas.getBoundingClientRect();
    scrollShift = Math.max(-1, Math.min(1, ((rect.top + rect.height / 2) / window.innerHeight - 0.5) * 2));
  };

  const resize = () => {
    // El tamaño de la caja sin transformaciones: getBoundingClientRect incluye
    // la inclinación 3D del marco al pasar el mouse, que cambia la proporción y
    // dejaba franjas negras a los lados
    const rect = { width: canvas.clientWidth, height: canvas.clientHeight };
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    // El mismo encuadre que la imagen
    if (image && program && rect.width > 0 && rect.height > 0) {
      // Todas las obras se ven en 21:9 (object-fit: cover), aunque la imagen no lo sea
      const fit = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      const w = (image.naturalWidth * fit) / rect.width;
      const h = (image.naturalHeight * fit) / rect.height;
      gl.uniform4f(uniforms.uRect, (1 - w) / 2, (1 - h) / 2, w, h);
    }
    measureScroll();
  };

  const draw = (now: number) => {
    frame = 0;
    if (!alive || !visible || !program || !image) return;
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
    // Si el equipo no da abasto, se dibuja con menos píxeles
    if (lastFrame && now - lastFrame > 24 && scale > 0.55) {
      if (++slowFrames > 45) {
        scale = Math.max(0.55, scale - 0.2);
        slowFrames = 0;
        resize();
      }
    } else slowFrames = Math.max(0, slowFrames - 1);
    lastFrame = now;
    if (landedAt < 0 && !isObraFlightRunning()) landedAt = now;

    if (now - lastPointer > 2500) driftTarget(target, now);
    const goalY = target.y - scrollShift * 0.5;
    vel.x += ((target.x - off.x) * 30 - vel.x * 10) * dt;
    vel.y += ((goalY - off.y) * 30 - vel.y * 10) * dt;
    off.x += vel.x * dt;
    off.y += vel.y * dt;

    const settled = landedAt >= 0 ? now - landedAt : -1;
    const unfold = settled < 0 ? 0 : easeOut(settled / UNFOLD_MS);
    const zoom = arriving && settled >= 0 ? ARRIVAL_ZOOM * easeOut(settled / ARRIVAL_MS) : 0;
    gl.uniform2f(uniforms.uOff, off.x, off.y);
    gl.uniform1f(uniforms.uZoom, zoom);
    gl.uniform1f(uniforms.uStrength, unfold);
    gl.uniform1f(uniforms.uLife, unfold);
    gl.uniform1f(uniforms.uTime, now / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!canvas.classList.contains('is-on')) canvas.classList.add('is-on');
    schedule();
  };
  const schedule = () => {
    if (!frame && alive && visible && program && image) frame = requestAnimationFrame(draw);
  };
  const update = () => {
    visible = intersecting && document.visibilityState === 'visible';
    if (!visible) return;
    lastFrame = 0;
    measureScroll();
    schedule();
  };

  const start = () => {
    if (!alive || !program || !loaded || image) return;
    image = loaded[0];
    texture(0, loaded[0]);
    texture(1, loaded[1]);
    gl.uniform1f(uniforms.uAspect, image.naturalWidth / image.naturalHeight);
    const light = findLight(image);
    gl.uniform1f(uniforms.uMood, mood);
    gl.uniform2f(uniforms.uLight, light.x, light.y);
    gl.uniform1f(uniforms.uLightLevel, light.level);
    resize();
    update();
  };

  const pending = startProgram(gl, VERTEX, FRAGMENT);
  const cancelCompile = whenReady(pending, () => {
    program = pending.finish();
    if (!program || !alive) return;
    gl.useProgram(program);
    for (const name of ['uImg', 'uDepth', 'uRect', 'uOff', 'uZoom', 'uStrength', 'uLife', 'uTime', 'uAspect', 'uMood', 'uLight', 'uLightLevel']) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(uniforms.uImg, 0);
    gl.uniform1i(uniforms.uDepth, 1);
    start();
  });
  Promise.all([loadImage(src), loadImage(depthSrc)]).then((images) => {
    loaded = images;
    start();
  }).catch(() => {});

  const onLanded = () => { landedAt = performance.now(); };
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    target.x = -Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
    target.y = -Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));
    lastPointer = performance.now();
  };
  const intersection = new IntersectionObserver(([entry]) => {
    intersecting = Boolean(entry?.isIntersecting);
    update();
  });
  intersection.observe(canvas);
  const sizes = new ResizeObserver(resize);
  sizes.observe(canvas);
  if (arriving) window.addEventListener(OBRA_LANDED_EVENT, onLanded, { once: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('scroll', measureScroll, { passive: true, capture: true });
  document.addEventListener('visibilitychange', update);

  return () => {
    alive = false;
    cancelAnimationFrame(frame);
    cancelCompile();
    intersection.disconnect();
    sizes.disconnect();
    window.removeEventListener(OBRA_LANDED_EVENT, onLanded);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('scroll', measureScroll, { capture: true });
    document.removeEventListener('visibilitychange', update);
    // Solo si el lienzo se fue: si React vuelve a montar sobre el mismo, el
    // contexto perdido no se podría reutilizar
    if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
};
