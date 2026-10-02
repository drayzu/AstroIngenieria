import type { AstroConcept } from '../types';
import { translate, type Locale } from '../i18n/messages';

export type MetricKey = keyof AstroConcept['metrics'];

export interface MetricRow {
  key: MetricKey;
  label: string;
  value: number;
  descriptor: string;
  definition: string;
}

const demandDescriptors = ['Mínima', 'Moderada', 'Alta', 'Muy alta', 'Extrema'] as const;
const maturityDescriptors = ['Conceptual', 'Investigación', 'Prototipo', 'Demostrada', 'Operativa'] as const;

const definitions: Record<MetricKey, { label: string; definition: string }> = {
  energia: {
    label: 'Demanda energética',
    definition: 'Potencia y energía totales necesarias para construir u operar el sistema descrito.',
  },
  materiales: {
    label: 'Demanda material',
    definition: 'Masa, extracción, fabricación e infraestructura industrial necesarias.',
  },
  madurez: {
    label: 'Madurez tecnológica',
    definition: 'Grado de desarrollo real: desde una idea conceptual hasta una tecnología operativa.',
  },
};

export const metricRows = (metrics: AstroConcept['metrics'], locale: Locale = 'es'): MetricRow[] =>
  (['energia', 'materiales', 'madurez'] as const).map((key) => ({
    key,
    label: translate(definitions[key].label, locale),
    definition: translate(definitions[key].definition, locale),
    value: metrics[key],
    descriptor: translate((key === 'madurez' ? maturityDescriptors : demandDescriptors)[metrics[key] - 1], locale),
  }));

export const metricValueLabel = (row: MetricRow, locale: Locale = 'es') =>
  translate('{0}: {1} de 5, {2}. {3}', locale, row.label, row.value, row.descriptor.toLocaleLowerCase(locale), row.definition);
