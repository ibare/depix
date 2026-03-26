import { useParams, useSearchParams } from 'react-router-dom';
import { useLang } from '../i18n/context';
import { getSections } from '../docs';
import type { DocSection } from '../docs';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function Docs() {
  const { lang } = useParams<{ lang: string }>();
  const { t } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();

  const sections = getSections();
  const activeId = searchParams.get('s') || sections[0]?.id || '';
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  const setActiveSection = (id: string) => {
    setSearchParams({ s: id }, { replace: true });
    window.scrollTo({ top: 0 });
  };

  const content = lang === 'ko' ? active.contentKo : active.content;
  const title = lang === 'ko' ? active.titleKo : active.title;

  return (
    <section className="section" style={{ paddingTop: '2em', paddingBottom: '4em' }}>
      <div className="container">
        <div className="docs-layout">
          {/* Sidebar */}
          <nav className="docs-sidebar">
            <h2 className="docs-sidebar__title">{t.nav.docs}</h2>
            <ul className="docs-sidebar__list">
              {sections.map((section) => (
                <li key={section.id}>
                  <button
                    className={`docs-sidebar__item ${section.id === activeId ? 'docs-sidebar__item--active' : ''}`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    {lang === 'ko' ? section.titleKo : section.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <article className="docs-content">
            <h1 className="docs-content__title">{title}</h1>
            <MarkdownRenderer content={content} />
          </article>
        </div>
      </div>
    </section>
  );
}
