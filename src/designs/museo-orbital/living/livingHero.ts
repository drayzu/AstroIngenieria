/* Hero «estrella viva»: es la portada por defecto. El hero clásico queda de
   respaldo con movimiento reducido o sin WebGL, y con ?hero=clasico.

   La estrella en WebGL y la ignición del HTML tienen que coincidir al
   píxel: ambas calculan dónde cae la estrella con starFrame, a partir del
   tamaño del hero. La ignición avisa a la escena por livingSignal. */

export const isLivingHero = () => {
  try {
    if (new URLSearchParams(window.location.search).get('hero') === 'clasico') return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    // Solo con aceleración por hardware: dibujada por software la estrella
    // vuelve lenta toda la página (incluso esperas de lectura de píxeles)
    const canvas = document.createElement('canvas');
    const options = { failIfMajorPerformanceCaveat: true };
    const gl = (canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)) as WebGLRenderingContext | null;
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|software|basic render/i.test(renderer);
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
/* Radio de la esfera de Dyson respecto del de la estrella */
export const SHELL_SCALE = 1.6;

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
  intro: { fx: 0.5, fy: 0.5, fr: 0.33 },
  /* Llamarada pedida con un clic: ángulo en el disco y momento */
  flareAngle: 0,
  flareAt: -100,
  ready: new Promise<void>((resolve) => {
    resolveReady = resolve;
  }),
  markReady: () => resolveReady(),
  /* Giro con el mouse: la zona de agarre escribe aquí y la escena lo integra
     con inercia; tras un rato sin tocarla vuelve sola a su encuadre */
  spin: { yaw: 0, pitch: 0, velocityYaw: 0, velocityPitch: 0, dragging: false, touchedAt: 0 },
  /* La cartela escucha el avance de la obra (porcentaje entero; 100 solo al
     cerrarse) y si el visitante la está acelerando */
  onProgress: undefined as ((percent: number, rushing: boolean) => void) | undefined,
};
