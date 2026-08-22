import { useMemo } from 'react';

interface GrainProps {
  opacity?: number;
  blend?: 'multiply' | 'screen' | 'overlay' | 'normal';
  zIndex?: number;
}

const buildNoiseDataUri = () => {
  const svg = [
    "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>",
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/>",
    "<feColorMatrix type='saturate' values='0'/></filter>",
    "<rect width='100%' height='100%' filter='url(#n)' opacity='0.62'/>",
    '</svg>',
  ].join('');
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

export const Grain = ({ opacity = 0.05, blend = 'multiply', zIndex = 60 }: GrainProps) => {
  const noise = useMemo(buildNoiseDataUri, []);
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: noise,
        opacity,
        mixBlendMode: blend,
        zIndex,
      }}
    />
  );
};
