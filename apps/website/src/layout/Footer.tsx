import { useLang } from '../i18n/context';

export default function Footer() {
  const { t } = useLang();

  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-border)',
        padding: '2em 0',
        color: 'var(--color-muted)',
        fontSize: '0.85em',
      }}
    >
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1em' }}>
        <span>&copy; 2026 DAY 1 COMPANY. All rights reserved.</span>
        <div style={{ display: 'flex', gap: '1.5em' }}>
          <a href="https://github.com/ibare/depix" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/@depix/core" target="_blank" rel="noopener noreferrer">
            npm
          </a>
          <span>MIT License</span>
        </div>
      </div>
    </footer>
  );
}
