import { useMemo, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import type { AstroConcept, VisualLayerId } from '../types';

interface IllustrationViewerProps {
  concept: AstroConcept;
  compared?: boolean;
  compact?: boolean;
  imageOverride?: string;
}

export function IllustrationViewer({
  concept,
  compared = false,
  compact = false,
  imageOverride,
}: IllustrationViewerProps) {
  const [activeLayer, setActiveLayer] = useState<VisualLayerId | 'all'>('all');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(
    concept.hotspots[0]?.id ?? null,
  );

  const activeHotspot = useMemo(
    () => concept.hotspots.find((hotspot) => hotspot.id === activeHotspotId),
    [concept.hotspots, activeHotspotId],
  );

  const visibleHotspots = concept.hotspots.filter(
    (hotspot) => activeLayer === 'all' || hotspot.layer === activeLayer,
  );

  const updatePan = (axis: 'x' | 'y', value: number) => {
    setPan((current) => ({ ...current, [axis]: value }));
  };

  return (
    <div className={compact ? 'illustration-viewer compact' : 'illustration-viewer'}>
      <div className="illustration-frame">
        <img
          src={imageOverride ?? concept.illustration.src}
          alt={concept.illustration.alt}
          loading="lazy"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          }}
        />
        <div className={compared ? 'comparison-sheen is-compared' : 'comparison-sheen'} />
        {visibleHotspots.map((hotspot) => (
          <button
            type="button"
            key={hotspot.id}
            className={activeHotspotId === hotspot.id ? 'hotspot is-active' : 'hotspot'}
            style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
            onClick={() => setActiveHotspotId(hotspot.id)}
            aria-label={`${hotspot.title}: ${hotspot.description}`}
          >
            <span />
          </button>
        ))}
      </div>

      <div className="illustration-controls" aria-label={`Controles de imagen para ${concept.title}`}>
        <div className="layer-tabs">
          <button
            type="button"
            className={activeLayer === 'all' ? 'is-active' : ''}
            onClick={() => setActiveLayer('all')}
          >
            Todo
          </button>
          {concept.layers.map((layer) => (
            <button
              type="button"
              key={layer.id}
              className={activeLayer === layer.id ? 'is-active' : ''}
              onClick={() => setActiveLayer(layer.id)}
              title={layer.description}
            >
              {layer.label}
            </button>
          ))}
        </div>

        {!compact && (
          <div className="zoom-controls">
            <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.15))}>
              <Minus aria-hidden="true" />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(1.75, value + 0.15))}>
              <Plus aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              <Maximize2 aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {!compact && zoom > 1 && (
        <div className="pan-controls">
          <label>
            Horizontal
            <input
              type="range"
              min="-90"
              max="90"
              value={pan.x}
              onChange={(event) => updatePan('x', Number(event.target.value))}
            />
          </label>
          <label>
            Vertical
            <input
              type="range"
              min="-70"
              max="70"
              value={pan.y}
              onChange={(event) => updatePan('y', Number(event.target.value))}
            />
          </label>
        </div>
      )}

      {!compact && (
        <div className="hotspot-caption">
          <strong>{activeHotspot?.title ?? concept.title}</strong>
          <p>{activeHotspot?.description ?? concept.visualNotes}</p>
        </div>
      )}
    </div>
  );
}
