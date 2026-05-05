import { LayoutGrid, Route } from 'lucide-react';
import { ConceptCard } from './ConceptCard';
import type { CSSProperties } from 'react';
import type { AstroChapter, AstroConcept } from '../types';

interface ChapterExplorerProps {
  chapters: AstroChapter[];
  activeChapterId: 'all' | string;
  filteredConcepts: AstroConcept[];
  comparisonIds: string[];
  onChapterChange: (chapterId: 'all' | string) => void;
  onOpenConcept: (concept: AstroConcept) => void;
  onToggleCompare: (conceptId: string) => void;
}

export function ChapterExplorer({
  chapters,
  activeChapterId,
  filteredConcepts,
  comparisonIds,
  onChapterChange,
  onOpenConcept,
  onToggleCompare,
}: ChapterExplorerProps) {
  return (
    <div className="chapter-explorer">
      <aside className="chapter-index" aria-label="Índice de capítulos">
        <div className="chapter-index-title">
          <Route aria-hidden="true" />
          <span>Capítulos</span>
        </div>
        <button
          type="button"
          className={activeChapterId === 'all' ? 'is-active' : ''}
          onClick={() => onChapterChange('all')}
        >
          <span>Todos</span>
          <small>Atlas completo</small>
        </button>
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            className={activeChapterId === chapter.id ? 'is-active' : ''}
            onClick={() => onChapterChange(chapter.id)}
            style={{ '--chapter-color': chapter.color } as CSSProperties}
          >
            <span>
              {chapter.number}. {chapter.title}
            </span>
            <small>{chapter.concepts.length} conceptos</small>
          </button>
        ))}
      </aside>

      <div className="concept-area">
        <div className="concept-area-header">
          <LayoutGrid aria-hidden="true" />
          <span>Fichas visibles</span>
        </div>
        {filteredConcepts.length > 0 ? (
          <div className="concept-grid">
            {filteredConcepts.map((concept) => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                isCompared={comparisonIds.includes(concept.id)}
                onOpen={onOpenConcept}
                onToggleCompare={onToggleCompare}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No hay conceptos con esos filtros.</strong>
            <span>Ajusta búsqueda, escala o plausibilidad para ampliar el atlas visible.</span>
          </div>
        )}
      </div>
    </div>
  );
}
