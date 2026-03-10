import { useState } from 'react';
import { SCENE_EXAMPLES } from '../data/scene-examples';
import { LiveExample } from '../components/LiveExample';

export function ScenePage({ debug }: { debug?: boolean }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const example = SCENE_EXAMPLES[activeIdx];

  return (
    <div className="scene-page">
      <section className="scene-page__hero">
        <h1 className="scene-page__title">Slide DSL</h1>
        <p className="scene-page__subtitle">
          <code>@presentation</code> 디렉티브로 슬라이드 모드 활성화.
          8가지 레이아웃으로 프레젠테이션을 선언적으로 작성한다.
        </p>
      </section>

      <div className="scene-page__body">
        <nav className="scene-page__sidebar">
          <ul className="scene-page__example-list">
            {SCENE_EXAMPLES.map((ex, i) => (
              <li key={ex.id}>
                <button
                  className={`scene-page__example-btn${i === activeIdx ? ' active' : ''}`}
                  onClick={() => setActiveIdx(i)}
                >
                  {ex.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="scene-page__main">
          <div className="scene-page__example-header">
            <h2 className="scene-page__example-title">{example.title}</h2>
            <p className="scene-page__example-desc">{example.description}</p>
          </div>
          <LiveExample
            key={example.id}
            dsl={example.dsl}
            showCode={true}
            editable={true}
            layout="col"
            width={800}
            height={450}
            className="scene-page__live"
            debug={debug}
          />
        </div>
      </div>
    </div>
  );
}
