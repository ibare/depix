import { Link, useParams } from 'react-router-dom';
import { useLang } from '../../i18n/context';

export default function HeroSection() {
  const { lang } = useParams<{ lang: string }>();
  const { t } = useLang();

  return (
    <section className="section" style={{ paddingTop: '6em', paddingBottom: '5em' }}>
      <div className="container">
        <h1 style={{ fontSize: '3em', lineHeight: 1.1, whiteSpace: 'pre-line', marginBottom: '0.5em', maxWidth: '14em' }}>
          {t.hero.headline}
        </h1>
        <p style={{ fontSize: '1.15em', color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: '2em', maxWidth: 'var(--text-max)' }}>
          {t.hero.sub}
        </p>
        <div className="code-block--inline" style={{ marginBottom: '2em' }}>
          <code>npm install @depix/core @depix/react</code>
        </div>
        <div style={{ display: 'flex', gap: '0.75em', flexWrap: 'wrap' }}>
          <Link to={`/${lang}/playground`} className="btn btn--primary">
            {t.hero.cta_playground}
          </Link>
          <a href="https://github.com/ibare/depix" target="_blank" rel="noopener noreferrer" className="btn btn--outline">
            {t.hero.cta_github}
          </a>
        </div>
      </div>
    </section>
  );
}
