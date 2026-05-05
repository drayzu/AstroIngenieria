export type AstroScale =
  | 'nave'
  | 'habitat'
  | 'orbital'
  | 'planetaria'
  | 'estelar'
  | 'galactica';

export type Plausibility =
  | 'actual'
  | 'plausible'
  | 'frontera'
  | 'especulativo';

export type VisualizationKind =
  | 'stellar-map'
  | 'rotating-habitat'
  | 'orbital-network'
  | 'dyson-swarm'
  | 'propulsion-fan'
  | 'planetary-lab'
  | 'stellar-engine'
  | 'civilization-grid';

export interface SourceRef {
  title: string;
  publisher: string;
  url: string;
}

export interface VisualizationSpec {
  kind: VisualizationKind;
  caption: string;
  fallback: string;
}

export interface AstroConcept {
  id: string;
  chapterId: string;
  title: string;
  category: string;
  scale: AstroScale;
  plausibility: Plausibility;
  summary: string;
  keyIdea: string;
  mentalImage: string;
  mechanism: string;
  advantages: string[];
  difficulties: string[];
  related: string[];
  metrics: {
    energia: number;
    materiales: number;
    madurez: number;
    maravilla: number;
  };
  sources?: SourceRef[];
}

export interface AstroSection {
  title: string;
  body: string;
}

export interface AstroChapter {
  id: string;
  number: string;
  title: string;
  summary: string;
  scale: AstroScale;
  color: string;
  accent: string;
  sections: AstroSection[];
  concepts: AstroConcept[];
  sources: SourceRef[];
  visualization: VisualizationSpec;
}
