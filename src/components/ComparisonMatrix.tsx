import { BarChart3, Eye, Plus, X } from 'lucide-react';
import { plausibilityLabels, scaleLabels } from '../data/astroData';
import type { AstroConcept } from '../types';

interface ComparisonMatrixProps {
  concepts: AstroConcept[];
  comparisonIds: string[];
  onToggleConcept: (conceptId: string) => void;
  onOpenConcept: (concept: AstroConcept) => void;
}

const metricLabels = {
  energia: 'Energía',
  materiales: 'Materiales',
  madurez: 'Madurez',
  maravilla: 'Maravilla',
} satisfies Record<keyof AstroConcept['metrics'], string>;

export function ComparisonMatrix({
  concepts,
  comparisonIds,
  onToggleConcept,
  onOpenConcept,
}: ComparisonMatrixProps) {
  const comparedConcepts = comparisonIds
    .map((id) => concepts.find((concept) => concept.id === id))
    .filter((concept): concept is AstroConcept => Boolean(concept));
  const suggestions = concepts
    .filter((concept) => !comparisonIds.includes(concept.id))
    .slice(0, 18);

  return (
    <div className="comparison-layout">
      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <caption>
            <BarChart3 aria-hidden="true" />
            Conceptos seleccionados para comparación
          </caption>
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Escala</th>
              <th>Plausibilidad</th>
              {Object.values(metricLabels).map((label) => (
                <th key={label}>{label}</th>
              ))}
              <th>Ficha</th>
            </tr>
          </thead>
          <tbody>
            {comparedConcepts.map((concept) => (
              <tr key={concept.id}>
                <td>
                  <strong>{concept.title}</strong>
                  <span>{concept.category}</span>
                </td>
                <td>{scaleLabels[concept.scale]}</td>
                <td>{plausibilityLabels[concept.plausibility]}</td>
                {(Object.keys(metricLabels) as Array<keyof AstroConcept['metrics']>).map(
                  (metric) => (
                    <td key={metric}>
                      <span className="mini-meter" aria-label={`${metricLabels[metric]} ${concept.metrics[metric]} de 5`}>
                        <i style={{ width: `${concept.metrics[metric] * 20}%` }} />
                      </span>
                    </td>
                  ),
                )}
                <td>
                  <button type="button" onClick={() => onOpenConcept(concept)} aria-label={`Abrir ${concept.title}`}>
                    <Eye aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => onToggleConcept(concept.id)} aria-label={`Quitar ${concept.title}`}>
                    <X aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="comparison-picker">
        <h3>Agregar conceptos</h3>
        <div className="picker-list">
          {suggestions.map((concept) => (
            <button type="button" key={concept.id} onClick={() => onToggleConcept(concept.id)}>
              <Plus aria-hidden="true" />
              <span>{concept.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
