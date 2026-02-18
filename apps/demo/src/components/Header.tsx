import { ThemeSwitcher } from './ThemeSwitcher';

export type TabId = 'gallery' | 'editor' | 'editable';

interface HeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'gallery', label: 'Gallery' },
  { id: 'editor', label: 'Editor' },
  { id: 'editable', label: 'Editable' },
];

export function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          Depix<span>v2</span>
        </div>
        <nav className="header-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`header-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="header-right">
        <ThemeSwitcher />
      </div>
    </header>
  );
}
