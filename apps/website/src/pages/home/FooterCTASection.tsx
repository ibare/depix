import { Link, useParams } from 'react-router-dom';
import { useLang } from '../../i18n/context';

export default function FooterCTASection() {
  const { lang } = useParams<{ lang: string }>();
  const { t } = useLang();

  return (
    <section className="section section--alt" style={{ textAlign: 'center' }}>
      <div className="container">
        <h2 style={{ marginBottom: '1.5em' }}>{t.footerCta.title}</h2>
        <div className="code-block--inline" style={{ marginBottom: '2em', justifyContent: 'center' }}>
          <code>npm install @depix/core @depix/react</code>
        </div>
        <div style={{ display: 'flex', gap: '0.75em', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={`/${lang}/playground`} className="btn btn--primary">
            {t.hero.cta_playground}
          </Link>
          <Link to={`/${lang}/docs`} className="btn btn--outline">
            {t.nav.docs}
          </Link>
          <a href="https://github.com/ibare/depix" target="_blank" rel="noopener noreferrer" className="btn btn--outline">
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
