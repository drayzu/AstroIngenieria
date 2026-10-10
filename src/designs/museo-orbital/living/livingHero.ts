/* Hero experimental «estrella viva»: se activa con ?hero=viva.

   La estrella en WebGL y la ignición del HTML tienen que coincidir al
   píxel: ambas calculan dónde cae la estrella con starFrame, a partir del
   tamaño del hero. La ignición avisa a la escena por livingSignal. */

export const isLivingHero = () => {
  try {
    if (new URLSearchParams(window.location.search).get('hero') !== 'viva') return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

export interface StarFrame {
  /* Centro y radio del disco, en píxeles dentro del hero */
  x: number;
  y: number;
  r: number;
}

/* Escritorio: la estrella a la derecha y el título en el espacio negro de
   la izquierda. Vertical: la estrella arriba y el título abajo. */
export const starFrame = (width: number, height: number): StarFrame => {
  if (width < 720 || width / height < 0.9) {
    return { x: width * 0.5, y: height * 0.19, r: Math.min(width * 0.3, height * 0.15) };
  }
  return { x: width * 0.725, y: height * 0.43, r: Math.min(height * 0.3, width * 0.2) };
};

let resolveReady: () => void = () => {};

export const livingSignal = {
  /* performance.now() de la ignición; 0 mientras la estrella no se enciende */
  ignitedAt: 0,
  /* Dónde nace la estrella (fracciones del hero): el centro de la pantalla.
     Después la escena la lleva a su lugar definido por starFrame. */
  intro: { fx: 0.5, fy: 0.4675, fr: 0.33 },
  /* Llamarada pedida con un clic: ángulo en el disco y momento */
  flareAngle: 0,
  flareAt: -100,
  ready: new Promise<void>((resolve) => {
    resolveReady = resolve;
  }),
  markReady: () => resolveReady(),
  /* La cartela escucha el avance de la obra (porcentaje entero) */
  onProgress: undefined as ((percent: number) => void) | undefined,
};
