import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Box, ImageIcon, Maximize2, Minus, Plus } from 'lucide-react';
import type { AstroConcept, VisualLayerId } from '../types';

const ONeillCylinderModel = lazy(() =>
  import('./ONeillCylinderModel').then((module) => ({ default: module.ONeillCylinderModel })),
);

type ViewerMode = 'image' | 'model3d';

interface IllustrationViewerProps {
  concept: AstroConcept;
  compared?: boolean;
  compact?: boolean;
  imageOverride?: string;
  altOverride?: string;
  hotspotsEnabled?: boolean;
}

export function IllustrationViewer({
  concept,
  compared = false,
  compact = false,
  imageOverride,
  altOverride,
  hotspotsEnabled = true,
}: IllustrationViewerProps) {
  const [activeLayer, setActiveLayer] = useState<VisualLayerId | 'all'>('all');
  const [viewerMode, setViewerMode] = useState<ViewerMode>('image');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(
    concept.hotspots[0]?.id ?? null,
  );
  const hasModel3d = Boolean(concept.model3d);

  useEffect(() => {
    setViewerMode('image');
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setActiveLayer('all');
    setActiveHotspotId(concept.hotspots[0]?.id ?? null);
  }, [concept.id, concept.hotspots]);

  const activeHotspot = useMemo(
    () => concept.hotspots.find((hotspot) => hotspot.id === activeHotspotId),
    [concept.hotspots, activeHotspotId],
  );

  const visibleHotspots = hotspotsEnabled
    ? concept.hotspots.filter((hotspot) => activeLayer === 'all' || hotspot.layer === activeLayer)
    : [];

  const updatePan = (axis: 'x' | 'y', value: number) => {
    setPan((current) => ({ ...current, [axis]: value }));
  };

  const modelCaption = concept.model3d?.caption ?? concept.visualNotes;

  return (
    <div className={compact ? 'illustration-viewer compact' : 'illustration-viewer'}>
      <div className="illustration-frame">
        {viewerMode === 'model3d' && concept.model3d?.kind === 'oneill-cylinder' ? (
          <Suspense
            fallback={
              <div className="model3d-loading">
                <Box aria-hidden="true" />
                <span>Preparando modelo 3D</span>
              </div>
            }
          >
            <ONeillCylinderModel />
          </Suspense>
        ) : (
          <img
            src={imageOverride ?? concept.illustration.src}
            alt={altOverride ?? concept.illustration.alt}
            loading="lazy"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            }}
          />
        )}
        <div className={compared ? 'comparison-sheen is-compared' : 'comparison-sheen'} />
        {viewerMode === 'image' &&
          visibleHotspots.map((hotspot) => (
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

      <div className="illustration-controls" aria-label={`Controles visuales para ${concept.title}`}>
        {hasModel3d && (
          <div className="view-mode-tabs" aria-label={`Modo visual para ${concept.title}`}>
            <button
              type="button"
              className={viewerMode === 'image' ? 'is-active' : ''}
              onClick={() => setViewerMode('image')}
            >
              <ImageIcon aria-hidden="true" />
              Imagen
            </button>
            <button
              type="button"
              className={viewerMode === 'model3d' ? 'is-active' : ''}
              onClick={() => setViewerMode('model3d')}
            >
              <Box aria-hidden="true" />
              3D
            </button>
          </div>
        )}

        {viewerMode === 'image' && hotspotsEnabled && (
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
        )}

        {!compact && viewerMode === 'image' && (
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

      {!compact && viewerMode === 'image' && zoom > 1 && (
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

      {!compact && hotspotsEnabled && (
        <div className="hotspot-caption">
          <strong>{viewerMode === 'model3d' ? concept.model3d?.label : (activeHotspot?.title ?? concept.title)}</strong>
          <p>{viewerMode === 'model3d' ? modelCaption : (activeHotspot?.description ?? concept.visualNotes)}</p>
        </div>
      )}
    </div>
  );
}
