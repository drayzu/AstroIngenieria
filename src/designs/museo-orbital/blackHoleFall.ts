import { clamp01 } from './roomShared';

/* Ingeniería estelar: caemos a un agujero negro.

   Llegamos desde lejos: es un punto negro con su disco de acreción y, al
   acercarnos, la gravedad empieza a curvar el cielo a su alrededor. La
   cámara lo orbita mientras baja hacia el plano del disco: las estrellas
   del fondo resbalan alrededor del anillo de Einstein, estirándose en arcos,
   y la luz del lado lejano del disco se dobla por encima y por debajo de la
   sombra. Al final nos zambullimos: la sombra crece, dentro de ella se abre
   la ventana (el otro lado) y el anillo de fotones queda como su borde.

   Todo en un lienzo, en píxeles, con la sombra centrada en la pantalla; el
   tamaño de la sombra lo comparte el recorte de la ventana. */

type Range = [number, number];

export const HOLE = {
  appear: [0.02, 0.05],
  // Nos acercamos desde lejos
  approach: [0.02, 0.22],
  // Aparece a un costado y la cámara gira hacia él
  steer: [0.02, 0.19],
  // La cámara baja hacia el plano del disco y lo rodea
  tilt: [0.05, 0.21],
  orbit: [0.03, 0.28],
  // Al zambullirnos caemos girando, arrastrados por el giro del agujero
  spiral: [0.2, 0.42],
  // La zambullida y la ventana que se abre dentro de la sombra
  plunge: [0.215, 0.29],
  open: [0.235, 0.29],
} satisfies Record<string, Range>;

const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

// Distancia de la cámara al empezar y al llegar (en radios de sombra
// relativos): la sombra crece como su inversa, así el acercamiento acelera
const FAR = 14;
const NEAR = 3;
// Tamaño de la sombra a la distancia NEAR, respecto al lado corto
const SHADOW = 0.15;
// Cuánto crece al zambullirnos
const PLUNGE = 2.6;

/* Radio de la sombra en píxeles, antes de que la ventana cubra la pantalla */
export const holeRadius = (p: number, width: number, height: number) => {
  const distance = FAR * (NEAR / FAR) ** easeInOut(seg(p, HOLE.approach));
  const dive = PLUNGE ** (seg(p, HOLE.plunge) ** 2);
  return SHADOW * Math.min(width, height) * (NEAR / distance) * dive;
};

// Inclinación de la cámara sobre el plano del disco (rad): de arriba a casi
// de canto, como el Gargantua de Interstellar
const inclination = (p: number) => (30 - 25 * easeInOut(seg(p, HOLE.tilt))) * (Math.PI / 180);
// Cuánto lo hemos rodeado (rad) y el ladeo de la cámara
const azimuth = (p: number) => 1.5 * easeInOut(seg(p, HOLE.orbit));

// Brillo del disco: aparece al llegar y se disuelve al cruzarlo, mientras se
// abre la ventana; del otro lado solo quedan el remolino y el anillo de
// fotones. Lo usa también el resplandor
export const holeGlow = (p: number) => seg(p, HOLE.appear) * (1 - seg(p, [0.24, 0.29]));

// Ladeo de la cámara (rad): entra muy ladeada, se endereza al rodearlo y al
// zambullirse cae en espiral; la ventana queda quieta y todo gira alrededor
export const holeRoll = (p: number) =>
  (-34 + 26 * easeInOut(seg(p, HOLE.tilt))) * (Math.PI / 180) + 2.6 * easeInOut(seg(p, HOLE.spiral));

// Dónde está el agujero en pantalla (px desde el centro): llega desde arriba
// a la izquierda, como si la cámara girara para encararlo
export const holeCenter = (p: number, width: number, height: number): [number, number] => {
  const away = 1 - easeInOut(seg(p, HOLE.steer));
  return [-0.2 * width * away, -0.12 * height * away];
};

/* ---------------- El disco: anillos finos de luz ---------------- */

// Radios en sombras, más juntos hacia adentro; opacidad y grosor bajan
// hacia afuera. Uno de cada tres va troceado: son los grumos que giran
// El color es la temperatura: blanco dorado adentro, naranjo al medio y rojo
// profundo afuera
const HEAT: [number, number, number, number][] = [
  [0, 255, 240, 214],
  [0.2, 255, 206, 112],
  [0.45, 255, 140, 58],
  [0.75, 236, 80, 40],
  [1, 170, 40, 30],
];
const heatAt = (t: number) => {
  const next = HEAT.findIndex(([at]) => at >= t);
  const [toAt, ...to] = HEAT[Math.max(1, next)];
  const [fromAt, ...from] = HEAT[Math.max(0, next - 1)];
  const mix = toAt === fromAt ? 0 : (t - fromAt) / (toAt - fromAt);
  return from.map((value, channel) => Math.round(value + (to[channel] - value) * mix));
};
const RINGS = Array.from({ length: 22 }, (_, index) => {
  const t = index / 21;
  const [red, green, blue] = heatAt(t);
  const hot = (white: number, alpha: number) =>
    `rgba(${Math.round(red + (255 - red) * white)}, ${Math.round(green + (255 - green) * white)}, ${Math.round(blue + (255 - blue) * white)}, ${alpha})`;
  return {
    radius: 1.3 + 3.1 * t ** 1.6,
    alpha: 0.12 + 0.85 * (1 - t) ** 1.1,
    width: 1.6 - 0.9 * t,
    clumpy: index % 3 === 1,
    // El lado que viene hacia nosotros (izquierda) brilla más y más blanco
    near: hot(0.35, 1),
    middle: hot(0, 0.8),
    far: `rgba(${Math.round(red * 0.75)}, ${Math.round(green * 0.55)}, ${Math.round(blue * 0.55)}, 0.4)`,
  };
});
const STEPS = 30;

// El cuerpo: franjas anchas y tenues que se solapan; su brillo cae suave
// hacia adentro y hacia afuera, así la banda no tiene bordes duros
const BODY: [number, number, number][] = Array.from({ length: 10 }, (_, index) => {
  const at = 1.3 + 2.5 * (index / 9) ** 1.3;
  return [at, 0.32, 0.04 + 0.17 * Math.exp(-(((at - 1.75) / 0.85) ** 2))];
});

// Y la imagen de abajo: el mismo disco visto por debajo, más angosto y
// pegado a la sombra, pero con cuerpo propio
const UNDER: [number, number, number][] = Array.from({ length: 6 }, (_, index) => {
  const at = 1.06 + 0.08 * index;
  return [at, 0.14, 0.08 + 0.55 * Math.exp(-(((at - 1.12) / 0.18) ** 2))];
});

/* ---------------- El cielo que se curva ---------------- */

// Muchas: solo se dibujan las que caen en el cuadro
const SKY = Array.from({ length: 1600 }, (_, index) => {
  // Direcciones repartidas por la esfera
  const z = seeded(index + 7101) * 2 - 1;
  const angle = seeded(index + 7203) * Math.PI * 2;
  const side = Math.sqrt(1 - z * z);
  return {
    x: side * Math.cos(angle),
    y: side * Math.sin(angle),
    z,
    glow: seeded(index + 7307),
    // Blanca, cálida o fría
    tone: seeded(index + 7411) > 0.7 ? 1 : seeded(index + 7411) < 0.2 ? 2 : 0,
  };
});
const STAR_TONES = ['rgb(246, 244, 240)', 'rgb(255, 222, 196)', 'rgb(206, 224, 255)'];

export const drawHole = (
  context: CanvasRenderingContext2D,
  p: number,
  width: number,
  height: number,
  [r, g, b]: number[],
  // Radio de la sombra y de la ventana ya abierta dentro de ella (px)
  radius: number,
  opening: number,
) => {
  const tint = (alpha: number, white: number) =>
    `rgba(${Math.round(r + (255 - r) * white)}, ${Math.round(g + (255 - g) * white)}, ${Math.round(b + (255 - b) * white)}, ${alpha.toFixed(3)})`;
  const appear = seg(p, HOLE.appear);
  const disk = holeGlow(p);
  const [shiftX, shiftY] = holeCenter(p, width, height);
  const cx = width / 2 + shiftX;
  const cy = height / 2 + shiftY;
  // Al caer en espiral las estrellas se barren en arcos, más mientras más
  // rápido gira la cámara
  const spiral = (at: number) => easeInOut(seg(at, HOLE.spiral));
  const blur = Math.min(0.18, (Math.abs(spiral(p + 0.001) - spiral(p - 0.001)) / 0.002) * 2.6 * 0.005);
  // Al caer todo gira rápido y crece: basta la mitad de los anillos, sin
  // grumos y sin sumar la luz de los trazos (dibujar el disco completo,
  // sumando luz, traba la caída)
  const plunging = p > HOLE.plunge[0];
  // Los anillos que sobran se apagan justo antes, para que no se note el cambio
  const spare = 1 - seg(p, [HOLE.plunge[0] - 0.025, HOLE.plunge[0]]);
  const kept = (index: number) => (index % 2 ? spare : 1);
  const blend: GlobalCompositeOperation = plunging ? 'source-over' : 'lighter';
  const tilt = inclination(p);
  const sinTilt = Math.sin(tilt);
  const turn = azimuth(p);
  const focal = 0.9 * Math.min(width, height);
  // Radio de Einstein: donde el cielo de atrás se vuelve un anillo
  const einstein = radius * 1.5;

  context.save();
  context.translate(cx, cy);
  context.rotate(holeRoll(p));
  // El cielo, curvado por la gravedad. Cada estrella tiene dos imágenes:
  // la principal, empujada hacia afuera del anillo, y una secundaria del
  // otro lado, pegada a él. Cerca del anillo se estiran en arcos
  context.globalCompositeOperation = blend;
  context.lineCap = 'round';
  const cosTurn = Math.cos(turn);
  const sinTurn = Math.sin(turn);
  const cosTilt = Math.cos(tilt);
  // Se juntan en pocos trazos (por tono, brillo y grosor) para no pagar un
  // trazo por estrella
  const reachPx = Math.hypot(width, height) / 2 + 20;
  const batches = new Map<number, Path2D>();
  const image = (distance: number, angle: number, magnify: number, star: (typeof SKY)[number]) => {
    if (distance < radius * 1.02 || distance > reachPx) return;
    const thick = star.glow > 0.55 ? 1 : 0;
    const size = thick ? 1.6 : 0.85;
    const length = Math.min(distance * 0.9, size * 2 * magnify);
    const sweep = length / (2 * distance) + blur;
    // En el remolino basta con las más brillantes: sus arcos son largos
    if (blur > 0.04 && star.glow < 0.4) return;
    const light = appear * (0.35 + 0.65 * star.glow) * Math.min(1.8, Math.sqrt(magnify));
    const level = Math.min(3, Math.floor(light * 4));
    if (level <= 0 && light < 0.12) return;
    const key = star.tone * 8 + thick * 4 + level;
    let path = batches.get(key);
    if (!path) batches.set(key, (path = new Path2D()));
    path.moveTo(distance * Math.cos(angle - sweep), distance * Math.sin(angle - sweep));
    path.arc(0, 0, distance, angle - sweep, angle + sweep);
  };
  for (const star of SKY) {
    // La cámara rodea el agujero y sube o baja: el cielo gira con ella
    const x1 = star.x * cosTurn + star.z * sinTurn;
    const z1 = -star.x * sinTurn + star.z * cosTurn;
    const y2 = star.y * cosTilt - z1 * sinTilt;
    const z2 = star.y * sinTilt + z1 * cosTilt;
    if (z2 < 0.34) continue;
    const plain = focal * (Math.sqrt(1 - z2 * z2) / z2);
    const angle = Math.atan2(y2, x1);
    const root = Math.sqrt(plain * plain + 4 * einstein * einstein);
    const u = plain / Math.max(einstein, 0.001);
    const magnify = (u * u + 2) / (2 * Math.max(u, 0.001) * Math.sqrt(u * u + 4)) + 0.5;
    image((plain + root) / 2, angle, magnify, star);
    if (magnify > 1.05) image((root - plain) / 2, angle + Math.PI, magnify - 1, star);
  }
  batches.forEach((path, key) => {
    const level = key % 4;
    context.globalAlpha = (level + 1) / 4;
    context.lineWidth = key % 8 >= 4 ? 1.6 : 0.85;
    context.strokeStyle = STAR_TONES[Math.floor(key / 8)];
    context.stroke(path);
  });
  context.globalAlpha = 1;

  // La sombra: tapa el cielo de atrás (salvo la ventana, que la recorta)
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = `rgba(0, 0, 0, ${appear.toFixed(3)})`;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  if (opening > 0.5) context.arc(0, 0, opening, 0, Math.PI * 2, true);
  context.fill();

  // El disco: cada anillo con su temperatura, y el lado que se acerca
  // (izquierda) más brillante
  context.globalCompositeOperation = blend;
  const shades = RINGS.map((band) => {
    const ringRadius = band.radius * radius;
    const shade = context.createLinearGradient(-ringRadius, 0, ringRadius, 0);
    shade.addColorStop(0.1, band.near);
    shade.addColorStop(0.5, band.middle);
    shade.addColorStop(1, band.far);
    return shade;
  });
  // Medio anillo, de un ángulo a otro, con la forma que le da `place`
  const ring = (from: number, to: number, place: (angle: number, out: number[]) => void) => {
    const point = [0, 0];
    context.beginPath();
    for (let step = 0; step <= STEPS; step++) {
      place(from + ((to - from) * step) / STEPS, point);
      if (step === 0) context.moveTo(point[0], point[1]);
      else context.lineTo(point[0], point[1]);
    }
    context.stroke();
  };
  // Las formas de cada imagen del disco, para un anillo de cierto radio (px)
  const dome = (ringRadius: number) => {
    const top = radius * (1.08 + 0.5 * (ringRadius / radius - 1.3));
    return (angle: number, out: number[]) => {
      const s = -Math.sin(angle);
      const open = (1 - s) ** 2;
      out[0] = Math.cos(angle) * (top + (ringRadius - top) * open);
      out[1] = -s * Math.max(top, ringRadius * sinTilt);
    };
  };
  const front = (ringRadius: number) => (angle: number, out: number[]) => {
    out[0] = ringRadius * Math.cos(angle);
    out[1] = ringRadius * Math.sin(angle) * sinTilt;
  };
  const below = (underRadius: number) => (angle: number, out: number[]) => {
    out[0] = underRadius * Math.cos(angle);
    out[1] = underRadius * -Math.sin(angle);
  };

  // El cuerpo del disco: bandas anchas y suaves de luz bajo los anillos, que
  // le dan volumen; los anillos finos quedan encima como filamentos
  const body = context.createLinearGradient(-radius * 4.4, 0, radius * 4.4, 0);
  body.addColorStop(0, 'rgba(255, 196, 140, 0.8)');
  body.addColorStop(0.35, 'rgba(255, 238, 214, 1)');
  body.addColorStop(0.65, 'rgba(255, 150, 80, 0.85)');
  body.addColorStop(1, 'rgba(190, 60, 36, 0.45)');
  // Las franjas anchas son lo más caro de pintar cuando la sombra llena la
  // pantalla: se apagan antes que los anillos, que siguen girando al entrar
  const bodyFade = 1 - seg(p, [0.225, 0.262]);
  // Cada franja es una cinta rellena entre dos curvas, no un trazo grueso:
  // así sus extremos cierran planos sobre el disco en vez de cortarse en
  // rectángulos
  const ribbon = (from: number, to: number, inner: (angle: number, out: number[]) => void, outer: (angle: number, out: number[]) => void) => {
    const point = [0, 0];
    context.beginPath();
    for (let step = 0; step <= STEPS; step++) {
      inner(from + ((to - from) * step) / STEPS, point);
      if (step === 0) context.moveTo(point[0], point[1]);
      else context.lineTo(point[0], point[1]);
    }
    for (let step = STEPS; step >= 0; step--) {
      outer(from + ((to - from) * step) / STEPS, point);
      context.lineTo(point[0], point[1]);
    }
    context.fill();
  };
  const bodyPass = (layers: [number, number, number][], place: (ringRadius: number) => (angle: number, out: number[]) => void, from: number, to: number) => {
    if (disk * bodyFade <= 0.01) return;
    // Sin sumar luz: son anchas y sumarlas cuesta el doble
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = body;
    layers.forEach(([at, thickness, alpha]) => {
      const half = thickness / 2;
      context.globalAlpha = disk * bodyFade * alpha;
      ribbon(from, to, place(Math.max(radius * 1.01, at * radius - half)), place(at * radius + half));
    });
    context.globalCompositeOperation = blend;
  };
  bodyPass(BODY.map(([at, thickness, alpha]) => [at, radius * thickness, alpha * 1.3]), dome, Math.PI, Math.PI * 2);
  bodyPass(UNDER.map(([at, thickness, alpha]) => [at, radius * thickness, alpha]), below, Math.PI, Math.PI * 2);

  RINGS.forEach((band, index) => {
    if (disk <= 0.01 || kept(index) <= 0) return;
    const ringRadius = band.radius * radius;
    const spin = (p * 900 * radius) / band.radius ** 1.5;
    context.lineWidth = band.width * (2 - spare);
    if (band.clumpy && !plunging) {
      context.setLineDash([ringRadius * 0.5, ringRadius * 0.18]);
      context.lineDashOffset = -spin;
    } else context.setLineDash([]);
    // Lado lejano, doblado por encima de la sombra: arriba son arcos
    // redondos y concéntricos que la abrazan, y hacia los costados se abren
    // de a poco hasta fundirse con el disco
    context.strokeStyle = shades[index];
    context.globalAlpha = disk * band.alpha * 0.85 * kept(index);
    ring(Math.PI, Math.PI * 2, dome(ringRadius));
    // Y por debajo, más tenue y pegado a la sombra
    if (index < 9) {
      const under = radius * (1.03 + 0.1 * (band.radius - 1.3));
      context.globalAlpha = disk * band.alpha * 0.5 * kept(index);
      ring(Math.PI, Math.PI * 2, below(under));
    }
  });

  // El anillo de fotones: la luz que da vueltas justo en el borde
  context.setLineDash([]);
  context.globalAlpha = appear;
  context.lineWidth = 6;
  context.strokeStyle = tint(0.22, 0.4);
  context.beginPath();
  context.arc(0, 0, radius * 1.01, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 1.3;
  context.strokeStyle = 'rgba(255, 232, 178, 0.95)';
  context.stroke();

  // El lado cercano del disco cruza por delante de la sombra. Es lo único
  // que pasaría sobre la ventana: ahí se recorta, ahí está el otro lado
  if (opening > 0.5) {
    context.beginPath();
    context.rect(-width * 2, -height * 2, width * 4, height * 4);
    context.arc(0, 0, opening, 0, Math.PI * 2);
    context.clip('evenodd');
  }
  bodyPass(BODY.map(([at, thickness, alpha]) => [at, radius * thickness * 0.8, alpha * 1.8]), front, 0, Math.PI);
  RINGS.forEach((band, index) => {
    if (disk <= 0.01 || kept(index) <= 0) return;
    context.strokeStyle = shades[index];
    const ringRadius = band.radius * radius;
    const spin = (p * 900 * radius) / band.radius ** 1.5;
    context.lineWidth = band.width * (2 - spare);
    if (band.clumpy && !plunging) {
      context.setLineDash([ringRadius * 0.5, ringRadius * 0.18]);
      context.lineDashOffset = -spin;
    } else context.setLineDash([]);
    context.globalAlpha = disk * band.alpha * kept(index);
    ring(0, Math.PI, front(ringRadius));
  });

  context.setLineDash([]);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.restore();
};
