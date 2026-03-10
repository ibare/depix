import { useState } from 'react';
import { REFERENCE_CATEGORIES } from '../data/reference-sections';
import { LiveExample } from '../components/LiveExample';

export function ReferencePage({ debug }: { debug?: boolean }) {
  const [activeCat, setActiveCat] = useState(REFERENCE_CATEGORIES[0].id);

  const category = REFERENCE_CATEGORIES.find((c) => c.id === activeCat) ?? REFERENCE_CATEGORIES[0];

  return (
    <div className="reference">
      {/* Category nav */}
      <nav className="reference__nav">
        {REFERENCE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`reference__nav-btn${cat.id === activeCat ? ' active' : ''}`}
            onClick={() => setActiveCat(cat.id)}
          >
            {cat.title}
          </button>
        ))}
      </nav>

      {/* Sections */}
      <div className="reference__content">
        {category.sections.map((section) => (
          <section key={section.id} className="reference__section">
            <h2 className="reference__section-title">{section.title}</h2>
            <p className="reference__section-desc">{section.description}</p>

            {section.syntax && (
              <pre className="reference__syntax">
                <code>{section.syntax}</code>
              </pre>
            )}

            {section.examples.map((ex, i) => (
              <div key={i} className="reference__example">
                <h3 className="reference__example-label">{ex.label}</h3>
                <LiveExample
                  dsl={ex.dsl}
                  showCode={true}
                  layout="row"
                  width={420}
                  height={240}
                  themeName={ex.themeName}
                  debug={debug}
                />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
