import { useState } from 'react';
import { Header, type PageId } from './components/Header';
import { ShowcasePage } from './pages/ShowcasePage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { ReferencePage } from './pages/ReferencePage';
import './App.css';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('showcase');

  return (
    <div className="app">
      <Header activePage={activePage} onPageChange={setActivePage} />
      <main className="app-main">
        {activePage === 'showcase' && <ShowcasePage />}
        {activePage === 'playground' && <PlaygroundPage />}
        {activePage === 'reference' && <ReferencePage />}
      </main>
    </div>
  );
}
