import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { livingSignal, SHELL_SCALE, starFrame } from './livingHero';

/* Estrella viva: granulación que hierve, corona con protuberancias y una
   esfera de Dyson en construcción. Un domo geodésico fantasma dibuja la
   obra terminada y los paneles lo van llenando desde un casquete: por
   delante son siluetas de metal contra la estrella y por detrás espejos
   encendidos. Colectores sueltos orbitan como tráfico de obra, y cerca
   del cursor giran sus espejos hacia ti.

   Todo el movimiento ocurre en la GPU: cada cuadro solo actualiza unos
   pocos uniforms y la cámara. */

const DEG = Math.PI / 180;
const BUILD_SECONDS = 75;

// Ruido simplex 3D (Ian McEwan, Ashima Arts; licencia MIT)
const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/* ---------------- Disco de la estrella ---------------- */

const STAR_VERTEX = /* glsl */ `
varying vec3 vObject;
varying vec3 vViewNormal;
void main() {
  vObject = position;
  vViewNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const STAR_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uIgnite;
uniform float uFlash;
uniform vec3 uFlashTint;
uniform float uDim;
varying vec3 vObject;
varying vec3 vViewNormal;
${NOISE}
vec3 palette(float h) {
  vec3 deep = vec3(0.36, 0.03, 0.01);
  vec3 ember = vec3(0.82, 0.17, 0.03);
  vec3 orange = vec3(1.0, 0.45, 0.12);
  vec3 hot = vec3(1.0, 0.8, 0.52);
  vec3 c = mix(deep, ember, smoothstep(0.12, 0.42, h));
  c = mix(c, orange, smoothstep(0.42, 0.68, h));
  return mix(c, hot, smoothstep(0.74, 0.98, h));
}
void main() {
  vec3 p = normalize(vObject);
  float t = uTime * 0.02;
  // Granulación fina: gránulos brillantes y carriles oscuros muy delgados
  float g1 = smoothstep(0.0, 0.32, abs(snoise(p * 30.0 + vec3(t * 2.0, -t * 1.4, t))));
  float g2 = smoothstep(0.0, 0.32, abs(snoise(p * 64.0 + vec3(-t * 1.7, t * 2.2, -t))));
  float granules = g1 * 0.65 + g2 * 0.35;
  // Supergranulación y regiones activas: variaciones amplias de brillo
  float super = snoise(p * 6.0 + vec3(0.0, t * 0.8, t * 0.5));
  float activity = snoise(p * 1.7 + vec3(t * 0.3, 0.0, -t * 0.25));
  // Manchas: pocas, oscuras, donde la actividad es máxima
  float spots = smoothstep(0.8, 0.92, snoise(p * 2.2 + vec3(4.1, t * 0.2, 1.7)));
  float heat = 0.42 + granules * 0.28 + super * 0.08 + activity * 0.14 - spots * 0.3;
  float mu = clamp(vViewNormal.z, 0.0, 1.0);
  // Oscurecimiento hacia el borde y un filo rojizo en el limbo
  float limb = 0.3 + 0.7 * pow(mu, 0.55);
  vec3 color = palette(heat) * limb * 1.12;
  color += vec3(1.0, 0.24, 0.05) * pow(1.0 - mu, 2.4) * 0.38;
  // Al nacer es un disco plano y encandilado que se funde con su superficie
  color = mix(color, uFlashTint, uFlash);
  gl_FragColor = vec4(color * uIgnite * (1.0 - uDim), 1.0);
}
`;

/* ---------------- Corona, protuberancias y llamaradas ---------------- */

const CORONA_RADIUS = 2.7;

const CORONA_VERTEX = /* glsl */ `
varying vec2 vPlane;
void main() {
  vPlane = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CORONA_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uIgnite;
uniform float uFlareAngle;
uniform float uFlareAge;
uniform float uSealed;
varying vec2 vPlane;
${NOISE}
void main() {
  float r = length(vPlane);
  if (r < 0.985 || r > ${CORONA_RADIUS.toFixed(1)}) discard;
  vec2 dir = vPlane / r;
  float ang = atan(vPlane.y, vPlane.x);
  float h = r - 1.0;
  float glow = exp(-h * 3.4) * 0.8 + exp(-h * 0.9) * 0.2;
  float streams = snoise(vec3(dir * 1.7, uTime * 0.035 + h * 0.45)) * 0.5 + 0.5;
  streams = pow(streams, 2.4);
  // Espículas: un fleco fino de chorros radiales de altura cambiante
  float reach = 0.025 + 0.085 * smoothstep(0.1, 0.95, snoise(vec3(dir * 9.0, uTime * 0.06)) * 0.5 + 0.5);
  float strands = 0.55 + 0.45 * snoise(vec3(dir * 38.0, uTime * 0.12));
  float prom = (1.0 - smoothstep(0.0, reach, h)) * strands;
  // Llamarada: un chorro que nace del borde, crece hacia afuera y se apaga
  float da = atan(sin(ang - uFlareAngle), cos(ang - uFlareAngle));
  float front = 0.06 + uFlareAge * 0.65;
  float width = 0.06 + h * 0.22;
  float jet = exp(-(da * da) / (width * width))
    * (1.0 - smoothstep(front - 0.08, front + 0.06, h))
    * exp(-h * 1.6);
  float plume = jet * exp(-uFlareAge * 0.7) * step(0.0, uFlareAge) * smoothstep(0.0, 0.08, uFlareAge);
  float intensity = (glow * (0.42 + 0.78 * streams) + prom * 0.55 + plume * 3.0) * uIgnite;
  vec3 color = mix(vec3(0.95, 0.2, 0.04), vec3(1.0, 0.72, 0.44), clamp(intensity * 0.9 - 0.15, 0.0, 1.0));
  // Esfera cerrada: el calor que irradia el casco la rodea de un halo rojo
  float halo = exp(-abs(r - ${SHELL_SCALE.toFixed(2)}) * 3.2) * (0.75 + 0.25 * streams) * uSealed * 0.85;
  float total = intensity + halo;
  color = (color * intensity + vec3(0.92, 0.2, 0.07) * halo) / max(total, 0.001);
  float alpha = clamp(total, 0.0, 1.0) * (1.0 - smoothstep(1.9, ${CORONA_RADIUS.toFixed(1)}, r));
  gl_FragColor = vec4(color, alpha);
}
`;

/* ---------------- Esfera de Dyson: domo y paneles ---------------- */

const SHELL_RADIUS = SHELL_SCALE;
const SHELL_DETAIL = 9;
// Ya hay una parte construida al encenderse y la obra avanza mientras miras.
// Solo mirando se termina en unos dos minutos y medio; cada llamarada la
// empuja y girar la estrella la acelera mientras dura el arrastre
const SHELL_START = 0.05;
const BUILD_TOTAL = 150;
const FLARE_BOOST = 4;
const DRAG_BOOST = 3;
const BOOST_TAU = 1.5;

const SHELL_VERTEX = /* glsl */ `
attribute vec3 aCentroid;
attribute vec3 aBary;
attribute float aOrder;
uniform float uBuilt;
uniform float uWindow;
uniform float uTime;
uniform float uSealed;
varying vec3 vBary;
varying vec3 vDir;
varying vec3 vSurface;
varying float vFresh;
varying float vShade;
varying float vOpen;
void main() {
  float placed = clamp((uBuilt - aOrder) / uWindow, 0.0, 1.0);
  if (placed <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  // El panel llega desde fuera, se despliega y queda con una junta
  float settle = 1.0 - pow(1.0 - placed, 3.0);
  vec3 outward = normalize(aCentroid);
  // Terminada, algunos paneles se abren un instante como obturadores y dejan
  // escapar la luz de la estrella
  float open = 0.0;
  if (uSealed > 0.0) {
    float phase = fract(sin(dot(aCentroid, vec3(7.13, 3.71, 5.29))) * 9187.31) * 50.0;
    open = smoothstep(0.993, 1.0, sin(uTime * 0.35 + phase)) * uSealed;
  }
  vec3 p = aCentroid + (position - aCentroid) * 0.9 * (0.35 + 0.65 * settle) * (1.0 - open * 0.7) + outward * (1.0 - settle) * 0.4;
  vBary = aBary;
  vDir = outward;
  vSurface = normalize(p);
  vOpen = open;
  vFresh = 1.0 - placed;
  vShade = fract(sin(dot(aCentroid, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const SHELL_FRAGMENT = /* glsl */ `
uniform float uIgnite;
uniform float uTime;
uniform float uSealed;
uniform float uWave;
uniform vec3 uWaveAxis;
varying vec3 vBary;
varying vec3 vDir;
varying vec3 vSurface;
varying float vFresh;
varying float vShade;
varying float vOpen;
// Receptores: la energía recogida por el casco corre por las juntas hacia ellos
const vec3 NODE_A = vec3(-0.52, 0.5, 0.69);
const vec3 NODE_B = vec3(0.78, -0.18, 0.6);
const vec3 NODE_C = vec3(0.08, -0.86, 0.5);
const vec3 NODE_D = vec3(0.3, 0.75, -0.59);
float harvest(vec3 node, out float core) {
  float angle = acos(clamp(dot(vSurface, normalize(node)), -1.0, 1.0));
  core = exp(-angle * angle / 0.006) * 1.6 + exp(-angle * angle / 0.06) * 0.45;
  // Anillos que avanzan hacia el receptor y se apagan lejos de él
  return pow(0.5 + 0.5 * sin(angle * 12.0 + uTime * 1.8), 10.0) * (1.0 - smoothstep(0.7, 1.4, angle));
}
void main() {
  float edge = min(vBary.x, min(vBary.y, vBary.z));
  float frame = 1.0 - smoothstep(0.02, 0.08, edge);
  vec3 color;
  if (gl_FrontFacing) {
    // Cara exterior: metal oscuro contra la estrella, con el marco encendido.
    // Terminada, las juntas respiran y el casco irradia el calor que atrapa:
    // desde fuera una esfera de Dyson solo se vería en infrarrojo
    float joints = 0.32 - uSealed * (0.14 - 0.06 * sin(uTime * 0.7 + vShade * 6.2832));
    color = vec3(0.06, 0.045, 0.038) * (0.7 + 0.6 * vShade) + vec3(1.0, 0.56, 0.3) * frame * joints;
    color += vec3(0.36, 0.05, 0.022) * uSealed * (0.3 + 0.35 * vShade) * (1.0 - frame);
    if (uSealed > 0.0) {
      float coreA; float coreB; float coreC; float coreD;
      float flow = harvest(NODE_A, coreA) + harvest(NODE_B, coreB) + harvest(NODE_C, coreC) + harvest(NODE_D, coreD);
      float core = coreA + coreB + coreC + coreD;
      color += vec3(1.0, 0.78, 0.46) * flow * frame * 3.0 * uSealed;
      color += vec3(1.0, 0.86, 0.62) * core * (0.45 + frame) * 1.4 * uSealed;
    }
    // Obturador abierto: el panel encoge y destella con la luz que deja pasar
    color = mix(color, vec3(1.0, 0.9, 0.72) * 1.7, vOpen * 0.85);
  } else {
    // Cara interior: el espejo que mira a la estrella, encendido por ella
    color = vec3(1.0, 0.63, 0.37) * (0.62 + 0.38 * vShade) * (1.0 - frame * 0.55);
  }
  // Recién instalado: brilla al rojo blanco y se enfría
  color = mix(color, vec3(1.0, 0.92, 0.8) * 1.6, vFresh * vFresh);
  // Cierre de la obra: una onda de luz recorre el casco desde el punto que
  // mira al visitante hasta el lado opuesto
  if (uWave >= 0.0) {
    float angle = acos(clamp(dot(vDir, uWaveAxis), -1.0, 1.0));
    float front = uWave * 1.5;
    float band = exp(-pow(angle - front, 2.0) / 0.035) * (1.0 - smoothstep(3.0, 3.6, front));
    color += vec3(1.0, 0.86, 0.62) * band * 1.5;
  }
  gl_FragColor = vec4(color * uIgnite, 1.0);
}
`;

/* Cada panel es un triángulo del domo geodésico. El montaje empieza en el
   borde superior derecho, abrazando el limbo, y en un segundo frente por
   detrás: la cara de la estrella queda a la vista mientras la obra avanza */
const buildShell = () => {
  const geometry = new THREE.IcosahedronGeometry(SHELL_RADIUS, SHELL_DETAIL);
  const position = geometry.getAttribute('position').array as Float32Array;
  const vertices = position.length / 3;
  const faces = vertices / 3;
  const centroid = new Float32Array(vertices * 3);
  const bary = new Float32Array(vertices * 3);
  const order = new Float32Array(vertices);
  const front = new THREE.Vector3(0.55, 0.6, 0.58).normalize();
  const back = new THREE.Vector3(-0.35, -0.45, -0.82).normalize();
  const center = new THREE.Vector3();
  const reach: { face: number; value: number }[] = [];
  for (let face = 0; face < faces; face++) {
    const base = face * 9;
    center.set(
      (position[base] + position[base + 3] + position[base + 6]) / 3,
      (position[base + 1] + position[base + 4] + position[base + 7]) / 3,
      (position[base + 2] + position[base + 5] + position[base + 8]) / 3,
    );
    for (let corner = 0; corner < 3; corner++) {
      centroid.set([center.x, center.y, center.z], base + corner * 3);
      bary.set(corner === 0 ? [1, 0, 0] : corner === 1 ? [0, 1, 0] : [0, 0, 1], base + corner * 3);
    }
    const direction = center.clone().normalize();
    const fromFront = Math.acos(Math.min(1, direction.dot(front)));
    const fromBack = Math.acos(Math.min(1, direction.dot(back))) + 0.45;
    reach.push({ face, value: Math.min(fromFront, fromBack) + (seeded(face + 501) - 0.5) * 0.22 });
  }
  // Orden por cercanía al frente de obra: la fracción construida es exacta
  reach.sort((a, b) => a.value - b.value);
  reach.forEach(({ face }, rank) => {
    const value = rank / faces;
    order[face * 3] = value;
    order[face * 3 + 1] = value;
    order[face * 3 + 2] = value;
  });
  geometry.setAttribute('aCentroid', new THREE.BufferAttribute(centroid, 3));
  geometry.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
  geometry.setAttribute('aOrder', new THREE.BufferAttribute(order, 1));
  return geometry;
};

/* Avance de la obra: un primer impulso con muchos paneles llegando a la vez
   (según el tiempo desde la ignición) y después el trabajo acumulado, que
   va rápido al principio y se calma hacia el cierre sin dejar de llegar */
const SHELL_KICKOFF = 2.7;
const shellKickoff = (since: number) => {
  if (since < 1.7) return 0;
  if (since < SHELL_KICKOFF) return SHELL_START * (1 - (1 - (since - 1.7)) ** 3);
  return SHELL_START;
};
const shellFromWork = (work: number) => SHELL_START + (1 - SHELL_START) * (1 - (1 - work) ** 1.6);
// Velocidad de la fracción construida por unidad de trabajo
const shellWorkSlope = (work: number) => (1 - SHELL_START) * 1.6 * (1 - work) ** 0.6;

/* ---------------- Enjambre Dyson ---------------- */

const SWARM_VERTEX = /* glsl */ `
attribute vec4 aOrbit;
attribute vec4 aMotion;
uniform float uTime;
uniform float uBuild;
uniform float uIgnite;
uniform float uPixelRatio;
uniform float uViewHeight;
uniform float uAspect;
uniform float uScroll;
uniform vec2 uPointer;
uniform float uPointerOn;
varying float vLit;
varying float vFlash;
varying float vGlint;
varying float vAlpha;
mat3 rotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
void main() {
  float age = uBuild - aMotion.y;
  if (age < 0.0 || uIgnite <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  // Inserción: el colector llega en espiral desde fuera hasta su órbita
  float settle = 1.0 - pow(1.0 - clamp(age / 2.6, 0.0, 1.0), 3.0);
  float radius = mix(aOrbit.x * 2.3, aOrbit.x, settle);
  float angle = aOrbit.w + aMotion.x * uTime * (1.0 + uScroll * 1.4) - (1.0 - settle) * 3.0;
  vec3 pos = rotY(aOrbit.z) * rotX(aOrbit.y) * vec3(cos(angle) * radius, 0.0, sin(angle) * radius);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  // El panel mira a la estrella: de frente lo vemos encendido, de espaldas en silueta
  vec3 normal = normalize(-pos);
  vec3 view = normalize(cameraPosition - pos);
  vLit = dot(normal, view);
  // Destellos: cada espejo está algo inclinado y a veces refleja hacia nosotros
  vec3 tilt = vec3(fract(aMotion.w * 13.1), fract(aMotion.w * 7.3), fract(aMotion.w * 3.7)) - 0.5;
  vec3 reflected = reflect(normalize(pos), normalize(normal + tilt * 0.9));
  float glint = pow(max(dot(reflected, view), 0.0), 36.0);
  // Cerca del cursor los espejos giran hacia el visitante
  vec2 ndc = gl_Position.xy / gl_Position.w;
  vec2 gap = (ndc - uPointer) * vec2(uAspect, 1.0);
  float aimed = (1.0 - smoothstep(0.02, 0.26, length(gap))) * uPointerOn;
  vGlint = max(glint, aimed * (0.55 + 0.45 * fract(aMotion.w * 31.7)));
  vFlash = (1.0 - smoothstep(0.0, 0.45, age)) * 0.8;
  vAlpha = smoothstep(0.0, 0.3, age) * uIgnite;
  float size = aMotion.z * (1.0 + vFlash * 0.7 + vGlint * 1.1);
  gl_PointSize = size * uPixelRatio * (uViewHeight / 900.0) * (12.0 / -mv.z);
}
`;

const SWARM_FRAGMENT = /* glsl */ `
varying float vLit;
varying float vFlash;
varying float vGlint;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = 1.0 - smoothstep(0.22, 0.5, d);
  vec3 lit = vec3(1.0, 0.78, 0.56) * (0.5 + 0.9 * smoothstep(0.0, 0.7, vLit));
  vec3 dark = vec3(0.03, 0.014, 0.01);
  vec3 color = vLit > 0.0 ? lit : dark;
  float spark = max(vFlash, vGlint);
  color = mix(color, vec3(1.0, 0.95, 0.86) * 1.5, spark);
  float alpha = max((vLit > 0.0 ? 1.0 : 0.94), spark) * soft * vAlpha;
  gl_FragColor = vec4(color, alpha);
}
`;

// Pseudoaleatorio estable: el enjambre es siempre el mismo
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/* Familias de órbitas: anillos con su propia inclinación, como un enjambre
   que se llena por planos */
const FAMILIES = [
  { incline: 0.05, node: 0.0, inner: 1.3, outer: 1.7 },
  { incline: 0.42, node: 0.6, inner: 1.45, outer: 2.0 },
  { incline: -0.36, node: 2.1, inner: 1.55, outer: 2.2 },
  { incline: 0.78, node: 3.6, inner: 1.7, outer: 2.4 },
  { incline: -0.7, node: 4.7, inner: 1.85, outer: 2.6 },
  { incline: 1.12, node: 1.3, inner: 2.0, outer: 2.75 },
];

const buildSwarm = (count: number) => {
  const positions = new Float32Array(count * 3);
  const orbit = new Float32Array(count * 4);
  const motion = new Float32Array(count * 4);
  const seedFamily = Math.floor(count * 0.12);
  for (let index = 0; index < count; index++) {
    const family = FAMILIES[index % FAMILIES.length];
    const spread = (seeded(index + 11) - 0.5) + (seeded(index + 23) - 0.5);
    const radius = family.inner + (family.outer - family.inner) * seeded(index + 37) ** 1.3;
    orbit.set([
      radius,
      family.incline + spread * 0.07,
      family.node + (seeded(index + 53) - 0.5) * 0.12,
      seeded(index + 71) * Math.PI * 2,
    ], index * 4);
    // Unos pocos ya están en órbita; el resto llega a lo largo de la visita
    const birth = index < seedFamily ? 0 : ((index - seedFamily) / (count - seedFamily)) * BUILD_SECONDS + seeded(index + 89) * 0.8;
    motion.set([
      0.21 * radius ** -1.5,
      birth,
      0.7 + seeded(index + 97) * 1.0,
      seeded(index + 113),
    ], index * 4);
  }
  return { positions, orbit, motion };
};

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
// Color del destello con que nace la estrella
const FLASH_WHITE = new THREE.Vector3(1.5, 1.41, 1.29);
// Al nacer de la nebulosa del cierre la estrella tarda esto más en encenderse
const GENTLE_STRETCH = 2.4;
// Se infla con un pequeño rebote, como si la presión la empujara de más
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

interface Pointer {
  x: number;
  y: number;
  on: number;
}

const Scene = ({ heroRef, count }: { heroRef: RefObject<HTMLElement | null>; count: number }) => {
  const star = useRef<THREE.Mesh>(null);
  const corona = useRef<THREE.Mesh>(null);
  const pointer = useRef<Pointer>({ x: 0, y: 0, on: 0 });
  const smooth = useRef<Pointer>({ x: 0, y: 0, on: 0 });
  const readyMarked = useRef(false);

  const swarm = useMemo(() => buildSwarm(count), [count]);

  // Materiales propios: así los uniforms que se actualizan son los que usa la GPU
  const starUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIgnite: { value: 0 },
    uFlash: { value: 0 },
    uFlashTint: { value: FLASH_WHITE.clone() },
    uDim: { value: 0 },
  }), []);
  const shellUniforms = useMemo(() => ({
    uBuilt: { value: 0 },
    uWindow: { value: 0.01 },
    uIgnite: { value: 0 },
    uTime: { value: 0 },
    uSealed: { value: 0 },
    uWave: { value: -1 },
    uWaveAxis: { value: new THREE.Vector3(0, 0, 1) },
  }), []);
  const shellGeometry = useMemo(buildShell, []);
  const ghostGeometry = useMemo(() => new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(SHELL_RADIUS * 0.997, SHELL_DETAIL)), []);
  const shellMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX,
    fragmentShader: SHELL_FRAGMENT,
    uniforms: shellUniforms,
    side: THREE.DoubleSide,
  }), [shellUniforms]);
  const ghostMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: '#c8dcff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }), []);
  const progress = useRef({ percent: -1, rushing: false });
  /* Estado de la obra entre cuadros. Se reinicia con cada ignición (al volver
     a la portada desde el cierre la estrella se enciende de nuevo) */
  const build = useRef({
    ignitedAt: 0,
    work: 0,
    boost: 0,
    flareSeen: 0,
    window: 0.004,
    completeAt: 0,
  });
  const coronaUniforms = useMemo(() => ({
    uTime: { value: 0 }, uIgnite: { value: 0 }, uFlareAngle: { value: 0 }, uFlareAge: { value: -1 }, uSealed: { value: 0 },
  }), []);
  const swarmUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBuild: { value: -1 },
    uIgnite: { value: 0 },
    uPixelRatio: { value: 1 },
    uViewHeight: { value: 900 },
    uAspect: { value: 1 },
    uScroll: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uPointerOn: { value: 0 },
  }), []);
  const starMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    uniforms: starUniforms,
  }), [starUniforms]);
  const coronaMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: CORONA_VERTEX,
    fragmentShader: CORONA_FRAGMENT,
    uniforms: coronaUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [coronaUniforms]);
  const swarmMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SWARM_VERTEX,
    fragmentShader: SWARM_FRAGMENT,
    uniforms: swarmUniforms,
    transparent: true,
    depthWrite: false,
  }), [swarmUniforms]);
  useEffect(() => () => {
    starMaterial.dispose();
    coronaMaterial.dispose();
    swarmMaterial.dispose();
    shellMaterial.dispose();
    ghostMaterial.dispose();
    shellGeometry.dispose();
    ghostGeometry.dispose();
  }, [starMaterial, coronaMaterial, swarmMaterial, shellMaterial, ghostMaterial, shellGeometry, ghostGeometry]);

  /* Medidas del hero guardadas: leerlas en cada cuadro o en cada movimiento
     del mouse obligaría al navegador a recalcular el diseño de la página,
     porque el resto del hero escribe estilos en cada cuadro */
  const layout = useRef({ left: 0, top: 0, width: 1, height: 1, scroll: 0 });
  useEffect(() => {
    const hero = heroRef.current;
    const root = hero?.closest<HTMLElement>('.mo-root');
    if (!hero || !root) return;
    const measure = () => {
      const rect = hero.getBoundingClientRect();
      const scroll = root.scrollTop;
      layout.current = { left: rect.left, top: rect.top + scroll, width: rect.width, height: rect.height, scroll };
    };
    const onScroll = () => {
      layout.current.scroll = root.scrollTop;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(hero);
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      root.removeEventListener('scroll', onScroll);
    };
  }, [heroRef]);

  // Puntero y clics se escuchan en la ventana: el lienzo no recibe eventos
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    let down = { x: 0, y: 0, at: 0 };
    const local = (event: PointerEvent) => {
      const box = layout.current;
      const rect = { width: box.width, height: box.height };
      return { rect, x: event.clientX - box.left, y: event.clientY - (box.top - box.scroll) };
    };
    const onMove = (event: PointerEvent) => {
      const point = local(event);
      const inside = point.y >= 0 && point.y <= point.rect.height;
      pointer.current = {
        x: (point.x / point.rect.width) * 2 - 1,
        y: -((point.y / point.rect.height) * 2 - 1),
        on: inside && fine ? 1 : 0,
      };
    };
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY, at: performance.now() };
    };
    // Un clic breve sobre el hero lanza una llamarada desde el borde más cercano
    const onUp = (event: PointerEvent) => {
      if (!livingSignal.ignitedAt) return;
      if (performance.now() - down.at > 320 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) return;
      if (event.target instanceof Element && event.target.closest('button, a, input')) return;
      const point = local(event);
      if (point.y < 0 || point.y > point.rect.height) return;
      const frame = starFrame(point.rect.width, point.rect.height);
      livingSignal.flareAngle = Math.atan2(frame.y - point.y, point.x - frame.x);
      livingSignal.flareAt = performance.now();
    };
    const onLeave = () => {
      pointer.current = { ...pointer.current, on: 0 };
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [heroRef]);

  useFrame((state, delta) => {
    const { size, viewport } = state;
    const camera = state.camera as THREE.PerspectiveCamera;
    const now = performance.now();
    const time = state.clock.elapsedTime;
    const scroll = clamp01(layout.current.scroll / Math.max(1, layout.current.height));

    // Ignición: la estrella crece desde el punto de luz con un destello blanco.
    // Al nacer de la nebulosa del cierre crece más lento, sin rebote ni destello
    const since = livingSignal.ignitedAt ? (now - livingSignal.ignitedAt) / 1000 : -1;
    const gentle = livingSignal.gentle;
    const age = since < 0 ? -1 : gentle ? since / GENTLE_STRETCH : since;
    // Al nacer de la nebulosa empieza como una brasa tenue y se enciende de a poco
    const lit = age < 0 ? 0 : gentle ? clamp01(since / 2.4) ** 1.5 : easeOut(clamp01(age / 0.7));
    // Nace encandilada y la luz se funde con su superficie (desde el cierre,
    // un poco más lento, bajo el resplandor que la cubre)
    const flash = age < 0 ? 0 : (1 - clamp01(since / (gentle ? 2 : 1.6))) ** 2;
    if (star.current) {
      star.current.visible = since >= 0;
      const grow = clamp01(age / 0.95);
      star.current.scale.setScalar(age < 0 ? 0.001 : 0.02 + 0.98 * (gentle ? easeInOut(grow) : easeOutBack(grow)));
      star.current.rotation.y = time * 0.018;
    }
    if (corona.current) {
      corona.current.visible = since >= 0;
      corona.current.quaternion.copy(camera.quaternion);
      corona.current.scale.setScalar(star.current?.scale.x ?? 1);
    }

    // Cámara: el disco nace donde lo encendió la intro y luego se aparta hacia
    // su lugar junto al título (starFrame)
    const home = starFrame(size.width, size.height);
    const born = livingSignal.intro;
    // Desde el cierre espera en el centro hasta que el viento despeja la nube
    const glide = age < 0 ? 0 : easeInOut(clamp01(gentle ? (since - 2.7) / 2 : (age - 0.55) / 1.45));
    const frame = {
      x: born.fx * size.width + (home.x - born.fx * size.width) * glide,
      y: born.fy * size.height + (home.y - born.fy * size.height) * glide,
      r: born.fr * size.height + (home.r - born.fr * size.height) * glide,
    };
    const tangent = (frame.r / (size.height / 2)) * Math.tan((camera.fov * DEG) / 2);
    const distance = (Math.sqrt(1 + tangent * tangent) / tangent) * (1 + scroll * 0.85);
    const target = pointer.current;
    const current = smooth.current;
    current.x += (target.x - current.x) * 0.045;
    current.y += (target.y - current.y) * 0.045;
    current.on += (target.on - current.on) * 0.08;
    const spin = livingSignal.spin;
    const step = Math.min(0.05, delta);
    if (!spin.dragging) {
      spin.yaw += spin.velocityYaw * step;
      spin.pitch += spin.velocityPitch * step;
      const friction = Math.pow(0.05, step);
      spin.velocityYaw *= friction;
      spin.velocityPitch *= friction;
      // Sin tocarla un rato, vuelve por el camino corto a su encuadre
      if (now - spin.touchedAt > 5000) {
        const turn = Math.PI * 2;
        spin.yaw = ((((spin.yaw + Math.PI) % turn) + turn) % turn) - Math.PI;
        spin.yaw *= 1 - Math.min(1, step * 0.9);
        spin.pitch *= 1 - Math.min(1, step * 0.9);
      }
    }
    spin.pitch = Math.max(-1.25, Math.min(1.05, spin.pitch));
    // Mientras se arrastra, el paralaje del cursor no se suma al giro
    const parallax = spin.dragging ? 0 : 1;
    const azimuth = spin.yaw + current.x * 0.1 * parallax;
    const elevation = Math.max(-1.05, Math.min(1.25, 0.2 + spin.pitch + current.y * 0.05 * parallax + scroll * 0.25));
    camera.position.set(
      Math.sin(azimuth) * Math.cos(elevation) * distance,
      Math.sin(elevation) * distance,
      Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    camera.lookAt(0, 0, 0);
    const centerY = frame.y - scroll * size.height * 0.14;
    camera.setViewOffset(size.width, size.height, size.width / 2 - frame.x, size.height / 2 - centerY, size.width, size.height);
    camera.updateProjectionMatrix();

    starUniforms.uTime.value = time;
    starUniforms.uIgnite.value = lit;
    starUniforms.uFlash.value = flash;
    coronaUniforms.uTime.value = time;
    coronaUniforms.uIgnite.value = age < 0 ? 0 : easeOut(clamp01((age - 0.25) / 1.3));
    coronaUniforms.uFlareAngle.value = livingSignal.flareAngle;
    coronaUniforms.uFlareAge.value = (now - livingSignal.flareAt) / 1000;
    swarmUniforms.uTime.value = time;
    swarmUniforms.uBuild.value = since - 1.8;
    swarmUniforms.uIgnite.value = since < 0 ? 0 : clamp01((since - 1.6) / 1.2);
    swarmUniforms.uPixelRatio.value = viewport.dpr;
    swarmUniforms.uViewHeight.value = size.height;
    swarmUniforms.uAspect.value = size.width / size.height;
    swarmUniforms.uScroll.value = scroll;
    swarmUniforms.uPointer.value.set(current.x, current.y);
    swarmUniforms.uPointerOn.value = current.on;
    // La obra: el fantasma aparece primero y los paneles lo van llenando.
    // Avanza solo mientras la escena se dibuja, es decir, con el hero a la vista
    const work = build.current;
    if (work.ignitedAt !== livingSignal.ignitedAt) {
      work.ignitedAt = livingSignal.ignitedAt;
      work.work = 0;
      work.boost = 0;
      work.flareSeen = livingSignal.flareAt;
      work.window = 0.004;
      work.completeAt = 0;
    }
    if (livingSignal.flareAt !== work.flareSeen) {
      work.flareSeen = livingSignal.flareAt;
      if (since > SHELL_KICKOFF) work.boost += FLARE_BOOST;
    }
    work.boost *= Math.exp(-step / BOOST_TAU);
    const rush = work.boost + (spin.dragging ? DRAG_BOOST : 0);
    const building = since > SHELL_KICKOFF && !work.completeAt;
    if (building) work.work = Math.min(1, work.work + (step * (1 + rush)) / BUILD_TOTAL);
    const built = since < 0 ? 0 : since < SHELL_KICKOFF ? shellKickoff(since) : shellFromWork(work.work);
    const rate = since < 0
      ? 0
      : since < SHELL_KICKOFF
        ? (shellKickoff(since + 0.05) - built) / 0.05
        : building ? (shellWorkSlope(work.work) * (1 + rush)) / BUILD_TOTAL : 0;
    // Ventana de montaje suavizada: si saltara con la aceleración, los paneles
    // a medio colocar retrocederían
    work.window += (Math.max(0.004, rate * 0.55) - work.window) * Math.min(1, step * 3);

    // Último panel: la obra se sella desde el punto que mira al visitante
    if (building && work.work >= 1) {
      work.completeAt = now;
      shellUniforms.uWaveAxis.value.copy(camera.position).normalize();
    }
    const sealedAge = work.completeAt ? (now - work.completeAt) / 1000 : -1;
    const sealed = sealedAge < 0 ? 0 : easeInOut(clamp01(sealedAge / 4));

    // Pasado el cierre los últimos paneles terminan de asentarse
    shellUniforms.uBuilt.value = work.completeAt ? 1 + Math.min(0.2, sealedAge * 0.06) : built;
    shellUniforms.uWindow.value = work.window;
    shellUniforms.uIgnite.value = since < 0 ? 0 : clamp01((since - 1.4) / 0.6);
    shellUniforms.uTime.value = time;
    shellUniforms.uSealed.value = sealed;
    coronaUniforms.uSealed.value = sealed;
    shellUniforms.uWave.value = sealedAge < 0 || sealedAge > 3 ? -1 : sealedAge;
    ghostMaterial.opacity = since < 0 ? 0 : 0.14 * easeOut(clamp01((since - 1.3) / 1.4)) * (1 - sealed);
    starUniforms.uDim.value = built * 0.3;
    // Con la esfera cerrada la corona queda tapada: solo asoma un resplandor
    coronaUniforms.uIgnite.value *= (1 - built * 0.45) * (1 - sealed * 0.75);
    const percent = Math.floor(built * 100);
    const rushing = building && rush > 0.4;
    if (since > SHELL_KICKOFF && (percent !== progress.current.percent || rushing !== progress.current.rushing)) {
      progress.current = { percent, rushing };
      livingSignal.onProgress?.(percent, rushing);
    }

    if (!readyMarked.current) {
      readyMarked.current = true;
      livingSignal.markReady();
    }
  });

  return (
    <>
      <mesh ref={star} visible={false}>
        <sphereGeometry args={[1, 160, 120]} />
        <primitive object={starMaterial} attach="material" />
      </mesh>
      <mesh ref={corona} visible={false} renderOrder={1}>
        <planeGeometry args={[CORONA_RADIUS * 2, CORONA_RADIUS * 2]} />
        <primitive object={coronaMaterial} attach="material" />
      </mesh>
      <mesh geometry={shellGeometry} material={shellMaterial} frustumCulled={false} />
      <lineSegments geometry={ghostGeometry} material={ghostMaterial} renderOrder={2} />
      <points frustumCulled={false} renderOrder={3}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[swarm.positions, 3]} />
          <bufferAttribute attach="attributes-aOrbit" args={[swarm.orbit, 4]} />
          <bufferAttribute attach="attributes-aMotion" args={[swarm.motion, 4]} />
        </bufferGeometry>
        <primitive object={swarmMaterial} attach="material" />
      </points>
    </>
  );
};

/* Lienzo del hero: pausado fuera de pantalla; si el equipo no da abasto,
   baja la resolución */
export default function LivingStar({ heroRef, paused }: { heroRef: RefObject<HTMLElement | null>; paused: boolean }) {
  const narrow = typeof window !== 'undefined' && window.innerWidth < 720;
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 1.75));
  return (
    <Canvas
      className="mo-living-canvas"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      dpr={dpr}
      flat
      frameloop={paused ? 'never' : 'always'}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, near: 0.1, far: 100, position: [0, 0, 8] }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      <Scene heroRef={heroRef} count={narrow ? 1300 : 2600} />
    </Canvas>
  );
}
