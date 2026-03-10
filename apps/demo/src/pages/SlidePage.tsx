import { useState } from 'react';
import { SLIDE_EXAMPLES } from '../data/slide-examples';
import { LiveExample } from '../components/LiveExample';

export function SlidePage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const example = SLIDE_EXAMPLES[activeIdx];

  return (
    <div className="slide-page">
      <section className="slide-page__hero">
        <h1 className="slide-page__title">Slide DSL</h1>
        <p className="slide-page__subtitle">
          <code>@presentation</code> 디렉티브로 슬라이드 모드 활성화.
          8가지 레이아웃으로 프레젠테이션을 선언적으로 작성한다.
        </p>
      </section>

      <div className="slide-page__body">
        <nav className="slide-page__sidebar">
          <ul className="slide-page__example-list">
            {SLIDE_EXAMPLES.map((ex, i) => (
              <li key={ex.id}>
                <button
                  className={`slide-page__example-btn${i === activeIdx ? ' active' : ''}`}
                  onClick={() => setActiveIdx(i)}
                >
                  {ex.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="slide-page__main">
          <div className="slide-page__example-header">
            <h2 className="slide-page__example-title">{example.title}</h2>
            <p className="slide-page__example-desc">{example.description}</p>
          </div>
          <LiveExample
            key={example.id}
            dsl={example.dsl}
            showCode={true}
            editable={true}
            layout="col"
            width={800}
            height={450}
            className="slide-page__live"
          />
        </div>
      </div>
    </div>
  );
}
