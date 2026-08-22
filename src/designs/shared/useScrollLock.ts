import { useEffect } from 'react';

export const useScrollLock = (locked: boolean) => {
  useEffect(() => {
    if (!locked) {
      return;
    }
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [locked]);
};
