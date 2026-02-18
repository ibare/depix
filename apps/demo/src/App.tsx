import { useState, useCallback } from 'react';
import { Header, type TabId } from './components/Header';
import { GalleryTab } from './tabs/GalleryTab';
import { EditorTab } from './tabs/EditorTab';
import { EditableTab } from './tabs/EditableTab';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('gallery');
  const [editorDsl, setEditorDsl] = useState<string | undefined>();

  const openInEditor = useCallback((dsl: string) => {
    setEditorDsl(dsl);
    setActiveTab('editor');
  }, []);

  return (
    <div className="app">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="app-main">
        {activeTab === 'gallery' && <GalleryTab onOpenInEditor={openInEditor} />}
        {activeTab === 'editor' && <EditorTab initialDsl={editorDsl} />}
        {activeTab === 'editable' && <EditableTab />}
      </main>
    </div>
  );
}
