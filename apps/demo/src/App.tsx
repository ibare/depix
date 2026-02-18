import { useState, useCallback } from 'react';
import { Header, type TabId } from './components/Header';
import { GalleryTab } from './tabs/GalleryTab';
import { EditorTab } from './tabs/EditorTab';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('gallery');
  const [editorDsl, setEditorDsl] = useState<string | null>(null);

  const openInEditor = useCallback((dsl: string) => {
    setEditorDsl(dsl);
    setActiveTab('editor');
  }, []);

  const handleTabChange = useCallback((tab: TabId) => {
    // Only allow Editor tab when DSL is loaded
    if (tab === 'editor' && !editorDsl) return;
    setActiveTab(tab);
  }, [editorDsl]);

  return (
    <div className="app">
      <Header activeTab={activeTab} onTabChange={handleTabChange} />
      <main className={`app-main${activeTab === 'editor' ? ' app-main--editor' : ''}`}>
        {activeTab === 'gallery' && <GalleryTab onOpenInEditor={openInEditor} />}
        {activeTab === 'editor' && editorDsl && <EditorTab initialDsl={editorDsl} />}
      </main>
    </div>
  );
}
