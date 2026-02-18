import { useState } from 'react';
import { DepixCanvas } from '@depix/react';
import { EXAMPLES, CATEGORIES, type Category } from '../examples';

interface GalleryTabProps {
  onOpenInEditor: (dsl: string) => void;
}

export function GalleryTab({ onOpenInEditor }: GalleryTabProps) {
  const [filter, setFilter] = useState<Category | 'all'>('all');

  const filtered = filter === 'all' ? EXAMPLES : EXAMPLES.filter((e) => e.category === filter);

  return (
    <div>
      <div className="gallery-filters">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`filter-btn${filter === cat.id ? ' active' : ''}`}
            onClick={() => setFilter(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className="gallery-grid">
        {filtered.map((example) => (
          <div key={example.id} className="gallery-card">
            <div className="card-preview">
              <DepixCanvas data={example.dsl} width={400} height={225} />
            </div>
            <div className="card-body">
              <div className="card-title">{example.title}</div>
              <div className="card-desc">{example.description}</div>
              <div className="card-footer">
                <span className="card-badge">{example.category}</span>
                <button className="btn btn-sm" onClick={() => onOpenInEditor(example.dsl)}>
                  Open in Editor
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
