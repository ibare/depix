import { useState } from 'react';
import { Header, type PageId } from './components/Header';
import { ShowcasePage } from './pages/ShowcasePage';
import { ScenePage } from './pages/ScenePage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { ReferencePage } from './pages/ReferencePage';
import './App.css';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('showcase');
  const [debug, setDebug] = useState(false);

  return (
    <div className="app">
      <Header
        activePage={activePage}
        onPageChange={setActivePage}
        debug={debug}
        onDebugToggle={() => setDebug((d) => !d)}
      />
      <main className="app-main">
        {activePage === 'showcase' && <ShowcasePage debug={debug} />}
        {activePage === 'scene' && <ScenePage debug={debug} />}
        {activePage === 'playground' && <PlaygroundPage debug={debug} />}
        {activePage === 'reference' && <ReferencePage debug={debug} />}
      </main>
    </div>
  );
}
