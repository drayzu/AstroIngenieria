import { useEffect, useId } from 'react';
import { lockSmoothScroll } from './smoothScroll';

export const useScrollLock = (locked: boolean) => {
  const key = useId();
  useEffect(() => {
    if (!locked) {
      return;
    }
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    // El scroll con inercia del museo también se detiene mientras dure
    lockSmoothScroll(key, true);
    return () => {
      document.documentElement.style.overflow = previous;
      lockSmoothScroll(key, false);
    };
  }, [key, locked]);
};
