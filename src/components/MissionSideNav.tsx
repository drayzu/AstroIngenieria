import { Menu, X } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { AstroChapter } from '../types';

interface MissionSideNavProps {
  chapters: AstroChapter[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onGoHome: () => void;
  onGoGallery: () => void;
  onGoMission: (chapterId: string) => void;
}

export function MissionSideNav({
  chapters,
  isOpen,
  onToggle,
  onClose,
  onGoHome,
  onGoGallery,
  onGoMission,
}: MissionSideNavProps) {
  const releasePointerFocus = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail > 0) {
      event.currentTarget.blur();
    }
  };

  return (
    <aside className={isOpen ? 'mission-side-nav is-open' : 'mission-side-nav'} aria-label="Navegación de misiones">
      <button
        type="button"
        className="mission-side-toggle"
        onClick={onToggle}
        aria-label={isOpen ? 'Cerrar navegación de misiones' : 'Abrir navegación de misiones'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      <div className="mission-side-panel">
        <span className="sx-kicker">Mission index</span>
        <nav>
          <button
            type="button"
            onClick={(event) => {
              releasePointerFocus(event);
              onGoHome();
            }}
          >
            Inicio
          </button>
          {chapters.map((chapter) => (
            <button
              type="button"
              key={chapter.id}
              onClick={(event) => {
                releasePointerFocus(event);
                onGoMission(chapter.id);
                onClose();
              }}
            >
              <span>{chapter.number}</span>
              {chapter.title}
            </button>
          ))}
          <button
            type="button"
            onClick={(event) => {
              releasePointerFocus(event);
              onGoGallery();
            }}
          >
            Conceptos
          </button>
        </nav>
      </div>
    </aside>
  );
}
