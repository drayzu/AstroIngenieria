import {
  MAP_DIAL,
  MAP_MAX_POINTS,
  MAP_PLANE,
  MAP_RINGS,
  buildMapLayout,
  trailPlan,
  workOrbit,
  type MapConstellation,
  type MapFrame,
  type Vec3,
} from './starMap';

/* Capas del mapa estelar dentro del mismo lienzo WebGL del salto: así la
   zambullida en una estrella y el hiperespacio son un único dibujo continuo,
   en el worker, sin depender del hilo principal. Todo es luz que se suma
   sobre el velo: líneas finas (anillos del plano, tallos, ruta), estrellas
   con halo y anillo, el polvo que da profundidad y los rótulos. */

export type GlProgram = {
  program: WebGLProgram;
  attribute: (name: string) => number;
  uniform: (name: string) => WebGLUniformLocation | null;
};

// Rótulo recortado del atlas que arma el hilo principal
export type MapLabel = {
  index: number;
  // 0 número, 1 título, 2 "estás aquí"
  kind: 0 | 1 | 2;
  // Desplazamiento desde la estrella (px CSS) y tamaño en el atlas (px del lienzo)
  ox: number;
  oy: number;
  w: number;
  h: number;
  u: number;
  v: number;
  // Ancho del número + título, para saber si cabe a la derecha (px CSS)
  extent: number;
};

const MAX = MAP_MAX_POINTS;
const OFF = 'gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return;';
const INK = 'vec3(0.96, 0.945, 0.91)';

const PALETTE = /* glsl */ `
vec3 palette(float s) {
  float u = clamp(s, 0.0, 1.0) * (uCount - 1.0);
  float i = floor(u);
  int a = int(i);
  int b = int(min(i + 1.0, uCount - 1.0));
  return mix(uColors[a], uColors[b], smoothstep(0.0, 1.0, u - i));
}
`;

/* ---------------- Líneas ---------------- */

const LINE_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 aA;
attribute vec3 aB;
attribute vec2 aCorner;
attribute vec4 aStyle;
uniform mat4 uViewProj;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uLines;
uniform float uRings;
uniform float uRingScale;
uniform float uCount;
uniform vec3 uColors[${MAX}];
uniform vec4 uPoints[${MAX}];
varying float vSide;
varying float vWidth;
varying vec3 vColor;
varying float vS;
varying float vKind;
${PALETTE}
void main() {
  // Tipo: 0 anillos del plano, 1 tallo de una estrella, 2 ruta, 3 pie del tallo
  float kind = aStyle.x;
  vec3 a = aA;
  vec3 b = aB;
  vec3 color = ${INK};
  float alpha = aStyle.w;
  float s = 0.0;
  float width = 0.5;
  if (kind < 0.5) {
    a.xz *= uRingScale;
    b.xz *= uRingScale;
    alpha *= uRings;
  } else if (kind < 1.5 || kind > 2.5) {
    int i = int(aStyle.y + 0.5);
    vec4 point = uPoints[i];
    if (kind < 1.5) {
      // El tallo baja de la estrella al plano a medida que se enciende
      b = mix(a, b, point.x);
      s = aCorner.x * length(b - a) * 11.0;
    }
    color = uColors[i];
    alpha *= point.x * point.w * (0.8 + 0.7 * point.y) * uLines;
  } else {
    s = mix(aStyle.y, aStyle.z, aCorner.x);
    color = palette(s);
    alpha *= uLines;
    width = 0.68;
  }
  vec4 ca = uViewProj * vec4(a, 1.0);
  vec4 cb = uViewProj * vec4(b, 1.0);
  if (min(ca.w, cb.w) < 0.12 || alpha <= 0.002) {
    ${OFF}
  }
  vec2 sa = ca.xy / ca.w * 0.5 * uViewport;
  vec2 sb = cb.xy / cb.w * 0.5 * uViewport;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float w = width * uDpr;
  float reach = w + 1.0;
  // Medio píxel más en cada punta: los tramos no dejan huecos entre sí
  vec2 p = mix(sa, sb, aCorner.x) + dir * (aCorner.x * 2.0 - 1.0) * 0.5 + n * aCorner.y * reach;
  // Lo lejano se apaga: el plano se lee en perspectiva
  float depth = mix(ca.w, cb.w, aCorner.x);
  alpha *= mix(1.2, 0.38, smoothstep(5.0, 11.5, depth));
  gl_Position = vec4(p / (0.5 * uViewport), 0.0, 1.0);
  vSide = aCorner.y * reach;
  vWidth = w;
  vColor = color * alpha;
  vS = s;
  vKind = kind;
}
`;

const LINE_FRAGMENT = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uReveal;
uniform float uHere;
uniform float uTime;
varying float vSide;
varying float vWidth;
varying vec3 vColor;
varying float vS;
varying float vKind;
void main() {
  float a = clamp(vWidth + 0.5 - abs(vSide), 0.0, 1.0);
  if (vKind > 1.5 && vKind < 2.5) {
    // La ruta se traza sola; lo ya recorrido es continuo y lo que falta,
    // un trazo discontinuo que avanza despacio en el sentido del viaje
    a *= 1.0 - smoothstep(uReveal - 0.008, uReveal + 0.001, vS);
    if (vS > uHere + 0.002) a *= step(0.45, fract(vS * 150.0 - uTime * 0.22)) * 0.62;
  } else if (vKind > 0.5 && vKind < 1.5) {
    a *= step(0.45, fract(vS));
  }
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vColor * a, 0.0);
}
`;

/* ---------------- Estrellas: halo, anillo y retícula ---------------- */

const SPRITE_VERTEX = /* glsl */ `
precision highp float;
attribute vec2 aCorner;
attribute vec4 aPoint;
uniform mat4 uViewProj;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uFocal;
// Compartido con el fragmento: misma precisión en los dos
uniform mediump float uAlpha;
uniform float uCount;
uniform vec3 uColors[${MAX}];
uniform vec4 uPoints[${MAX}];
uniform vec2 uProgress[${MAX}];
varying vec2 vLocal;
varying vec4 vState;
varying vec3 vColor;
varying float vKind;
varying float vGrow;
varying vec2 vProgress;
void main() {
  int i = int(aPoint.w + 0.5);
  vec4 state = uPoints[i];
  vProgress = uProgress[i];
  vec4 c = uViewProj * vec4(aPoint.xyz, 1.0);
  if (c.w < 0.06 || state.x * state.w * uAlpha <= 0.002) {
    ${OFF}
  }
  vec2 s = c.xy / c.w * 0.5 * uViewport;
  // Con la cámara encima (la zambullida) la estrella crece hasta atravesarla
  float grow = max(1.0, 0.05 * uFocal / c.w / 6.0);
  vLocal = aCorner * 50.0 * grow;
  vGrow = grow;
  vec2 p = s + aCorner * 50.0 * grow * uDpr;
  gl_Position = vec4(p / (0.5 * uViewport), 0.0, 1.0);
  vState = state;
  vColor = uColors[i];
  vKind = i == 0 ? 0.0 : (aPoint.w > uCount - 1.5 ? 2.0 : 1.0);
}
`;

const SPRITE_FRAGMENT = /* glsl */ `
precision mediump float;
uniform float uAlpha;
uniform float uTime;
varying vec2 vLocal;
varying vec4 vState;
varying vec3 vColor;
varying float vKind;
varying float vGrow;
varying vec2 vProgress;
float stroke(float d, float r) {
  return clamp(1.0 - abs(d - r) / 0.85, 0.0, 1.0);
}
void main() {
  // d en px reales; n escalado (el halo florece, los trazos siguen finos)
  float real = length(vLocal);
  float d = real / vGrow;
  float focus = vState.y;
  float here = vState.z;
  float light;
  if (vKind < 0.5) {
    // La portada: un círculo hueco, el punto de partida
    light = stroke(d, 4.5 + focus) * 0.6 + exp(-d * d / 5.0) * 0.3;
  } else if (vKind > 1.5) {
    // Vitrina y archivo: un rombo de línea al final del camino
    light = stroke(abs(vLocal.x) + abs(vLocal.y), 7.5 + 3.0 * focus) * (0.55 + 0.4 * focus);
    light += exp(-d * d / 9.0) * 0.32;
  } else {
    float sigma = 7.5 + 7.0 * focus;
    // Al florecer el halo se atenúa: llega al brillo del túnel sin pasarlo
    light = exp(-d * d / (2.0 * sigma * sigma)) * (0.3 + 0.32 * focus) / (1.0 + 0.035 * (vGrow - 1.0));
    light += stroke(real, (9.5 + 4.5 * focus) * vGrow) * (0.4 + 0.5 * focus) * min(vGrow, 1.6);
    // Lo leído del capítulo: un arco que se cierra en sentido horario desde
    // arriba, sobre una pista apenas visible. Completo, el anillo entero
    // brilla y al cerrarse suelta una onda
    float read = vProgress.x;
    float radius = 15.5 + 3.0 * focus;
    float ring = stroke(d, radius);
    float turn = atan(vLocal.x, vLocal.y) / 6.2831853;
    turn = turn < 0.0 ? turn + 1.0 : turn;
    // Borde suave del arco: un píxel de largo de arco
    float edge = 1.0 / (6.2831853 * radius);
    float arc = read >= 0.999 ? 1.0 : smoothstep(read + edge, read - edge, turn) * step(0.0005, read);
    float done = smoothstep(0.995, 1.0, read);
    light += ring * (0.07 + 0.05 * focus) * (1.0 - arc);
    light += ring * arc * (0.62 + 0.25 * focus + 0.2 * done);
    light += done * exp(-pow(d - radius, 2.0) / 18.0) * 0.16;
    float burst = vProgress.y;
    if (burst > 0.001) {
      float p = 1.0 - burst;
      light += stroke(d, radius + 34.0 * p) * burst * burst * 0.9;
      light += exp(-d * d / 60.0) * burst * 0.5;
    }
  }
  // Estás aquí: cuatro arcos que giran despacio y un pulso que se abre
  if (here > 0.001) {
    float angle = atan(vLocal.y, vLocal.x) + uTime * 0.42;
    float arcs = smoothstep(0.12, 0.32, cos(4.0 * angle));
    float reticle = stroke(d, 21.0 + (1.0 - here) * 10.0) * arcs;
    float phase = fract(uTime / 2.8);
    float ping = stroke(d, 13.0 + 30.0 * phase) * (1.0 - phase) * (1.0 - phase);
    light += (reticle * 0.8 + ping * 0.42) * here;
  }
  float a = light * vState.x * vState.w * uAlpha;
  if (a <= 0.001) discard;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.12) * a, 0.0);
}
`;

/* ---------------- Polvo y núcleos (con estela) ---------------- */

const POINT_VERTEX = /* glsl */ `
precision highp float;
attribute vec2 aCorner;
attribute vec4 aPos;
attribute vec3 aLook;
uniform mat4 uViewProj;
uniform mat4 uPrevViewProj;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uFocal;
uniform float uDust;
uniform float uAlpha;
uniform vec3 uColors[${MAX}];
uniform vec4 uPoints[${MAX}];
varying vec2 vLocal;
varying float vLen;
varying float vRadius;
varying vec3 vColor;
void main() {
  vec4 h = uViewProj * vec4(aPos.xyz, 1.0);
  vec4 t = uPrevViewProj * vec4(aPos.xyz, 1.0);
  vec3 color;
  float r;
  if (aPos.w < -0.5) {
    color = mix(vec3(0.62, 0.73, 1.0), vec3(1.0, 0.87, 0.72), aLook.z) * aLook.y * uDust;
    // Muy cerca de la cámara se apaga antes de rozarla
    color *= smoothstep(0.5, 2.0, h.w);
    r = aLook.x * clamp(6.5 / h.w, 0.6, 1.9);
  } else {
    int i = int(aPos.w + 0.5);
    vec4 state = uPoints[i];
    color = mix(vec3(1.0), uColors[i], 0.3) * state.x * state.w * (1.45 + 0.6 * state.y) * uAlpha;
    r = max(2.1 + 0.6 * state.y, min(0.014 * uFocal / h.w, 9.0));
  }
  if (min(h.w, t.w) < 0.06 || dot(color, color) < 1e-6) {
    ${OFF}
  }
  r *= uDpr;
  vec2 head = h.xy / h.w * 0.5 * uViewport;
  vec2 tail = t.xy / t.w * 0.5 * uViewport;
  float len = length(head - tail);
  float cap = uViewport.y * 0.7;
  if (len > cap) {
    tail = head - (head - tail) * (cap / len);
    len = cap;
  }
  vec2 n = len > 1e-3 ? (head - tail) / len : vec2(1.0, 0.0);
  vec2 side = vec2(-n.y, n.x);
  vec2 p = mix(tail - n * r, head + n * r, aCorner.x) + side * aCorner.y * r;
  vLocal = vec2(mix(-r, len + r, aCorner.x), aCorner.y * r);
  vLen = len;
  vRadius = r;
  vColor = color;
  gl_Position = vec4(p / (0.5 * uViewport), 0.0, 1.0);
}
`;

/* ---------------- Constelación del visitante ---------------- */

/* Posición de una obra: su capítulo más su lugar en el cúmulo, que gira
   despacio (más rápido cerca del centro) sobre un disco inclinado */
const ORBIT = /* glsl */ `
vec3 orbitPosition(vec4 center, vec4 orbit, float time) {
  float r = orbit.x;
  float angle = orbit.y + time * 0.05 * pow(0.12 / r, 1.5);
  vec3 local = vec3(cos(angle) * r, orbit.z, sin(angle) * r);
  float c = cos(orbit.w);
  float s = sin(orbit.w);
  local = vec3(local.x, local.y * c - local.z * s, local.y * s + local.z * c);
  return center.xyz + local;
}
`;

const WORK_VERTEX = /* glsl */ `
precision highp float;
attribute vec2 aCorner;
attribute vec4 aCenter;
attribute vec4 aOrbit;
attribute vec4 aLook;
uniform mat4 uViewProj;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uAlpha;
uniform float uTime;
uniform float uTrail;
uniform float uTrailClock;
uniform vec3 uColors[${MAX}];
uniform vec4 uPoints[${MAX}];
varying vec2 vLocal;
varying vec3 vColor;
varying float vLit;
varying float vFlash;
varying float vAge;
varying float vSpark;
varying float vFocus;
${ORBIT}
void main() {
  int i = int(aCenter.w + 0.5);
  vec4 state = uPoints[i];
  float order = aLook.x;
  // Encendida cuando el trazo pasa por ella; las no leídas quedan como polvo
  float lit = order < -0.5 ? 0.0 : clamp((uTrail - order + 0.12) / 0.3, 0.0, 1.0);
  float age = aLook.z < 0.0 ? -1.0 : uTrailClock - aLook.z;
  float flash = age >= 0.0 && age < 2000.0 ? 1.0 - age / 2000.0 : 0.0;
  float fade = state.x * state.w * uAlpha;
  vec4 c = uViewProj * vec4(orbitPosition(aCenter, aOrbit, uTime), 1.0);
  if (c.w < 0.06 || fade <= 0.002) {
    ${OFF}
  }
  // Lo lejano se apaga un poco, como el resto del mapa
  fade *= mix(1.15, 0.5, smoothstep(5.0, 11.5, c.w));
  float reach = lit > 0.0 ? (flash > 0.0 ? 46.0 : 13.0) : 3.5;
  vec2 s = c.xy / c.w * 0.5 * uViewport;
  vLocal = aCorner * reach;
  gl_Position = vec4((s + aCorner * reach * uDpr) / (0.5 * uViewport), 0.0, 1.0);
  // Centelleo lento y desfasado: la constelación respira
  float twinkle = 0.86 + 0.14 * sin(uTime * 1.6 + aLook.y);
  vColor = uColors[i] * fade;
  vLit = lit * twinkle;
  vFlash = flash;
  vAge = age;
  vSpark = aLook.w;
  vFocus = state.y;
}
`;

const WORK_FRAGMENT = /* glsl */ `
precision mediump float;
varying vec2 vLocal;
varying vec3 vColor;
varying float vLit;
varying float vFlash;
varying float vAge;
varying float vSpark;
varying float vFocus;
float stroke(float d, float r) {
  return clamp(1.0 - abs(d - r) / 0.9, 0.0, 1.0);
}
void main() {
  float d = length(vLocal);
  vec3 tint = vColor;
  // Polvo: el lugar de una obra aún no leída, más visible al señalar su capítulo
  float dust = exp(-d * d / 1.5) * (0.42 + 0.55 * vFocus) * (1.0 - vLit);
  vec3 color = mix(vec3(0.7, 0.75, 0.86) * length(tint) * 0.58, tint, 0.45) * dust;
  if (vLit > 0.001) {
    float core = exp(-d * d / 2.6);
    float halo = exp(-d * d / 48.0) * (0.5 + 0.35 * vFocus);
    // Cuatro rayos finos, apenas más largos en las estrellas recientes
    float len = 4.5 + 3.0 * vSpark + 2.5 * vFocus + 10.0 * vFlash;
    vec2 a = abs(vLocal);
    float spikes = (exp(-a.y * 1.6) * exp(-a.x / len) + exp(-a.x * 1.6) * exp(-a.y / len)) * 0.42;
    color += (mix(tint, vec3(length(tint) * 0.58), 0.6) * core * 1.45 + tint * (halo + spikes)) * vLit;
  }
  if (vFlash > 0.001) {
    // Nacimiento: un destello, un anillo que se abre y el halo que se calma
    float p = clamp(vAge / 1300.0, 0.0, 1.0);
    float ring = stroke(d, 5.0 + 36.0 * (1.0 - (1.0 - p) * (1.0 - p))) * (1.0 - p) * (1.0 - p);
    float bloom = exp(-d * d / (30.0 + 150.0 * vFlash)) * vFlash * vFlash * 1.05;
    color += (tint * (ring * 0.9 + bloom) + vec3(length(tint) * 0.58) * exp(-d * d / 6.0) * vFlash) * step(0.0, vAge);
  }
  if (dot(color, color) < 1e-6) discard;
  gl_FragColor = vec4(color, 0.0);
}
`;

const TRAIL_VERTEX = /* glsl */ `
precision highp float;
attribute vec2 aCorner;
attribute vec4 aCenterA;
attribute vec4 aOrbitA;
attribute vec4 aCenterB;
attribute vec4 aOrbitB;
attribute float aSegment;
uniform mat4 uViewProj;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uAlpha;
uniform float uTime;
uniform vec3 uColors[${MAX}];
uniform vec4 uPoints[${MAX}];
varying float vSide;
varying float vAlong;
varying float vLen;
varying vec3 vColorA;
varying vec3 vColorB;
varying float vSegment;
${ORBIT}
void main() {
  int ia = int(aCenterA.w + 0.5);
  int ib = int(aCenterB.w + 0.5);
  vec4 sa_ = uPoints[ia];
  vec4 sb_ = uPoints[ib];
  float fade = min(sa_.x, sb_.x) * min(sa_.w, sb_.w) * uAlpha;
  vec4 ca = uViewProj * vec4(orbitPosition(aCenterA, aOrbitA, uTime), 1.0);
  vec4 cb = uViewProj * vec4(orbitPosition(aCenterB, aOrbitB, uTime), 1.0);
  if (min(ca.w, cb.w) < 0.12 || fade <= 0.002) {
    ${OFF}
  }
  vec2 pa = ca.xy / ca.w * 0.5 * uViewport;
  vec2 pb = cb.xy / cb.w * 0.5 * uViewport;
  vec2 d = pb - pa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  // Ancho para el brillo de la punta; la línea en sí es un hilo
  float reach = 7.0 * uDpr;
  // Las puntas se acortan para no tapar las estrellas que une
  float gap = min(5.0 * uDpr, len * 0.3);
  vec2 p = mix(pa + dir * gap, pb - dir * gap, aCorner.x) + n * aCorner.y * reach;
  gl_Position = vec4(p / (0.5 * uViewport), 0.0, 1.0);
  float depth = mix(ca.w, cb.w, aCorner.x);
  fade *= mix(1.1, 0.5, smoothstep(5.0, 11.5, depth));
  vSide = aCorner.y * reach / uDpr;
  vAlong = aCorner.x;
  vLen = max(1.0, len / uDpr - 2.0 * gap / uDpr);
  vColorA = uColors[ia] * fade;
  vColorB = uColors[ib] * fade;
  vSegment = aSegment;
}
`;

const TRAIL_FRAGMENT = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uTrail;
uniform float uTrailCount;
uniform float uTime;
uniform float uDpr;
varying float vSide;
varying float vAlong;
varying float vLen;
varying vec3 vColorA;
varying vec3 vColorB;
varying float vSegment;
void main() {
  // El tramo k va de la estrella k a la k + 1: se dibuja hasta donde llegó el trazo
  float drawn = clamp(uTrail - vSegment, 0.0, 1.0);
  if (vAlong > drawn) discard;
  float side = abs(vSide);
  float line = clamp(0.55 + 0.5 / uDpr - side, 0.0, 1.0);
  vec3 tint = mix(vColorA, vColorB, vAlong);
  vec3 light = mix(tint, vec3(length(tint) * 0.58), 0.25) * line * 0.38;
  // La punta del trazo, mientras avanza: una brasa con su resplandor
  if (drawn < 1.0) {
    float behind = (drawn - vAlong) * vLen;
    float tip = exp(-behind * behind / 70.0) * exp(-side * side / 5.0);
    light += (tint + vec3(length(tint) * 0.4)) * tip * 1.3;
    light += tint * line * exp(-behind / 26.0) * 0.6;
  }
  // Ya trazada, una luz recorre la constelación de la primera a la última
  float done = smoothstep(uTrailCount - 1.0, uTrailCount - 0.7, uTrail);
  if (done > 0.0 && uTrailCount > 1.5) {
    float period = clamp(3.0 + 0.45 * uTrailCount, 4.0, 14.0);
    float head = fract(uTime / period) * (uTrailCount + 1.0) - 1.0;
    float gap = (vSegment + vAlong) - head;
    float pulse = exp(-gap * gap / 0.05) * done;
    light += mix(tint, vec3(length(tint) * 0.58), 0.4) * (line * 1.3 + exp(-side * side / 6.0) * 0.35) * pulse;
  }
  if (dot(light, light) < 1e-6) discard;
  gl_FragColor = vec4(light, 0.0);
}
`;

const WORK_FLOATS = 14;
const TRAIL_FLOATS = 19;

const buildConstellation = (points: Vec3[], constellation: MapConstellation) => {
  const { counts, path, fresh } = constellation;
  // Con movimiento reducido el reloj del trazo ya pasó todos los destellos
  const plan = trailPlan(path.length, fresh);
  const order = new Map<string, number>();
  path.forEach(([point, slot], k) => order.set(`${point}:${slot}`, k));
  const work: number[] = [];
  counts.forEach((count, point) => {
    const center = points[point];
    if (!center) return;
    for (let slot = 0; slot < count; slot++) {
      const orbit = workOrbit(point, slot, count);
      const k = order.get(`${point}:${slot}`) ?? -1;
      const ignite = k >= plan.nOld ? plan.igniteAt(k) : -1;
      // Las más recientes llevan los rayos un poco más largos
      const spark = k >= 0 ? Math.max(0, 1 - (path.length - 1 - k) / 6) : 0;
      for (const [cx, cy] of BOX) {
        work.push(cx, cy, center[0], center[1], center[2], point, orbit.r, orbit.angle, orbit.y, orbit.tilt, k, orbit.twinkle, ignite, spark);
      }
    }
  });
  const trail: number[] = [];
  for (let k = 0; k < path.length - 1; k++) {
    const [pa, sa] = path[k];
    const [pb, sb] = path[k + 1];
    const a = points[pa];
    const b = points[pb];
    if (!a || !b) continue;
    const oa = workOrbit(pa, sa, counts[pa] ?? 1);
    const ob = workOrbit(pb, sb, counts[pb] ?? 1);
    for (const [cx, cy] of QUAD) {
      trail.push(
        cx, cy,
        a[0], a[1], a[2], pa, oa.r, oa.angle, oa.y, oa.tilt,
        b[0], b[1], b[2], pb, ob.r, ob.angle, ob.y, ob.tilt,
        k,
      );
    }
  }
  return { work: new Float32Array(work), trail: new Float32Array(trail) };
};

/* ---------------- Rótulos ---------------- */

const LABEL_VERTEX = /* glsl */ `
precision highp float;
attribute vec2 aCorner;
attribute vec4 aAnchor;
attribute vec4 aRect;
attribute vec4 aUv;
attribute vec2 aKind;
uniform mat4 uViewProj;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uLabels;
uniform vec3 uColors[${MAX}];
uniform vec4 uPoints[${MAX}];
varying vec2 vUv;
varying vec3 vColor;
void main() {
  int i = int(aAnchor.w + 0.5);
  vec4 state = uPoints[i];
  float kind = aKind.x;
  vec2 offset = aRect.xy;
  float alpha;
  vec3 color;
  if (kind < 0.5) {
    alpha = state.x * (0.55 + 0.45 * state.y);
    color = mix(uColors[i], vec3(1.0), 0.18);
    offset.x += state.y * 4.0;
  } else if (kind < 1.5) {
    alpha = state.x * state.y;
    color = ${INK};
    offset.x += 4.0 - (1.0 - state.y) * 8.0;
  } else {
    alpha = state.z * 0.85;
    color = ${INK};
  }
  alpha *= uLabels * state.w;
  vec4 c = uViewProj * vec4(aAnchor.xyz, 1.0);
  if (c.w < 0.06 || alpha <= 0.003) {
    ${OFF}
  }
  vec2 screen = vec2(c.x, -c.y) / c.w * 0.5 * uViewport + 0.5 * uViewport;
  // Junto al borde derecho, número y título pasan al otro lado de la estrella
  // (si allí caben mejor)
  float right = uViewport.x / uDpr - 16.0 - (screen.x / uDpr + aKind.y);
  float left = screen.x / uDpr - aKind.y - 16.0;
  if (kind < 1.5 && right < 0.0 && left > right) {
    offset.x = -offset.x - aRect.z / uDpr;
  }
  vec2 corner = floor(screen + offset * uDpr + 0.5);
  vec2 q = corner + aCorner * aRect.zw;
  gl_Position = vec4(q.x / uViewport.x * 2.0 - 1.0, 1.0 - q.y / uViewport.y * 2.0, 0.0, 1.0);
  vUv = mix(aUv.xy, aUv.zw, aCorner);
  vColor = color * alpha;
}
`;

const LABEL_FRAGMENT = /* glsl */ `
precision mediump float;
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  float a = texture2D(uAtlas, vUv).a;
  if (a <= 0.004) discard;
  gl_FragColor = vec4(vColor * a, 0.0);
}
`;

/* ---------------- Geometría ---------------- */

const QUAD = [
  [0, -1], [1, -1], [1, 1],
  [0, -1], [1, 1], [0, 1],
];
const BOX = [
  [-1, -1], [1, -1], [1, 1],
  [-1, -1], [1, 1], [-1, 1],
];
const LABEL_QUAD = [
  [0, 0], [1, 0], [1, 1],
  [0, 0], [1, 1], [0, 1],
];

const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const LINE_FLOATS = 12;

const buildLines = (points: Vec3[], route: { p: Vec3; s: number }[]) => {
  const values: number[] = [];
  const segment = (a: Vec3, b: Vec3, style: [number, number, number, number]) => {
    for (const [cx, cy] of QUAD) values.push(a[0], a[1], a[2], b[0], b[1], b[2], cx, cy, ...style);
  };
  const circle = (radius: number, y: number, steps: number, style: [number, number, number, number], cx = 0, cz = 0) => {
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = ((i + 1) / steps) * Math.PI * 2;
      segment(
        [cx + Math.cos(a0) * radius, y, cz + Math.sin(a0) * radius],
        [cx + Math.cos(a1) * radius, y, cz + Math.sin(a1) * radius],
        style,
      );
    }
  };
  // Anillos del plano, cada vez más tenues hacia afuera, y un dial con marcas
  MAP_RINGS.forEach((radius, k) => circle(radius, MAP_PLANE, 120, [0, 0, 0, 0.12 - k * 0.022]));
  circle(MAP_DIAL, MAP_PLANE, 160, [0, 0, 0, 0.075]);
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    const inner = MAP_DIAL;
    const outer = MAP_DIAL + (long ? 0.17 : 0.07);
    segment(
      [Math.cos(angle) * inner, MAP_PLANE, Math.sin(angle) * inner],
      [Math.cos(angle) * outer, MAP_PLANE, Math.sin(angle) * outer],
      [0, 0, 0, long ? 0.14 : 0.08],
    );
  }
  // Tallos de cada estrella hasta el plano, con un pequeño pie
  points.forEach((p, j) => {
    segment(p, [p[0], MAP_PLANE, p[2]], [1, j, 0, 0.24]);
    circle(0.05, MAP_PLANE, 18, [3, j, 0, 0.32], p[0], p[2]);
  });
  // La ruta
  for (let i = 0; i < route.length - 1; i++) {
    segment(route[i].p, route[i + 1].p, [2, route[i].s, route[i + 1].s, 0.62]);
  }
  return new Float32Array(values);
};

const POINT_FLOATS = 9;

const buildPoints = (points: Vec3[], dust: number) => {
  const next = random(918273);
  const data = new Float32Array((dust + points.length) * QUAD.length * POINT_FLOATS);
  let offset = 0;
  const push = (p: Vec3, index: number, radius: number, bright: number, warm: number) => {
    for (const [cx, cy] of QUAD) {
      data.set([cx, cy, p[0], p[1], p[2], index, radius, bright, warm], offset);
      offset += POINT_FLOATS;
    }
  };
  for (let i = 0; i < dust; i++) {
    let p: Vec3;
    if (next() < 0.7) {
      // Un disco grueso alrededor de la ruta
      const radius = 0.25 + 4.4 * Math.pow(next(), 0.75);
      const angle = next() * Math.PI * 2;
      const height = (next() + next() + next() - 1.5) * 0.55;
      p = [Math.cos(angle) * radius, height, Math.sin(angle) * radius];
    } else {
      // Fondo lejano en todas direcciones
      const u = next() * 2 - 1;
      const angle = next() * Math.PI * 2;
      const radius = 7 + 9 * next();
      const ring = Math.sqrt(1 - u * u);
      p = [Math.cos(angle) * ring * radius, u * radius, Math.sin(angle) * ring * radius];
    }
    push(p, -1, 0.55 + 1.05 * Math.pow(next(), 3), 0.14 + 0.62 * Math.pow(next(), 2.4), next());
  }
  points.forEach((p, j) => push(p, j, 0, 0, 0));
  return data;
};

const buildSprites = (points: Vec3[]) => {
  const data = new Float32Array(points.length * BOX.length * 6);
  let offset = 0;
  points.forEach((p, j) => {
    for (const [cx, cy] of BOX) {
      data.set([cx, cy, p[0], p[1], p[2], j], offset);
      offset += 6;
    }
  });
  return data;
};

const LABEL_FLOATS = 16;

const buildLabels = (points: Vec3[], labels: MapLabel[], atlasW: number, atlasH: number) => {
  // El rótulo sin punto propio ("estás aquí") se repite en todos
  const shown = labels.flatMap((label) => label.index < 0
    ? points.map((_, index) => ({ ...label, index }))
    : points[label.index] ? [label] : []);
  const data = new Float32Array(shown.length * LABEL_QUAD.length * LABEL_FLOATS);
  let offset = 0;
  for (const label of shown) {
    const p = points[label.index];
    const u0 = label.u / atlasW;
    const v0 = label.v / atlasH;
    const u1 = (label.u + label.w) / atlasW;
    const v1 = (label.v + label.h) / atlasH;
    for (const [cx, cy] of LABEL_QUAD) {
      data.set([cx, cy, p[0], p[1], p[2], label.index, label.ox, label.oy, label.w, label.h, u0, v0, u1, v1, label.kind, label.extent], offset);
      offset += LABEL_FLOATS;
    }
  }
  return { data, vertices: shown.length * LABEL_QUAD.length };
};

/* ---------------- Dibujante ---------------- */

type Attribute = [location: number, size: number, offset: number];

export const createMapRenderer = (
  gl: WebGLRenderingContext,
  link: (vertex: string, fragment: string) => GlProgram,
  pointFragment: string,
) => {
  const line = link(LINE_VERTEX, LINE_FRAGMENT);
  const sprite = link(SPRITE_VERTEX, SPRITE_FRAGMENT);
  const point = link(POINT_VERTEX, pointFragment);
  const label = link(LABEL_VERTEX, LABEL_FRAGMENT);
  const work = link(WORK_VERTEX, WORK_FRAGMENT);
  const trail = link(TRAIL_VERTEX, TRAIL_FRAGMENT);

  const lineBuffer = gl.createBuffer();
  const pointBuffer = gl.createBuffer();
  const spriteBuffer = gl.createBuffer();
  const labelBuffer = gl.createBuffer();
  const workBuffer = gl.createBuffer();
  const trailBuffer = gl.createBuffer();
  const atlas = gl.createTexture();

  const attributes = (program: GlProgram, names: [string, number][]): Attribute[] => {
    let offset = 0;
    return names.map(([name, size]) => {
      const entry: Attribute = [program.attribute(name), size, offset];
      offset += size;
      return entry;
    });
  };
  const lineAttributes = attributes(line, [['aA', 3], ['aB', 3], ['aCorner', 2], ['aStyle', 4]]);
  const spriteAttributes = attributes(sprite, [['aCorner', 2], ['aPoint', 4]]);
  const pointAttributes = attributes(point, [['aCorner', 2], ['aPos', 4], ['aLook', 3]]);
  const labelAttributes = attributes(label, [['aCorner', 2], ['aAnchor', 4], ['aRect', 4], ['aUv', 4], ['aKind', 2]]);
  const workAttributes = attributes(work, [['aCorner', 2], ['aCenter', 4], ['aOrbit', 4], ['aLook', 4]]);
  const trailAttributes = attributes(trail, [
    ['aCorner', 2], ['aCenterA', 4], ['aOrbitA', 4], ['aCenterB', 4], ['aOrbitB', 4], ['aSegment', 1],
  ]);
  const all = [lineAttributes, spriteAttributes, pointAttributes, labelAttributes, workAttributes, trailAttributes].flat();

  let count = 0;
  let lineVertices = 0;
  let pointVertices = 0;
  let spriteVertices = 0;
  let labelVertices = 0;
  let dustCount = 0;
  let points: Vec3[] = [];
  let labelSource: { labels: MapLabel[]; width: number; height: number } | null = null;
  let constellation: MapConstellation | null = null;
  let constellationPoints: Vec3[] = [];
  let workVertices = 0;
  let trailVertices = 0;

  /* La constelación cambia solo al abrir el mapa: sus estrellas y tramos
     se suben una vez y el giro de los cúmulos lo hace el shader */
  const prepareConstellation = (next: MapConstellation | null) => {
    if (next === constellation && constellationPoints === points) return;
    constellation = next;
    constellationPoints = points;
    if (!next) {
      workVertices = 0;
      trailVertices = 0;
      return;
    }
    const built = buildConstellation(points, next);
    gl.bindBuffer(gl.ARRAY_BUFFER, workBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, built.work, gl.STATIC_DRAW);
    workVertices = built.work.length / WORK_FLOATS;
    gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, built.trail, gl.STATIC_DRAW);
    trailVertices = built.trail.length / TRAIL_FLOATS;
  };

  const upload = (buffer: WebGLBuffer | null, data: Float32Array) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  };

  const rebuildLabels = () => {
    if (!labelSource || !points.length) {
      labelVertices = 0;
      return;
    }
    const built = buildLabels(points, labelSource.labels, labelSource.width, labelSource.height);
    upload(labelBuffer, built.data);
    labelVertices = built.vertices;
  };

  /* La geometría depende solo del número de puntos y de la densidad de polvo */
  const prepare = (points_: number, dust: number) => {
    if (points_ === count && dust === dustCount) return;
    const layout = buildMapLayout(points_);
    points = layout.points;
    const lines = buildLines(points, layout.route);
    upload(lineBuffer, lines);
    lineVertices = lines.length / LINE_FLOATS;
    const pointData = buildPoints(points, dust);
    upload(pointBuffer, pointData);
    pointVertices = pointData.length / POINT_FLOATS;
    const sprites = buildSprites(points);
    upload(spriteBuffer, sprites);
    spriteVertices = sprites.length / 6;
    count = points_;
    dustCount = dust;
    rebuildLabels();
  };

  const setAtlas = (image: ImageBitmap | null, labels: MapLabel[], width: number, height: number) => {
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    image?.close();
    labelSource = { labels, width, height };
    rebuildLabels();
  };

  const bind = (buffer: WebGLBuffer | null, used: Attribute[], floats: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [location] of all) if (location >= 0) gl.disableVertexAttribArray(location);
    for (const [location, size, offset] of used) {
      if (location < 0) continue;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, floats * 4, offset * 4);
    }
  };

  const common = (program: GlProgram, frame: MapFrame, viewport: [number, number], dpr: number) => {
    gl.useProgram(program.program);
    gl.uniformMatrix4fv(program.uniform('uViewProj'), false, frame.viewProj);
    gl.uniform2f(program.uniform('uViewport'), viewport[0], viewport[1]);
    gl.uniform1f(program.uniform('uDpr'), dpr);
    gl.uniform3fv(program.uniform('uColors'), frame.colors);
    gl.uniform4fv(program.uniform('uPoints'), frame.points);
    gl.uniform1f(program.uniform('uCount'), frame.count);
  };

  const trailUniforms = (program: GlProgram, frame: MapFrame) => {
    gl.uniform1f(program.uniform('uAlpha'), frame.alpha);
    gl.uniform1f(program.uniform('uTime'), frame.time);
    gl.uniform1f(program.uniform('uTrail'), frame.trail);
    gl.uniform1f(program.uniform('uTrailClock'), frame.trailClock);
    gl.uniform1f(program.uniform('uTrailCount'), frame.trailCount);
  };

  /* Antes de las estelas del salto: el mapa queda detrás del hiperespacio */
  const draw = (frame: MapFrame, viewport: [number, number], dpr: number) => {
    const dust = Math.round(Math.min(950, Math.max(420, (viewport[0] * viewport[1]) / (dpr * dpr * 1150))));
    prepare(frame.count, dust);

    if (frame.rings + frame.lines > 0.002) {
      common(line, frame, viewport, dpr);
      bind(lineBuffer, lineAttributes, LINE_FLOATS);
      gl.uniform1f(line.uniform('uLines'), frame.lines);
      gl.uniform1f(line.uniform('uRings'), frame.rings);
      gl.uniform1f(line.uniform('uRingScale'), frame.ringScale);
      gl.uniform1f(line.uniform('uReveal'), frame.reveal);
      gl.uniform1f(line.uniform('uHere'), frame.hereArc);
      gl.uniform1f(line.uniform('uTime'), frame.time);
      gl.drawArrays(gl.TRIANGLES, 0, lineVertices);
    }

    prepareConstellation(frame.constellation);

    // La línea del recorrido del visitante, bajo las estrellas
    if (trailVertices && frame.alpha > 0.002) {
      common(trail, frame, viewport, dpr);
      bind(trailBuffer, trailAttributes, TRAIL_FLOATS);
      trailUniforms(trail, frame);
      gl.drawArrays(gl.TRIANGLES, 0, trailVertices);
    }

    if (frame.alpha > 0.002) {
      common(sprite, frame, viewport, dpr);
      bind(spriteBuffer, spriteAttributes, 6);
      gl.uniform2fv(sprite.uniform('uProgress'), frame.progress);
      gl.uniform1f(sprite.uniform('uFocal'), frame.focal);
      gl.uniform1f(sprite.uniform('uAlpha'), frame.alpha);
      gl.uniform1f(sprite.uniform('uTime'), frame.time);
      gl.drawArrays(gl.TRIANGLES, 0, spriteVertices);
    }

    if (frame.dust + frame.alpha > 0.002) {
      common(point, frame, viewport, dpr);
      bind(pointBuffer, pointAttributes, POINT_FLOATS);
      gl.uniformMatrix4fv(point.uniform('uPrevViewProj'), false, frame.prevViewProj);
      gl.uniform1f(point.uniform('uFocal'), frame.focal);
      gl.uniform1f(point.uniform('uDust'), frame.dust);
      gl.uniform1f(point.uniform('uAlpha'), frame.alpha);
      gl.drawArrays(gl.TRIANGLES, 0, pointVertices);
    }

    // Las obras: polvo las no leídas, estrellas las leídas
    if (workVertices && frame.alpha > 0.002) {
      common(work, frame, viewport, dpr);
      bind(workBuffer, workAttributes, WORK_FLOATS);
      trailUniforms(work, frame);
      gl.drawArrays(gl.TRIANGLES, 0, workVertices);
    }

    if (labelVertices && frame.labels > 0.002) {
      common(label, frame, viewport, dpr);
      bind(labelBuffer, labelAttributes, LABEL_FLOATS);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.uniform1i(label.uniform('uAtlas'), 0);
      gl.uniform1f(label.uniform('uLabels'), frame.labels);
      gl.drawArrays(gl.TRIANGLES, 0, labelVertices);
    }
  };

  // Deja libres los atributos para los programas del salto
  const release = () => {
    for (const [location] of all) if (location >= 0) gl.disableVertexAttribArray(location);
  };

  setAtlas(null, [], 1, 1);

  return { draw, release, setAtlas, prepare };
};

export type MapRenderer = ReturnType<typeof createMapRenderer>;
