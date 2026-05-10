import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

interface HomeCursorContextValue {
  clearCursor: () => void;
  setCursor: (label: string, tone?: string) => void;
}

const HomeCursorContext = createContext<HomeCursorContextValue>({
  clearCursor: () => undefined,
  setCursor: () => undefined,
});

const BASE_CURSOR_TONE = '#ff7a59';

interface HomeInteractionLayerProps {
  children: ReactNode;
}

export function HomeInteractionLayer({ children }: HomeInteractionLayerProps) {
  const shouldReduceMotion = useReducedMotion();
  const cursorX = useMotionValue(-120);
  const cursorY = useMotionValue(-120);
  const smoothX = useSpring(cursorX, { damping: 30, stiffness: 420, mass: 0.45 });
  const smoothY = useSpring(cursorY, { damping: 30, stiffness: 420, mass: 0.45 });
  const [isCursorEnabled, setIsCursorEnabled] = useState(false);
  const [cursorState, setCursorState] = useState({
    isActive: false,
    label: 'Explorar',
    tone: BASE_CURSOR_TONE,
  });

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)');
    const syncCursor = () => setIsCursorEnabled(query.matches && !shouldReduceMotion);

    syncCursor();
    query.addEventListener('change', syncCursor);
    return () => query.removeEventListener('change', syncCursor);
  }, [shouldReduceMotion]);

  useEffect(() => {
    if (!isCursorEnabled) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      cursorX.set(event.clientX);
      cursorY.set(event.clientY);
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [cursorX, cursorY, isCursorEnabled]);

  useEffect(() => {
    if (!isCursorEnabled) {
      document.documentElement.classList.remove('has-home-custom-cursor');
      return;
    }

    document.documentElement.classList.add('has-home-custom-cursor');
    return () => document.documentElement.classList.remove('has-home-custom-cursor');
  }, [isCursorEnabled]);

  useEffect(() => {
    if (!isCursorEnabled) {
      return;
    }

    const getClickable = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>('a, button, [role="button"], [data-cursor-label]')
        : null;

    const getCursorLabel = (element: HTMLElement) => {
      const explicitLabel = element.dataset.cursorLabel;
      const ariaLabel = element.getAttribute('aria-label');
      const textLabel = element.textContent?.trim().replace(/\s+/g, ' ');
      return explicitLabel || textLabel || ariaLabel || 'Abrir';
    };

    const handlePointerOver = (event: PointerEvent) => {
      const clickable = getClickable(event.target);
      if (!clickable || clickable.hasAttribute('disabled') || clickable.getAttribute('aria-disabled') === 'true') {
        return;
      }

      setCursorState({
        isActive: true,
        label: getCursorLabel(clickable),
        tone: clickable.dataset.cursorTone || BASE_CURSOR_TONE,
      });
    };

    const handlePointerOut = (event: PointerEvent) => {
      const clickable = getClickable(event.target);
      if (!clickable || (event.relatedTarget instanceof Node && clickable.contains(event.relatedTarget))) {
        return;
      }

      setCursorState((current) => ({
        ...current,
        isActive: false,
        label: 'Explorar',
        tone: BASE_CURSOR_TONE,
      }));
    };

    document.addEventListener('pointerover', handlePointerOver);
    document.addEventListener('pointerout', handlePointerOut);
    return () => {
      document.removeEventListener('pointerover', handlePointerOver);
      document.removeEventListener('pointerout', handlePointerOut);
    };
  }, [isCursorEnabled]);

  const setCursor = useCallback((label: string, tone = BASE_CURSOR_TONE) => {
    setCursorState({ isActive: true, label, tone });
  }, []);

  const clearCursor = useCallback(() => {
    setCursorState({
      isActive: false,
      label: 'Explorar',
      tone: BASE_CURSOR_TONE,
    });
  }, []);

  const contextValue = useMemo(() => ({ clearCursor, setCursor }), [clearCursor, setCursor]);
  const shellStyle = { '--home-cursor-tone': cursorState.tone } as CSSProperties;

  return (
    <HomeCursorContext.Provider value={contextValue}>
      <div
        className={isCursorEnabled ? 'home-interaction-shell has-custom-cursor' : 'home-interaction-shell'}
        style={shellStyle}
      >
        {children}
        <AnimatePresence>
          {isCursorEnabled ? (
            <>
              <motion.div
                aria-hidden="true"
                className="home-sun-spotlight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                style={{ x: smoothX, y: smoothY }}
              />
              <motion.div
                aria-hidden="true"
                className={cursorState.isActive ? 'home-cursor is-active' : 'home-cursor'}
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.72 }}
                style={{ x: smoothX, y: smoothY }}
              >
                <span>{cursorState.label}</span>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </div>
    </HomeCursorContext.Provider>
  );
}

export const useHomeCursor = () => useContext(HomeCursorContext);
