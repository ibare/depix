import { Link, useParams } from 'react-router-dom';
import { useLang } from '../i18n/context';

export default function Try() {
  const { lang } = useParams<{ lang: string }>();
  const { t } = useLang();

  return (
    <section className="section" style={{ textAlign: 'center' }}>
      <div className="container">
        <h1 style={{ marginBottom: '1em' }}>{t.nav.try}</h1>
        <p style={{ color: 'var(--color-muted)', marginBottom: '2em', marginLeft: 'auto', marginRight: 'auto' }}>
          {t.placeholder.coming_soon}
        </p>
        <Link to={`/${lang}/`} className="btn btn--outline">
          {t.placeholder.back_home}
        </Link>
      </div>
    </section>
  );
}
