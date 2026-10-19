import { useEffect, useRef } from 'react';
import { depthSourceFor, moodOf, mountLivingPainting } from './livingPainting';
import { livingRoomsEnabled, registerRoomWork } from './livingRooms';
import './livingPainting.css';

/* La obra viva encima de su imagen: misma caja, mismo encuadre. Si la imagen
   no tiene mapa de profundidad (o el movimiento está reducido), no dibuja nada
   y queda la imagen de siempre */
export const LivingCanvas = ({ src, chapterId }: { src: string; chapterId?: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const depthSrc = depthSourceFor(src);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !depthSrc) return;
    return mountLivingPainting(canvas, src, depthSrc, moodOf(chapterId));
  }, [src, depthSrc, chapterId]);
  if (!depthSrc) return null;
  return <canvas ref={ref} className="mo-living" aria-hidden="true" />;
};

/* La misma idea en una obra colgada de una sala. El lienzo se monta con la
   obra (no después: agregar nodos dentro del museo hace que el cielo vuelva
   a medirlo todo) y solo dibuja cuando la obra está bien a la vista */
export const RoomLivingCanvas = ({ src, chapterId }: { src: string; chapterId?: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const depthSrc = livingRoomsEnabled() ? depthSourceFor(src) : null;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !depthSrc) return;
    return registerRoomWork(canvas, src, depthSrc, moodOf(chapterId));
  }, [src, depthSrc, chapterId]);
  if (!depthSrc) return null;
  return <canvas ref={ref} className="mo-living mo-living-room" aria-hidden="true" />;
};
