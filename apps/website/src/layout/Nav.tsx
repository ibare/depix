import { Link, useParams, useLocation } from 'react-router-dom';
import { useLang } from '../i18n/context';
import type { Lang } from '../i18n/types';

const navItems = ['use-cases', 'playground', 'docs', 'try'] as const;
type NavKey = (typeof navItems)[number];

const navKeyMap: Record<NavKey, keyof ReturnType<typeof useLang>['t']['nav']> = {
  'use-cases': 'useCases',
  playground: 'playground',
  docs: 'docs',
  try: 'try',
};

export default function Nav() {
  const { lang } = useParams<{ lang: string }>();
  const { pathname } = useLocation();
  const { t } = useLang();
  const otherLang: Lang = lang === 'ko' ? 'en' : 'ko';
  const otherPath = pathname.replace(`/${lang}/`, `/${otherLang}/`).replace(`/${lang}`, `/${otherLang}`);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
        zIndex: 100,
      }}
    >
      <nav className="container" style={{ display: 'flex', alignItems: 'center', height: '3.5rem', gap: '2em' }}>
        <Link
          to={`/${lang}/`}
          style={{
            fontWeight: 700,
            fontSize: '1.1em',
            color: 'var(--color-accent)',
            letterSpacing: '-0.02em',
            marginRight: 'auto',
          }}
        >
          depix
        </Link>

        {navItems.map((item) => {
          const isActive = pathname.includes(`/${item}`);
          return (
            <Link
              key={item}
              to={`/${lang}/${item}`}
              style={{
                fontSize: '0.9em',
                fontWeight: 500,
                color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
                transition: 'color 0.15s',
              }}
            >
              {t.nav[navKeyMap[item]]}
            </Link>
          );
        })}

        <Link
          to={otherPath || `/${otherLang}/`}
          style={{
            fontSize: '0.8em',
            fontWeight: 600,
            color: 'var(--color-muted)',
            padding: '0.25em 0.6em',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {otherLang.toUpperCase()}
        </Link>

        <a
          href="https://github.com/ibare/depix"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-muted)', fontSize: '0.9em' }}
          aria-label="GitHub"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
      </nav>
    </header>
  );
}
