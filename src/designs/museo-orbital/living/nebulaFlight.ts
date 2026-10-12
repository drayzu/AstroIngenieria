import * as THREE from 'three';

/* ============ Intro: vuelo por la nebulosa ============
   La primera visita empieza dentro de la escena 3D de la portada. Sales del
   hiperespacio frente a una nebulosa fría, cruzas una franja de polvo y ves
   el gas caer girando hacia un punto hasta aplanarse en un disco. La cámara
   gira con él y se queda quieta; el núcleo late, contiene el aliento y la
   estrella se enciende. Su onda de choque viene hacia ti, te atraviesa, y el
   golpe te empuja hasta el encuadre de la portada, donde empieza la obra.

   Todo se mide en segundos del reloj del vuelo (lo avanza HeroIgnition) y,
   salvo la estrella y la onda de choque, en unidades locales: la nebulosa se
   escala con la distancia de la portada, así la composición es la misma en
   cualquier pantalla. La estrella mide 1 en unidades del mundo. */

export const FLIGHT = {
  // La velocidad del hiperespacio se apaga con esta constante
  hyperTau: 0.3,
  // La cámara deja de avanzar aquí y espera, quieta, el colapso
  approach: 4.1,
  // El gas gira cada vez más rápido y el núcleo late
  collapse: 2.9,
  // El núcleo contiene el aliento: la portada prepara su texto
  reveal: 4.2,
  ignite: 4.45,
  // La onda de choque alcanza la cámara
  hit: 4.75,
  // Del golpe al encuadre de la portada
  settle: 2.7,
  // El cielo 2D vuelve detrás de la escena
  landing: 5.45,
  // La cámara llegó: vuelven la barra y la marquesina
  end: 7.5,
};

/* ---------------- Trayectoria de la cámara ---------------- */

// Distancia de la portada en escritorio: la nebulosa se diseñó a esta escala
const D_REF = 6.3;
// Dónde espera la cámara la ignición, en unidades locales: algo más lejos que
// la portada, para ver el disco entero; después del golpe vuelve flotando
const IGNITE_DIST = 1.3 * D_REF;
// Dónde termina el hiperespacio y cuánto recorre la caída desde él
const FAR = 70;
const HYPER = 300;
// Vuelta alrededor del disco durante la llegada, y elevación sobre su plano
const SWING = 1.15;
const SETTLE_SWING = 1.1;
const ELEV_START = 0.62;
const ELEV_IGNITE = 0.12;
// Alabeo: la cámara se inclina al girar con el gas
const BANK = -0.26;
// Obturador: cuánto se mueve todo mientras se dibuja una estela
export const EXPOSURE = 0.035;

// Plano del disco: AXIS es su normal; E1 y E2 lo recorren en el sentido del giro
const AXIS = new THREE.Vector3(0.22, 1, 0.1).normalize();
const E1 = new THREE.Vector3(1, 0, 0).projectOnPlane(AXIS).normalize();
const E2 = new THREE.Vector3().crossVectors(AXIS, E1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3();
const VIEW_Z = new THREE.Vector3(0, 0, 1);
// La portada mira la estrella desde aquí (sin el paralaje del cursor): la
// cámara espera la ignición algo más atrás en el giro y lo completa al volver
const HOME_DIR = new THREE.Vector3(0, Math.sin(0.2), Math.cos(0.2));
const THETA_IGNITE = Math.atan2(HOME_DIR.dot(E2), HOME_DIR.dot(E1)) - SETTLE_SWING;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (from: number, to: number, value: number) => {
  const x = clamp01((value - from) / (to - from));
  return x * x * (3 - 2 * x);
};
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
// Temblor sin patrón visible: suma de senos inconmensurables
const wobble = (x: number) => Math.sin(x) * 0.6 + Math.sin(x * 2.31 + 1.7) * 0.4;

export interface FlightPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  fov: number;
  // Dónde cae el centro de la estrella en la pantalla, en px del hero
  cx: number;
  cy: number;
}

export interface FlightFrame {
  // Distancia de la cámara de la portada en este cuadro
  D: number;
  // Encuadre de la portada (con el paralaje del cursor): el vuelo termina en él
  home: FlightPose;
  // Dónde estaba el punto de arranque, en px del hero
  start: { x: number; y: number };
}

export const createPose = (): FlightPose => ({
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  fov: 30,
  cx: 0,
  cy: 0,
});

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const dirA = new THREE.Vector3();
const dirB = new THREE.Vector3();
const upBlend = new THREE.Vector3();

const orbitDir = (theta: number, phi: number, out: THREE.Vector3) =>
  out.copy(E1).multiplyScalar(Math.cos(theta) * Math.cos(phi))
    .addScaledVector(E2, Math.sin(theta) * Math.cos(phi))
    .addScaledVector(AXIS, Math.sin(phi));

const aim = (position: THREE.Vector3, up: THREE.Vector3, roll: number, out: THREE.Quaternion) => {
  tmpMatrix.lookAt(position, ORIGIN, up);
  out.setFromRotationMatrix(tmpMatrix);
  if (roll) out.multiply(tmpQuat.setFromAxisAngle(VIEW_Z, roll));
  return out;
};

const slerpDir = (from: THREE.Vector3, to: THREE.Vector3, t: number, out: THREE.Vector3) => {
  const angle = Math.acos(Math.min(1, Math.max(-1, from.dot(to))));
  if (angle < 1e-4) return out.copy(to);
  const sin = Math.sin(angle);
  return out.copy(from).multiplyScalar(Math.sin((1 - t) * angle) / sin).addScaledVector(to, Math.sin(t * angle) / sin);
};

/* Llegada, en unidades locales: la caída desde el hiperespacio frena de golpe
   y el resto del camino se acerca girando con el gas, cada vez más lento.
   Primero mira el disco desde arriba (se ven los brazos) y al final baja a
   su plano, donde la cámara espera de canto la ignición */
const approachLocal = (t: number, out: THREE.Vector3) => {
  const u = clamp01(t / FLIGHT.approach);
  const left = 1 - u;
  const dist = IGNITE_DIST + (FAR - IGNITE_DIST) * left ** 3 + HYPER * Math.exp(-t / FLIGHT.hyperTau);
  const phi = ELEV_IGNITE + (ELEV_START - ELEV_IGNITE) * (1 - smooth(0.55, 1, u));
  return orbitDir(THETA_IGNITE - SWING * left ** 2, phi, out).multiplyScalar(dist);
};

export const flightPose = (t: number, frame: FlightFrame, out: FlightPose) => {
  const scale = frame.D / D_REF;
  if (t < FLIGHT.hit) {
    approachLocal(t, out.position).multiplyScalar(scale);
    aim(out.position, AXIS, BANK * smooth(0.1, 1, t / FLIGHT.approach), out.quaternion);
    // Gran angular en el hiperespacio: se cierra al frenar
    out.fov = 30 + 18 * Math.exp(-t / 0.75);
    out.cx = frame.start.x;
    out.cy = frame.start.y;
  } else {
    // El golpe empuja la cámara hacia atrás de inmediato; después vuelve
    // flotando y el giro la lleva, sin prisa, hasta el encuadre de la portada
    const s = clamp01((t - FLIGHT.hit) / FLIGHT.settle);
    const swing = smoother(s);
    const kick = 1.5 * scale * (1 - Math.exp(-s * 14)) * Math.exp(-s * 4.5);
    orbitDir(THETA_IGNITE, ELEV_IGNITE, dirA);
    dirB.copy(frame.home.position).normalize();
    const start = IGNITE_DIST * scale;
    slerpDir(dirA, dirB, swing, out.position).multiplyScalar(start + (frame.home.position.length() - start) * swing + kick);
    upBlend.copy(AXIS).lerp(WORLD_UP, swing).normalize();
    aim(out.position, upBlend, BANK * (1 - swing), out.quaternion);
    out.fov = 30;
    // La estrella se aparta hacia su lugar antes de que termine el giro: el
    // título entra en el espacio que ella deja
    const glide = smoother(clamp01((s - 0.04) / 0.62));
    out.cx = frame.start.x + (frame.home.cx - frame.start.x) * glide;
    out.cy = frame.start.y + (frame.home.cy - frame.start.y) * glide;
  }
  // Un temblor que crece con el colapso y la sacudida del golpe
  const tremor = t < FLIGHT.ignite ? 0.0022 * smooth(FLIGHT.collapse, FLIGHT.ignite, t) : 0;
  const jolt = t >= FLIGHT.hit ? 0.022 * Math.exp(-(t - FLIGHT.hit) / 0.32) : 0;
  const amp = tremor + jolt;
  if (amp > 1e-5) {
    tmpEuler.set(amp * wobble(t * 41), amp * wobble(t * 37 + 2.1), amp * 0.7 * wobble(t * 29 + 4.3));
    out.quaternion.multiply(tmpQuat.setFromEuler(tmpEuler));
  }
  return out;
};

/* ---------------- Azar con semilla ---------------- */

const random = (() => {
  let state = 0x2f6b9a1d;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
})();

const gaussian = () => (random() + random() + random() - 1.5) * 1.15;

/* ---------------- Núcleo: brillo y latido ---------------- */

// Cuánto ha caído el gas (0 al llegar, 1 en la ignición), cada vez más rápido
const collapseAt = (t: number) => clamp01(t / FLIGHT.ignite) ** 2.4;

// Latidos que se aceleran durante el colapso (fase integrada a mano)
const heartbeat = (t: number) => {
  const x = Math.max(0, t - FLIGHT.collapse);
  const phase = x * 7 + x * x * 3.2;
  return Math.pow(0.5 + 0.5 * Math.sin(phase - Math.PI / 2), 6);
};

// Justo antes de encenderse el núcleo se contrae: contiene el aliento
const HOLD = 0.28;

// La luz que el núcleo echa sobre las nubes: crece y se contiene, sin latir
// (nubes que laten se leen como un parpadeo)
const cloudLight = (t: number) =>
  t >= FLIGHT.ignite ? 0 : (1 + 0.5 * smooth(1.5, 3.2, t)) * (1 - 0.35 * smooth(FLIGHT.ignite - HOLD, FLIGHT.ignite - 0.06, t));

const coreLight = (t: number) => {
  if (t >= FLIGHT.ignite) return 0;
  const hold = 1 - 0.55 * smooth(FLIGHT.ignite - HOLD, FLIGHT.ignite - 0.06, t);
  const beat = 1 + 0.9 * heartbeat(t) * smooth(FLIGHT.collapse, FLIGHT.collapse + 0.4, t) * (1 - smooth(FLIGHT.ignite - HOLD, FLIGHT.ignite - 0.12, t));
  return (1 + 0.5 * smooth(1.5, 3.2, t)) * beat * hold;
};

/* ---------------- Ruido (GLSL) ---------------- */

const VALUE_NOISE = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
`;

/* ---------------- Cielo lejano ---------------- */

/* Una esfera pegada a la cámara: la nebulosa del fondo está en el infinito,
   así solo se mueve cuando la cámara gira o se alabea */
const SKY_BLOBS = 11;

const SKY_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uBlobDir[${SKY_BLOBS}];
uniform vec4 uBlobColor[${SKY_BLOBS}];
uniform float uFade;
varying vec3 vWorld;
${VALUE_NOISE}
void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  vec3 color = vec3(0.0);
  for (int i = 0; i < ${SKY_BLOBS}; i++) {
    float away = 1.0 - dot(dir, uBlobDir[i]);
    color += uBlobColor[i].rgb * exp(-away / uBlobColor[i].a);
  }
  // Filamentos: el ruido corta los mantos en jirones
  float n = vnoise(dir * 3.2) * 0.62 + vnoise(dir * 8.1 + 3.7) * 0.38;
  color *= 0.04 + 2.4 * n * n * n;
  gl_FragColor = vec4(color * uFade, 0.0);
}
`;

/* ---------------- Estelas: estrellas y gas ---------------- */

/* Cada estela es un rectángulo en pantalla entre dónde está el punto ahora
   y dónde estaba hace un instante (con la cámara de ese instante): así la
   velocidad de la cámara y la del gas se dibujan solas. Quieta, es un punto
   redondo. Las estelas largas se atenúan: la misma luz repartida. */
const STREAK_COMMON = /* glsl */ `
uniform mat4 uPrevViewProj;
uniform vec2 uViewport;
uniform float uDpr;
varying vec2 vLocal;
varying float vLen;
varying float vRadius;
varying vec3 vColor;
void streak(vec3 headLocal, vec3 tailLocal, float width, vec3 color) {
  vec4 head = projectionMatrix * viewMatrix * modelMatrix * vec4(headLocal, 1.0);
  vec4 tail = uPrevViewProj * modelMatrix * vec4(tailLocal, 1.0);
  if (head.w < 0.05 || tail.w < 0.05 || dot(color, color) < 1e-7) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec3(0.0);
    vLocal = vec2(0.0);
    vLen = 0.0;
    vRadius = 1.0;
    return;
  }
  vec2 h = head.xy / head.w * 0.5 * uViewport;
  vec2 b = tail.xy / tail.w * 0.5 * uViewport;
  float len = length(h - b);
  float cap = uViewport.y * 0.75;
  if (len > cap) {
    b = h - (h - b) * (cap / len);
    len = cap;
  }
  vec2 n = len > 1e-3 ? (h - b) / len : vec2(1.0, 0.0);
  vec2 side = vec2(-n.y, n.x);
  float r = width * 0.5;
  vec2 p = mix(b - n * r, h + n * r, position.x) + side * position.y * r;
  vLocal = vec2(mix(-r, len + r, position.x), position.y * r);
  vLen = len;
  vRadius = r;
  vColor = color;
  gl_Position = vec4(p / (0.5 * uViewport), clamp(head.z / head.w, -1.0, 1.0), 1.0);
}
`;

const STREAK_FRAGMENT = /* glsl */ `
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
  float intensity = core * mix(0.1, 1.0, along * along) * (0.3 + 0.7 * spread);
  gl_FragColor = vec4(vColor * intensity, 0.0);
}
`;

const STAR_VERTEX = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aLook;
uniform float uFade;
${STREAK_COMMON}
void main() {
  vec3 color = mix(vec3(0.62, 0.74, 1.0), vec3(1.0, 0.86, 0.72), aLook.z) * aLook.x * uFade;
  streak(aPos, aPos, aLook.y * uDpr, color);
}
`;

const GAS_VERTEX = /* glsl */ `
attribute vec4 aOrbit;
attribute vec4 aLook;
uniform float uTime;
uniform float uIgnite;
uniform float uExposure;
uniform float uShock;
uniform float uStar;
uniform float uSpin;
uniform float uFade;
uniform vec3 uAxis;
uniform vec3 uE1;
uniform vec3 uE2;
${STREAK_COMMON}
// Órbita que se cierra: el radio cae hacia el disco, la altura se aplana y la
// velocidad angular sube con la caída (integrada a mano, sin pasos)
vec3 gasAt(float t, out float glow) {
  float T = uIgnite;
  float tc = clamp(t, 0.0, T);
  float x = tc / T;
  float k = pow(x, 2.4);
  float r = mix(aOrbit.x, aOrbit.w, k);
  float w0 = uSpin * pow(aOrbit.x, -1.5);
  float wf = uSpin * pow(aOrbit.w, -1.5);
  float theta = aOrbit.y + w0 * tc + (wf - w0) * T * pow(x, 3.4) / 3.4;
  float h = aOrbit.z * mix(1.0, 0.04, pow(x, 1.6));
  glow = 0.0;
  if (t > T) {
    // La onda de choque alcanza la partícula y la lanza hacia fuera
    float dt = t - T;
    theta += wf * dt;
    float hitAt = max(0.0, (length(vec2(r, h)) - uStar) / uShock);
    float since = max(0.0, dt - hitAt);
    float push = aLook.w * (1.0 - exp(-since / 0.5));
    h *= 1.0 + push / max(r, 0.5);
    r += push;
    glow = step(hitAt, dt) * exp(-since / 0.35);
  }
  return (uE1 * cos(theta) + uE2 * sin(theta)) * r + uAxis * h;
}
void main() {
  float glow;
  float glowPrev;
  vec3 head = gasAt(uTime, glow);
  vec3 tail = gasAt(uTime - uExposure, glowPrev);
  float k = pow(clamp(uTime / uIgnite, 0.0, 1.0), 2.4);
  float radius = length(head);
  // El gas se calienta al caer: frío y azul afuera, tibio cerca del núcleo
  float inner = 1.0 - smoothstep(1.2, 4.0, radius);
  float heat = clamp(aLook.z * k * (0.35 + 0.65 * inner), 0.0, 1.0);
  vec3 color = mix(vec3(0.42, 0.56, 1.0), vec3(1.0, 0.72, 0.5), heat);
  float bright = aLook.x * (0.45 + 0.55 * k) * (0.35 + 0.65 / (1.0 + radius * radius * 0.015));
  float dt = uTime - uIgnite;
  if (dt > 0.0) {
    color = mix(color, vec3(1.0, 0.8, 0.6), smoothstep(0.0, 0.25, dt));
    bright *= (1.0 + 3.5 * glow) * (1.0 - smoothstep(0.5, 2.1, dt));
  }
  vec4 view = viewMatrix * modelMatrix * vec4(head, 1.0);
  float width = aLook.y * clamp(3.2 / max(0.1, -view.z), 0.7, 3.2) * uDpr;
  streak(head, tail, width, color * bright * uFade);
}
`;

/* ---------------- Disco de acreción ---------------- */

/* El cuerpo continuo del disco, bajo las estelas del gas: brazos en espiral
   que se enrollan con la rotación diferencial (más rápido adentro) y se
   calientan hacia el centro a medida que el gas cae. En la ignición la onda
   de choque lo despedaza hacia fuera */
const DISK_VERTEX = /* glsl */ `
varying vec2 vPlane;
void main() {
  vPlane = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const DISK_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uIgnite;
uniform float uSpin;
uniform float uGlow;
varying vec2 vPlane;
${VALUE_NOISE}
void main() {
  float r = length(vPlane);
  float theta = atan(vPlane.y, vPlane.x);
  float k = pow(clamp(uTime / uIgnite, 0.0, 1.0), 2.4);
  float tc = min(uTime, uIgnite);
  float swirl = theta - uSpin * pow(r, -1.5) * tc * (0.35 + 0.65 * k);
  float arms = pow(0.5 + 0.5 * cos(3.0 * swirl + 4.2 * log(r)), 2.0);
  // El grano gira con el gas; en cartesianas para no cortarse donde el ángulo salta
  vec2 q = vec2(cos(swirl), sin(swirl)) * r;
  float grain = vnoise(vec3(q * 2.3, 0.0)) * 0.6 + vnoise(vec3(q * 6.8, 3.1)) * 0.4;
  float profile = smoothstep(1.02, 1.3, r) * (1.0 - smoothstep(1.9, 3.5, r));
  float inner = exp(-(r - 1.1) * 1.3);
  float body = profile * (0.22 + 0.78 * arms) * (0.4 + 0.95 * grain) * (0.3 + inner);
  vec3 color = mix(vec3(0.42, 0.56, 1.0), vec3(1.0, 0.74, 0.52), clamp(k * inner * 1.4, 0.0, 1.0));
  gl_FragColor = vec4(color * body * uGlow, 0.0);
}
`;

const streakQuad = () => {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
};

// Luz que suma sin tocar el alfa del lienzo: sobre la página se ve como brillo
const addLight = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const;

/* Estrellas en un tubo alrededor de la trayectoria (las que pasan rozando
   durante la caída) y un cielo lejano que queda al final */
const buildStars = (count: number) => {
  const pos = new Float32Array(count * 3);
  const look = new Float32Array(count * 4);
  const samples = 480;
  const points: THREE.Vector3[] = [];
  const lengths: number[] = [0];
  for (let index = 0; index <= samples; index++) {
    points.push(approachLocal((index / samples) * FLIGHT.approach, new THREE.Vector3()));
    if (index) lengths.push(lengths[index - 1] + points[index].distanceTo(points[index - 1]));
  }
  const total = lengths[samples];
  const tangent = new THREE.Vector3();
  const sideA = new THREE.Vector3();
  const sideB = new THREE.Vector3();
  const star = new THREE.Vector3();
  for (let index = 0; index < count; index++) {
    if (random() < 0.32) {
      star.set(gaussian(), gaussian(), gaussian()).normalize().multiplyScalar(260 + random() * 160);
    } else {
      const along = random() * total;
      let segment = 1;
      while (segment < samples && lengths[segment] < along) segment++;
      const mix = (along - lengths[segment - 1]) / Math.max(1e-6, lengths[segment] - lengths[segment - 1]);
      star.copy(points[segment - 1]).lerp(points[segment], mix);
      tangent.copy(points[segment]).sub(points[segment - 1]).normalize();
      sideA.copy(Math.abs(tangent.y) < 0.9 ? WORLD_UP : VIEW_Z).cross(tangent).normalize();
      sideB.crossVectors(tangent, sideA);
      const reach = 1.6 + 42 * random() ** 1.7;
      const angle = random() * Math.PI * 2;
      star.addScaledVector(sideA, Math.cos(angle) * reach).addScaledVector(sideB, Math.sin(angle) * reach);
      // Ninguna dentro de la nebulosa: ahí solo hay gas
      const distance = star.length();
      if (distance < 15) star.multiplyScalar((15 + random() * 12) / Math.max(distance, 1e-3));
    }
    pos.set([star.x, star.y, star.z], index * 3);
    look.set([0.32 + 0.95 * random() ** 2.2, 1.3 + 1.4 * random() ** 2, random(), 0], index * 4);
  }
  return { pos, look };
};

/* Gas: tres brazos que caen enrollándose hacia un disco delgado */
const buildGas = (count: number) => {
  const orbit = new Float32Array(count * 4);
  const look = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) {
    const r0 = 4.5 + 22 * random() ** 1.3;
    const arm = Math.floor(random() * 3) * ((Math.PI * 2) / 3);
    const theta = arm + 1.1 * Math.log(r0) + gaussian() * 0.38;
    const h0 = gaussian() * r0 * 0.32;
    const rf = 1.12 + 2.1 * random() ** 1.35;
    const knot = random() < 0.05;
    orbit.set([r0, theta, h0, rf], index * 4);
    look.set([
      knot ? 1.5 : 0.28 + 0.6 * random(),
      knot ? 3.4 : 1.8 + 1.6 * random(),
      0.55 + 0.45 * random(),
      6 + 16 * random() ** 1.5,
    ], index * 4);
  }
  return { orbit, look };
};

/* ---------------- Nubes: polvo y gas ionizado ---------------- */

/* Atlas de cuatro nubes: manchas suaves con bordes deshilachados (ruido de
   valor fractal), generado una vez mientras espera el punto de arranque */
const makeAtlas = () => {
  const size = 256;
  const half = size / 2;
  const data = new Uint8Array(size * size * 4);
  const hash = (x: number, y: number, seed: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const noise = (x: number, y: number, seed: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi, seed);
    const b = hash(xi + 1, yi, seed);
    const c = hash(xi, yi + 1, seed);
    const d = hash(xi + 1, yi + 1, seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (x: number, y: number, seed: number, octaves: number) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let octave = 0; octave < octaves; octave++) {
      sum += amp * noise(x, y, seed + octave * 3.1);
      norm += amp;
      x = x * 2.03 + 1.7;
      y = y * 2.03 - 0.9;
      amp *= 0.5;
    }
    return sum / norm;
  };
  for (let tile = 0; tile < 4; tile++) {
    const ox = (tile % 2) * half;
    const oy = Math.floor(tile / 2) * half;
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const u = ((x + 0.5) / half) * 2 - 1;
        const v = ((y + 0.5) / half) * 2 - 1;
        const d = Math.hypot(u, v);
        const shape = fbm(u * 1.7 + tile * 5.3, v * 1.7 - tile * 2.9, tile, 4);
        const detail = fbm(u * 4.6 - tile * 1.3, v * 4.6 + tile * 3.7, tile + 11, 4);
        const edge = d + (shape - 0.5) * 1.15;
        let density = (1 - smooth(0.12, 1, edge)) * (1 - smooth(0.8, 1, d));
        density *= 0.3 + 0.95 * detail;
        const value = Math.round(clamp01(density ** 1.25) * 255);
        const offset = ((oy + y) * size + ox + x) * 4;
        data[offset] = value;
        data[offset + 1] = value;
        data[offset + 2] = value;
        data[offset + 3] = 255;
      }
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

const PUFF_VERTEX = /* glsl */ `
attribute vec3 aCenter;
attribute vec4 aShape;
attribute vec4 aTint;
varying vec2 vUv;
varying vec4 vTint;
varying float vTile;
void main() {
  vec4 view = modelViewMatrix * vec4(aCenter, 1.0);
  float c = cos(aShape.z);
  float s = sin(aShape.z);
  vec2 corner = position.xy * aShape.xy;
  view.xy += vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);
  gl_Position = projectionMatrix * view;
  vUv = position.xy;
  vTint = aTint;
  vTile = aShape.w;
}
`;

// Alfa premultiplicado: el gas ionizado suma luz (alfa 0) y el polvo tapa
const PUFF_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec4 vTint;
varying float vTile;
void main() {
  // La nube elige su tile con un entero que llega interpolado: 2.0 puede
  // llegar como 1.9999 y leer otro tile (la nube parpadea). Se redondea
  float tile = floor(vTile + 0.5);
  float m;
  if (tile < 3.5) {
    vec2 cell = vec2(mod(tile, 2.0), floor(tile / 2.0));
    m = texture2D(uAtlas, (cell + vUv * 0.5 + 0.5) * 0.5).r;
  } else if (tile < 4.5) {
    // Núcleo: un punto encandilado con su halo
    float r = length(vUv);
    m = (exp(-r * r * 26.0) + 0.3 * exp(-r * 6.0)) * (1.0 - smoothstep(0.75, 1.0, r));
  } else if (tile < 5.5) {
    // Destello anamórfico: una línea horizontal que se apaga hacia los lados
    float fall = 1.0 - abs(vUv.x);
    m = (exp(-vUv.y * vUv.y * 90.0) + 0.25 * exp(-vUv.y * vUv.y * 9.0)) * fall * fall * fall;
  } else {
    // Resplandor ancho de la estrella recién nacida (el disco lo tapa al centro)
    float r = length(vUv);
    m = exp(-r * 3.4) * (1.0 - smoothstep(0.55, 1.0, r));
  }
  if (m < 0.002) discard;
  gl_FragColor = vTint * m;
}
`;

interface Puff {
  base: THREE.Vector3;
  radius: number;
  dust: boolean;
  tint: [number, number, number];
  // Polvo: opacidad; gas ionizado: intensidad
  amount: number;
  rot: number;
  spin: number;
  tile: number;
  aspect: number;
  push: number;
  swirl: number;
}

// Gas frío: turquesa y acero, con algo de rosa del hidrógeno
const EMISSION = [
  [0.05, 0.15, 0.19],
  [0.07, 0.11, 0.22],
  [0.05, 0.13, 0.16],
  [0.17, 0.06, 0.1],
] as const;

const DUST_BASE = [0.012, 0.011, 0.016] as const;
// La luz de la estrella sobre el gas y el polvo
const WARM = [1, 0.56, 0.3] as const;

const makePuff = (base: THREE.Vector3, radius: number, dust: boolean, aspect = 1): Puff => {
  const tint = EMISSION[Math.floor(random() * EMISSION.length)];
  return {
    base,
    radius,
    dust,
    tint: [tint[0], tint[1], tint[2]],
    amount: dust ? 0.6 + 0.3 * random() : 0.45 + 0.65 * random(),
    rot: random() * Math.PI * 2,
    spin: (random() - 0.5) * 0.12,
    tile: Math.floor(random() * 4),
    aspect,
    push: 0.5 + random() * 1.1,
    swirl: 0.35 * Math.pow(Math.max(base.length(), 2), -1.5),
  };
};

const segmentDistance = (point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
  const ab = b.clone().sub(a);
  const t = clamp01(point.clone().sub(a).dot(ab) / ab.lengthSq());
  return point.distanceTo(a.clone().addScaledVector(ab, t));
};

const buildPuffs = (scale: number) => {
  const puffs: Puff[] = [];
  const cameraAtIgnite = approachLocal(FLIGHT.approach, new THREE.Vector3());
  const along = (t: number) => approachLocal(t, new THREE.Vector3());
  // Capullo: la nube que envuelve al disco; deja libre la vista de la ignición
  let tries = 0;
  while (puffs.length < Math.round(30 * scale) && tries++ < 400) {
    const r = 3 + 7 * random() ** 0.8;
    const theta = random() * Math.PI * 2;
    const p = orbitDir(theta, 0, new THREE.Vector3()).multiplyScalar(r).addScaledVector(AXIS, gaussian() * r * 0.35);
    const radius = 1.5 + 1.6 * random();
    if (p.distanceTo(cameraAtIgnite) < radius + 1.4) continue;
    if (segmentDistance(p, cameraAtIgnite, ORIGIN) < radius * 0.95) continue;
    puffs.push(makePuff(p, radius, random() < 0.38));
  }
  // Franja de polvo que la cámara atraviesa a mitad de camino
  const laneCenter = along(2.0);
  const laneNormal = along(2.05).sub(along(1.95)).normalize();
  const laneA = new THREE.Vector3().copy(WORLD_UP).cross(laneNormal).normalize();
  const laneB = new THREE.Vector3().crossVectors(laneNormal, laneA);
  for (let index = 0; index < Math.round(22 * scale); index++) {
    const angle = random() * Math.PI * 2;
    const radius = 1.3 + 1.3 * random();
    const reach = radius * 0.45 + 6.5 * random() ** 1.1;
    const p = laneCenter.clone()
      .addScaledVector(laneA, Math.cos(angle) * reach)
      .addScaledVector(laneB, Math.sin(angle) * reach)
      .addScaledVector(laneNormal, gaussian() * 1.1);
    puffs.push(makePuff(p, radius, random() < 0.72, 0.75 + 0.25 * random()));
  }
  // Jirones a lo largo del camino: pasan rozando mientras la cámara frena
  for (let index = 0; index < Math.round(26 * scale); index++) {
    const t = 0.5 + 1.35 * random();
    const center = along(t);
    const forward = along(t + 0.02).sub(center).normalize();
    const sideA = new THREE.Vector3().copy(WORLD_UP).cross(forward).normalize();
    const sideB = new THREE.Vector3().crossVectors(forward, sideA);
    const spread = Math.sqrt(center.length() / 20);
    const angle = random() * Math.PI * 2;
    const reach = (1.6 + 4.2 * random()) * spread;
    const p = center.addScaledVector(sideA, Math.cos(angle) * reach).addScaledVector(sideB, Math.sin(angle) * reach);
    puffs.push(makePuff(p, (1.1 + 2 * random()) * spread, random() < 0.2, 0.38 + 0.25 * random()));
  }
  return puffs;
};

const puffQuad = () => {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
};

interface PuffLayer {
  mesh: THREE.Mesh;
  center: THREE.InstancedBufferAttribute;
  shape: THREE.InstancedBufferAttribute;
  tint: THREE.InstancedBufferAttribute;
  geometry: THREE.InstancedBufferGeometry;
  count: number;
}

const makePuffLayer = (capacity: number, material: THREE.Material, renderOrder: number): PuffLayer => {
  const geometry = puffQuad();
  const dynamic = (size: number) => {
    const attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size);
    attribute.setUsage(THREE.DynamicDrawUsage);
    return attribute;
  };
  const center = dynamic(3);
  const shape = dynamic(4);
  const tint = dynamic(4);
  geometry.setAttribute('aCenter', center);
  geometry.setAttribute('aShape', shape);
  geometry.setAttribute('aTint', tint);
  geometry.instanceCount = 0;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  return { mesh, center, shape, tint, geometry, count: 0 };
};

interface PuffDraw {
  depth: number;
  x: number;
  y: number;
  z: number;
  halfW: number;
  halfH: number;
  rot: number;
  tile: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

const pushDraw = (layer: PuffLayer, draw: PuffDraw) => {
  const index = layer.count++;
  layer.center.setXYZ(index, draw.x, draw.y, draw.z);
  layer.shape.setXYZW(index, draw.halfW, draw.halfH, draw.rot, draw.tile);
  layer.tint.setXYZW(index, draw.r, draw.g, draw.b, draw.a);
};

const commitLayer = (layer: PuffLayer) => {
  layer.geometry.instanceCount = layer.count;
  layer.center.needsUpdate = true;
  layer.shape.needsUpdate = true;
  layer.tint.needsUpdate = true;
  if (layer.count) {
    layer.center.addUpdateRange(0, layer.count * 3);
    layer.shape.addUpdateRange(0, layer.count * 4);
    layer.tint.addUpdateRange(0, layer.count * 4);
  }
};

/* ---------------- Onda de choque ---------------- */

/* Una cáscara delgada: el borde brilla más porque la mirada la cruza de
   lado (el camino por dentro del gas es más largo). Tres cáscaras apenas
   separadas, roja, verde y azul, la abren en colores en los bordes */
const SHOCK_VERTEX = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vView;
varying vec3 vObject;
void main() {
  vObject = position;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vView = view.xyz;
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * view;
}
`;

const SHOCK_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
varying vec3 vNormalView;
varying vec3 vView;
varying vec3 vObject;
${VALUE_NOISE}
void main() {
  float facing = abs(dot(normalize(vNormalView), normalize(-vView)));
  float limb = 0.018 / max(facing, 0.018);
  float n = vnoise(vObject * 3.5 + vec3(uTime * 0.8, 0.0, -uTime * 0.5));
  gl_FragColor = vec4(uColor * limb * (0.4 + 1.1 * n) * uAlpha, 0.0);
}
`;

const SHOCK_TINTS = [
  new THREE.Color(1, 0.42, 0.3),
  new THREE.Color(0.9, 0.78, 0.55),
  new THREE.Color(0.35, 0.55, 1),
];
const SHOCK_LAG = [1, 0.975, 0.95];

/* ---------------- Montaje ---------------- */

export interface FlightUpdate {
  t: number;
  camera: THREE.PerspectiveCamera;
  prevViewProj: THREE.Matrix4;
  // Distancia de la portada: fija la escala de la nebulosa
  D: number;
  // Tamaño del búfer de dibujo, en px del dispositivo
  buffer: THREE.Vector2;
  dpr: number;
  // px (CSS) por unidad a profundidad 1, con el fov de este cuadro
  pxPerUnit: number;
  // Alto del marco del hero, en px CSS
  frameHeight: number;
  frameWidth: number;
}

export const createNebulaFlight = (narrow: boolean) => {
  const root = new THREE.Group();
  const local = new THREE.Group();
  root.add(local);

  // Cielo
  const blobDir: THREE.Vector3[] = [];
  const blobColor: THREE.Vector4[] = [];
  const skyTints = [
    [0.07, 0.05, 0.13],
    [0.03, 0.05, 0.13],
    [0.02, 0.07, 0.09],
    [0.08, 0.035, 0.07],
  ];
  for (let index = 0; index < SKY_BLOBS - 2; index++) {
    // Un manto ancho a lo largo de una banda, como la Vía Láctea, y nubes sueltas
    const inBand = index < 6;
    const dir = inBand
      ? orbitDir((index / 6) * Math.PI * 2 + random() * 0.6, gaussian() * 0.22, new THREE.Vector3()).applyAxisAngle(E1, 0.9)
      : new THREE.Vector3(gaussian(), gaussian(), gaussian()).normalize();
    const tint = skyTints[index % skyTints.length];
    const strength = 0.7 + 0.6 * random();
    blobDir.push(dir);
    blobColor.push(new THREE.Vector4(tint[0] * strength, tint[1] * strength, tint[2] * strength, 0.03 + 0.09 * random()));
  }
  // Contraluz: un vivero de estrellas brilla detrás de la nube que cruzas y el
  // polvo y el disco se recortan contra él (se apaga con la ignición)
  const behind = approachLocal(1.6, new THREE.Vector3()).normalize().negate();
  for (let index = SKY_BLOBS - 2; index < SKY_BLOBS; index++) {
    const rose = index === SKY_BLOBS - 1;
    blobDir.push(behind.clone().addScaledVector(E2, rose ? 0.22 : 0).addScaledVector(AXIS, rose ? 0.12 : 0).normalize());
    blobColor.push(rose ? new THREE.Vector4(0.16, 0.045, 0.08, 0.07) : new THREE.Vector4(0.035, 0.13, 0.16, 0.2));
  }
  const skyUniforms = { uBlobDir: { value: blobDir }, uBlobColor: { value: blobColor }, uFade: { value: 0 } };
  const skyMaterial = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: skyUniforms,
    side: THREE.BackSide,
    ...addLight,
  });
  const skyGeometry = new THREE.SphereGeometry(40, 32, 16);
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -30;
  root.add(sky);

  // Estrellas
  const stars = buildStars(narrow ? 1100 : 2200);
  const starGeometry = streakQuad();
  starGeometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(stars.pos, 3));
  starGeometry.setAttribute('aLook', new THREE.InstancedBufferAttribute(stars.look, 4));
  starGeometry.instanceCount = stars.pos.length / 3;
  const streakUniforms = () => ({
    uPrevViewProj: { value: new THREE.Matrix4() },
    uViewport: { value: new THREE.Vector2(1, 1) },
    uDpr: { value: 1 },
    uFade: { value: 0 },
  });
  const starUniforms = streakUniforms();
  const starMaterial = new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX,
    fragmentShader: STREAK_FRAGMENT,
    uniforms: starUniforms,
    ...addLight,
  });
  const starMesh = new THREE.Mesh(starGeometry, starMaterial);
  starMesh.frustumCulled = false;
  starMesh.renderOrder = -29;
  local.add(starMesh);

  // Gas
  const gas = buildGas(narrow ? 2600 : 6500);
  const gasGeometry = streakQuad();
  gasGeometry.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(gas.orbit, 4));
  gasGeometry.setAttribute('aLook', new THREE.InstancedBufferAttribute(gas.look, 4));
  gasGeometry.instanceCount = gas.orbit.length / 4;
  const gasUniforms = {
    ...streakUniforms(),
    uTime: { value: 0 },
    uIgnite: { value: FLIGHT.ignite },
    uExposure: { value: EXPOSURE },
    uShock: { value: 10 },
    uStar: { value: 1 },
    uSpin: { value: 2.9 },
    uAxis: { value: AXIS.clone() },
    uE1: { value: E1.clone() },
    uE2: { value: E2.clone() },
  };
  const gasMaterial = new THREE.ShaderMaterial({
    vertexShader: GAS_VERTEX,
    fragmentShader: STREAK_FRAGMENT,
    uniforms: gasUniforms,
    ...addLight,
  });
  const gasMesh = new THREE.Mesh(gasGeometry, gasMaterial);
  gasMesh.frustumCulled = false;
  gasMesh.renderOrder = -27;
  local.add(gasMesh);

  // Disco: el anillo plano se orienta en el plano del gas (x → E1, y → E2)
  const diskUniforms = {
    uTime: { value: 0 },
    uIgnite: { value: FLIGHT.ignite },
    uSpin: { value: 2.9 },
    uGlow: { value: 0 },
  };
  const diskGeometry = new THREE.RingGeometry(1.02, 3.6, 160, 6);
  const diskMaterial = new THREE.ShaderMaterial({
    vertexShader: DISK_VERTEX,
    fragmentShader: DISK_FRAGMENT,
    uniforms: diskUniforms,
    side: THREE.DoubleSide,
    ...addLight,
  });
  const disk = new THREE.Mesh(diskGeometry, diskMaterial);
  disk.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(E1, E2, AXIS));
  disk.frustumCulled = false;
  disk.renderOrder = -27.5;
  local.add(disk);

  // Nubes: detrás del núcleo, delante del núcleo
  const puffs = buildPuffs(narrow ? 0.6 : 1);
  const atlas = makeAtlas();
  const puffMaterial = new THREE.ShaderMaterial({
    vertexShader: PUFF_VERTEX,
    fragmentShader: PUFF_FRAGMENT,
    uniforms: { uAtlas: { value: atlas } },
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
  });
  // Estrellas jóvenes encendidas dentro de la nube: puntos que dan escala y
  // profundidad al cruzarla (el polvo las tapa como a todo lo demás)
  const beacons = Array.from({ length: narrow ? 7 : 12 }, () => ({
    point: new THREE.Vector3(gaussian(), gaussian(), gaussian()).normalize().multiplyScalar(7 + 15 * random()),
    size: 4 + 6 * random() ** 2,
    tint: random() < 0.7 ? [0.75, 0.86, 1] : [1, 0.86, 0.72],
  }));
  const capacity = puffs.length + beacons.length + 2;
  const back = makePuffLayer(capacity, puffMaterial, -28);
  const front = makePuffLayer(capacity, puffMaterial, 10);
  // El resplandor de la estrella recién nacida va encima de su disco: le
  // suaviza el borde y la hace encandilar en lugar de verse como un círculo
  const glareMaterial = puffMaterial.clone();
  glareMaterial.uniforms.uAtlas.value = atlas;
  glareMaterial.depthTest = false;
  const glare = makePuffLayer(1, glareMaterial, 11);
  local.add(back.mesh, front.mesh, glare.mesh);

  // Onda de choque
  const shockGeometry = new THREE.SphereGeometry(1, 72, 40);
  const shocks = SHOCK_TINTS.map((tint, index) => {
    const material = new THREE.ShaderMaterial({
      vertexShader: SHOCK_VERTEX,
      fragmentShader: SHOCK_FRAGMENT,
      uniforms: { uColor: { value: tint }, uAlpha: { value: 0 }, uTime: { value: 0 } },
      side: THREE.DoubleSide,
      ...addLight,
    });
    const mesh = new THREE.Mesh(shockGeometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -26 + index;
    root.add(mesh);
    return { mesh, material, lag: SHOCK_LAG[index] };
  });

  const draws: PuffDraw[] = puffs.map(() => ({ depth: 0, x: 0, y: 0, z: 0, halfW: 0, halfH: 0, rot: 0, tile: 0, r: 0, g: 0, b: 0, a: 0 }));
  const beaconDraws: PuffDraw[] = beacons.map(() => ({ depth: 0, x: 0, y: 0, z: 0, halfW: 0, halfH: 0, rot: 0, tile: 4, r: 0, g: 0, b: 0, a: 0 }));
  const order: PuffDraw[] = [];
  const point = new THREE.Vector3();
  const view = new THREE.Vector3();
  const cameraLocal = new THREE.Vector3();
  const toView = new THREE.Matrix4();
  const toStar = new THREE.Vector3();
  const ray = new THREE.Vector3();
  const core: PuffDraw = { depth: 0, x: 0, y: 0, z: 0, halfW: 0, halfH: 0, rot: 0, tile: 4, r: 0, g: 0, b: 0, a: 0 };
  const flare: PuffDraw = { ...core, tile: 5 };
  const bloom: PuffDraw = { ...core, tile: 6 };

  const update = (frame: FlightUpdate) => {
    const { t, camera } = frame;
    const scale = frame.D / D_REF;
    const sinceIgnite = t - FLIGHT.ignite;
    const ignited = sinceIgnite >= 0;
    // La onda de choque alcanza la cámara justo en FLIGHT.hit
    const shockSpeed = (IGNITE_DIST * scale - 1) / (FLIGHT.hit - FLIGHT.ignite);
    // Todo lo del vuelo se apaga mientras vuelve el cielo 2D
    const leave = 1 - smooth(FLIGHT.landing - 0.1, FLIGHT.landing + 1.4, t);
    const arrive = smooth(0, 0.25, t);

    local.scale.setScalar(scale);
    local.updateMatrixWorld(true);
    sky.position.copy(camera.position);
    root.updateMatrixWorld(true);

    skyUniforms.uFade.value = smooth(0, 0.6, t) * leave;
    for (const uniforms of [starUniforms, gasUniforms]) {
      uniforms.uPrevViewProj.value.copy(frame.prevViewProj);
      uniforms.uViewport.value.copy(frame.buffer);
      uniforms.uDpr.value = frame.dpr;
    }
    starUniforms.uFade.value = arrive * leave;
    gasUniforms.uTime.value = t;
    gasUniforms.uShock.value = shockSpeed / scale;
    gasUniforms.uStar.value = 1 / scale;
    gasUniforms.uFade.value = smooth(0.2, 1.4, t);

    // El disco crece con el colapso; la onda de choque lo despedaza hacia fuera
    diskUniforms.uTime.value = t;
    disk.scale.setScalar(1 + (ignited ? 2.8 * (1 - Math.exp(-sinceIgnite / 0.3)) : 0));
    const burst = ignited ? (1 + 3 * Math.exp(-sinceIgnite / 0.12)) * Math.exp(-sinceIgnite / 0.4) : 1;
    diskUniforms.uGlow.value = (0.06 + 0.6 * collapseAt(t)) * smooth(0.6, 2.2, t) * burst;

    // Onda de choque
    for (const shock of shocks) {
      const visible = ignited && sinceIgnite < 1.8;
      shock.mesh.visible = visible;
      if (!visible) continue;
      shock.mesh.scale.setScalar(1 + shockSpeed * sinceIgnite * shock.lag);
      shock.material.uniforms.uAlpha.value = smooth(0, 0.04, sinceIgnite) * (1 - smooth(0.2, 1.6, sinceIgnite));
      shock.material.uniforms.uTime.value = t;
    }

    // Nubes
    toView.multiplyMatrices(camera.matrixWorldInverse, local.matrixWorld);
    cameraLocal.copy(camera.position).divideScalar(scale);
    const originDepth = -view.copy(ORIGIN).applyMatrix4(toView).z;
    const k = collapseAt(t);
    const light = cloudLight(t) * 0.5 + (ignited ? 0.8 + 3.6 * Math.exp(-sinceIgnite / 0.4) : 0);
    const gone = ignited ? 1 - smooth(0.5, 2.3, sinceIgnite) : 1;
    const toPx = frame.pxPerUnit;
    order.length = 0;
    puffs.forEach((puff, index) => {
      point.copy(puff.base).applyAxisAngle(AXIS, puff.swirl * Math.min(t, FLIGHT.ignite)).multiplyScalar(1 - 0.12 * k);
      let flash = 0;
      if (ignited) {
        const hitAt = Math.max(0, (point.length() * scale - 1) / shockSpeed);
        const since = sinceIgnite - hitAt;
        if (since > 0) {
          point.multiplyScalar(1 + puff.push * (1 - Math.exp(-since / 0.7)));
          flash = Math.exp(-since / 0.3);
        }
      }
      view.copy(point).applyMatrix4(toView);
      const depth = -view.z;
      const radius = puff.radius * scale;
      if (depth < 0.05) return;
      // Cerca de la cámara la nube se abre y se desvanece en lugar de cortarse
      // contra el plano cercano; las que llenarían la pantalla se aclaran
      const near = smooth(radius * 0.2, radius * 1.1, depth);
      const px = (radius * toPx) / depth;
      const fill = 1 - smooth(0.55, 1.15, px / frame.frameHeight);
      const fade = near * fill * gone * arrive;
      if (fade < 0.01) return;
      // La luz del núcleo, más brillante a contraluz (dispersión hacia delante)
      const r = point.length() * scale;
      toStar.copy(point).negate().normalize();
      ray.copy(point).sub(cameraLocal).normalize();
      const scatter = 0.3 + 0.7 * ((ray.dot(toStar) + 1) / 2) ** 3;
      const lit = (light / (1 + (r / (2.4 * scale)) ** 2)) * scatter + flash * 1.6;
      const draw = draws[index];
      draw.depth = depth;
      draw.x = point.x;
      draw.y = point.y;
      draw.z = point.z;
      draw.halfW = radius;
      draw.halfH = radius * puff.aspect;
      draw.rot = puff.rot + puff.spin * t;
      draw.tile = puff.tile;
      if (puff.dust) {
        const a = puff.amount * fade;
        draw.r = (DUST_BASE[0] + WARM[0] * lit * 0.55) * a;
        draw.g = (DUST_BASE[1] + WARM[1] * lit * 0.55) * a;
        draw.b = (DUST_BASE[2] + WARM[2] * lit * 0.55) * a;
        draw.a = a;
      } else {
        const glow = puff.amount * fade;
        draw.r = (puff.tint[0] + WARM[0] * lit * 0.8) * glow;
        draw.g = (puff.tint[1] + WARM[1] * lit * 0.8) * glow;
        draw.b = (puff.tint[2] + WARM[2] * lit * 0.8) * glow;
        draw.a = 0;
      }
      order.push(draw);
    });
    beacons.forEach((beacon, index) => {
      view.copy(beacon.point).applyMatrix4(toView);
      const depth = -view.z;
      if (depth < 0.3) return;
      const draw = beaconDraws[index];
      const glow = arrive * leave;
      draw.depth = depth;
      draw.x = beacon.point.x;
      draw.y = beacon.point.y;
      draw.z = beacon.point.z;
      draw.halfW = (beacon.size * depth) / toPx;
      draw.halfH = draw.halfW;
      draw.r = beacon.tint[0] * glow;
      draw.g = beacon.tint[1] * glow;
      draw.b = beacon.tint[2] * glow;
      order.push(draw);
    });
    order.sort((a, b) => b.depth - a.depth);
    back.count = 0;
    front.count = 0;
    for (const draw of order) pushDraw(draw.depth > originDepth ? back : front, draw);

    // Núcleo: tamaño fijo en pantalla mientras está lejos, como el punto de
    // arranque, y un destello anamórfico que crece con el colapso
    const unit = originDepth / toPx;
    const lum = coreLight(t);
    if (lum > 0) {
      const sizePx = (13 + 16 * smooth(2.2, 4.1, t)) * Math.sqrt(lum);
      core.halfW = sizePx * unit;
      core.halfH = core.halfW;
      core.r = 1 * lum * arrive;
      core.g = 0.9 * lum * arrive;
      core.b = 0.8 * lum * arrive;
      pushDraw(back, core);
    }
    // La estrella recién encendida encandila: un resplandor que crece con ella
    glare.count = 0;
    if (ignited && sinceIgnite < 3) {
      const shine = (2.6 * Math.exp(-sinceIgnite / 0.4) + 0.45 * Math.exp(-sinceIgnite / 1.2)) * (1 - smooth(1.8, 3, sinceIgnite));
      bloom.halfW = 5 * (0.45 + 0.55 * smooth(0, 0.9, sinceIgnite));
      bloom.halfH = bloom.halfW;
      bloom.r = shine;
      bloom.g = 0.6 * shine;
      bloom.b = 0.36 * shine;
      pushDraw(glare, bloom);
    }
    const breath = smooth(FLIGHT.ignite - HOLD, FLIGHT.ignite - 0.04, t);
    let reach = 0;
    let shine = 0;
    if (!ignited) {
      reach = (0.12 + 0.6 * smooth(FLIGHT.collapse - 0.4, FLIGHT.ignite - HOLD, t)) * (1 - 0.97 * breath);
      shine = 0.55 * smooth(FLIGHT.collapse - 0.6, FLIGHT.collapse + 0.4, t) * (1 + 0.6 * heartbeat(t));
    } else if (sinceIgnite < 1.4) {
      reach = 0.03 + 1.4 * (1 - Math.exp(-sinceIgnite / 0.12));
      shine = 1.6 * (1 - smooth(0, 1.3, sinceIgnite));
    }
    if (shine > 0.005) {
      flare.halfW = frame.frameWidth * 0.5 * reach * unit;
      flare.halfH = 26 * unit;
      flare.r = shine;
      flare.g = 0.66 * shine;
      flare.b = 0.44 * shine;
      pushDraw(front, flare);
    }
    commitLayer(back);
    commitLayer(front);
    commitLayer(glare);
  };

  const setVisible = (visible: boolean) => {
    root.visible = visible;
  };

  const dispose = () => {
    skyGeometry.dispose();
    skyMaterial.dispose();
    starGeometry.dispose();
    starMaterial.dispose();
    gasGeometry.dispose();
    gasMaterial.dispose();
    diskGeometry.dispose();
    diskMaterial.dispose();
    back.geometry.dispose();
    front.geometry.dispose();
    puffMaterial.dispose();
    glareMaterial.dispose();
    glare.geometry.dispose();
    atlas.dispose();
    shockGeometry.dispose();
    shocks.forEach((shock) => shock.material.dispose());
  };

  return { root, update, setVisible, dispose };
};

export type NebulaFlight = ReturnType<typeof createNebulaFlight>;
