import { ArrowUpRight } from 'lucide-react';
import type { SourceRef } from '../types';

interface SourceListProps {
  sources: SourceRef[];
  compact?: boolean;
}

export function SourceList({ sources, compact = false }: SourceListProps) {
  return (
    <div className={compact ? 'source-list compact' : 'source-list'}>
      {sources.map((source) => (
        <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
          <span>{source.publisher}</span>
          <strong>{source.title}</strong>
          <ArrowUpRight aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
