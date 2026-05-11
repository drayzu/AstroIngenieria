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

export type VisualLayerId = 'estructura' | 'energia' | 'riesgos' | 'escala' | 'materiales';

export type ConceptVisualArchetype =
  | 'introduccion-principios'
  | 'habitats-espaciales'
  | 'infraestructura-espacial'
  | 'energia-estelar-computacion'
  | 'propulsion-espacial'
  | 'propulsion-especulativa'
  | 'ingenieria-planetaria'
  | 'ingenieria-estelar'
  | 'civilizaciones-seti'
  | 'complementarios-abstractos';

export type ConceptVisualLayerKind = 'exterior' | 'conceptual' | 'immersive';

export interface ConceptIllustrationVariant {
  src: string;
  alt: string;
  prompt: string;
  style: string;
  credit: string;
}

export type ConceptModel3dKind = 'oneill-cylinder';

export interface ConceptModel3d {
  kind: ConceptModel3dKind;
  label: string;
  caption: string;
}

export interface ConceptIllustration extends ConceptIllustrationVariant {
  interior?: ConceptIllustrationVariant;
}

export interface ConceptVisualNarrativeLayer {
  layer: ConceptVisualLayerKind;
  label: string;
  role: string;
  src?: string;
  target: string;
  alt: string;
  prompt: string;
  caption: string;
  style: string;
  credit: string;
}

export interface ConceptVisualNarrative {
  slug: string;
  archetype: ConceptVisualArchetype;
  exterior: ConceptVisualNarrativeLayer;
  conceptual: ConceptVisualNarrativeLayer;
  immersive: ConceptVisualNarrativeLayer;
}

export type DossierEvidence = 'fuente' | 'estimacion' | 'conceptual';

export interface ConceptReadingSection {
  id: string;
  title: string;
  body: string[];
}

export interface ConceptNarrative {
  title: string;
  lead: string;
  paragraphs: string[];
  sections: ConceptReadingSection[];
  closing: string;
}

export interface ConceptLongReadCallout {
  label: string;
  body: string;
}

export interface ConceptLongReadSection {
  id: string;
  title: string;
  body: string[];
  callout?: ConceptLongReadCallout;
}

export interface ConceptLongRead {
  title: string;
  subtitle: string;
  sections: ConceptLongReadSection[];
  closing: string;
  takeaways: string[];
}

export interface ConceptDossierItem {
  label: string;
  body: string;
  evidence: DossierEvidence;
}

export interface ConceptDossierSection {
  id: string;
  title: string;
  items: ConceptDossierItem[];
}

export interface VisualHotspot {
  id: string;
  x: number;
  y: number;
  title: string;
  description: string;
  layer: VisualLayerId;
}

export interface VisualLayer {
  id: VisualLayerId;
  label: string;
  description: string;
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
  illustration: ConceptIllustration;
  visualArchetype: ConceptVisualArchetype;
  visualNarrative: ConceptVisualNarrative;
  hotspots: VisualHotspot[];
  layers: VisualLayer[];
  visualNotes: string;
  model3d?: ConceptModel3d;
  metrics: {
    energia: number;
    materiales: number;
    madurez: number;
    maravilla: number;
  };
  narrative: ConceptNarrative;
  longRead: ConceptLongRead;
  dossier: ConceptDossierSection[];
  sources?: SourceRef[];
}

export interface AstroSection {
  title: string;
  body: string;
}

export interface ChapterVisual {
  heroImage: string;
  aiPrompt: string;
  missionLabel: string;
  cta: string;
  visualFocus: string;
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
  visual?: ChapterVisual;
}
