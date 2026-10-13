import { createWarpLoop, createWarpRenderer, type WarpMessage, type WarpSize } from './warpField';

/* Dibujante del salto en su propio hilo: sus cuadros llegan a la pantalla
   aunque el hilo principal esté ocupado montando el capítulo de destino */

type WorkerScope = {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (message: unknown) => void;
  requestAnimationFrame?: (callback: () => void) => number;
};

const scope = self as unknown as WorkerScope;
const schedule = (callback: () => void) => {
  if (scope.requestAnimationFrame) scope.requestAnimationFrame(callback);
  else setTimeout(callback, 16);
};

let loop: ReturnType<typeof createWarpLoop> | null = null;

scope.onmessage = (event: MessageEvent) => {
  const message = event.data as WarpMessage | ({ type: 'init'; canvas: OffscreenCanvas } & WarpSize);
  if (message.type === 'init') {
    try {
      const renderer = createWarpRenderer(message.canvas);
      if (!renderer) throw new Error('webgl');
      loop = createWarpLoop(renderer, schedule, message);
      scope.postMessage({ type: 'ready' });
    } catch {
      scope.postMessage({ type: 'failed' });
    }
    return;
  }
  loop?.handle(message);
};
