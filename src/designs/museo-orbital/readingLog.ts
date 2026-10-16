import { useSyncExternalStore } from 'react';

/* Constelación del visitante: las obras leídas hasta el final, en el orden
   en que se leyeron. Vive en este navegador (como la vitrina), sin cuentas.
   El mapa dibuja una estrella por obra leída y une las estrellas en ese
   orden; "vistas" cuenta cuántas ya mostró el mapa, para encender con
   ceremonia solo las nuevas. */

const LOG_KEY = 'mo-reading-log-v1';
const SEEN_KEY = 'mo-reading-seen-v1';

const listeners = new Set<() => void>();
let cache: readonly string[] | null = null;

const parse = (raw: string | null): string[] => {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(value)) return [];
    const ids = value.filter((id): id is string => typeof id === 'string');
    return [...new Set(ids)];
  } catch {
    return [];
  }
};

export const readLog = (): readonly string[] => {
  if (cache) return cache;
  try {
    cache = parse(window.localStorage.getItem(LOG_KEY));
  } catch {
    cache = [];
  }
  return cache;
};

const emit = () => listeners.forEach((listener) => listener());

/* Anota una obra leída; true si es una estrella nueva */
export const markRead = (id: string) => {
  const log = readLog();
  if (log.includes(id)) return false;
  cache = [...log, id];
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(cache));
  } catch {
    /* Sesión privada: la constelación dura lo que dure la pestaña */
  }
  emit();
  return true;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // Otra pestaña leyó algo: la constelación se pone al día
  const onStorage = (event: StorageEvent) => {
    if (event.key !== LOG_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export const useReadLog = () => useSyncExternalStore(subscribe, readLog, () => [] as readonly string[]);

/* Cuántas estrellas del final del registro todavía no ha mostrado el mapa */
export const unseenCount = () => {
  let seen: number;
  try {
    seen = Number(window.localStorage.getItem(SEEN_KEY) ?? 0) || 0;
  } catch {
    /* sin almacenamiento: todo se ve como ya visto */
    return 0;
  }
  return Math.max(0, readLog().length - seen);
};

/* El mapa ya mostró todo lo leído hasta ahora */
export const markConstellationSeen = () => {
  try {
    window.localStorage.setItem(SEEN_KEY, String(readLog().length));
  } catch {
    /* nada que guardar */
  }
};
