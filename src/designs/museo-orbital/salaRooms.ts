/* Cada capítulo se recorre a su manera y continúa el motivo de su portal:
   el portal es la puerta y la sala es lo que hay detrás.

   - spotlight: la primera obra a oscuras, hasta que se enciende su foco
   - wheel: las obras van montadas en la rueda de un hábitat que gira
   - blueprint: cada obra llega como plano y se imprime al pasar
   - horizon: pasillo sobre el horizonte de un planeta que se terraforma
   - orbit: las obras orbitan una estrella hasta capturar su luz
   - acceleration: pasillo que acelera por grupos y frena al llegar
   - starlight: una estrella que se mueve proyecta las sombras de las obras
   - kardashev: pasillo envolvente y una escala que crece al fondo
   - silence: sala a oscuras que solo revela el barrido del radar */

export type RoomKind =
  | 'spotlight'
  | 'wheel'
  | 'blueprint'
  | 'horizon'
  | 'orbit'
  | 'acceleration'
  | 'starlight'
  | 'kardashev'
  | 'silence';

export type CorridorKind = Extract<RoomKind, 'horizon' | 'acceleration' | 'kardashev'>;
export type VerticalKind = Extract<RoomKind, 'spotlight' | 'wheel' | 'blueprint' | 'starlight' | 'silence'>;

const ROOMS: Record<string, RoomKind> = {
  intro: 'spotlight',
  habitats: 'wheel',
  infrastructure: 'blueprint',
  planetary: 'horizon',
  energy: 'orbit',
  propulsion: 'acceleration',
  stellar: 'starlight',
  civilizations: 'kardashev',
  search: 'silence',
};

export const roomFor = (chapterId: string): RoomKind | null => ROOMS[chapterId] ?? null;

export const isCorridor = (kind: RoomKind | null): kind is CorridorKind =>
  kind === 'horizon' || kind === 'acceleration' || kind === 'kardashev';

export const isVertical = (kind: RoomKind | null): kind is VerticalKind =>
  kind === 'spotlight' || kind === 'wheel' || kind === 'blueprint' || kind === 'starlight' || kind === 'silence';
