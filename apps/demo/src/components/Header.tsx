import { ThemeSwitcher } from './ThemeSwitcher';

export type PageId = 'showcase' | 'scene' | 'playground' | 'reference';

interface HeaderProps {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  debug?: boolean;
  onDebugToggle?: () => void;
}

const pages: { id: PageId; label: string }[] = [
  { id: 'showcase', label: 'Showcase' },
  { id: 'scene', label: 'Scene' },
  { id: 'playground', label: 'Playground' },
  { id: 'reference', label: 'Reference' },
];

export function Header({ activePage, onPageChange, debug, onDebugToggle }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <div
          className="header-logo"
          onClick={() => onPageChange('showcase')}
          style={{ cursor: 'pointer' }}
        >
          Depix
        </div>
        <nav className="header-tabs">
          {pages.map((page) => (
            <button
              key={page.id}
              className={`header-tab${activePage === page.id ? ' active' : ''}`}
              onClick={() => onPageChange(page.id)}
            >
              {page.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="header-right">
        {onDebugToggle && (
          <button
            className={`header-debug-btn${debug ? ' active' : ''}`}
            onClick={onDebugToggle}
            title="Toggle debug bounds overlay"
          >
            Debug
          </button>
        )}
        <ThemeSwitcher />
      </div>
    </header>
  );
}
