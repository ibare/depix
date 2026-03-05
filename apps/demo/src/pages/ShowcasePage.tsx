import { SHOWCASE_EXAMPLES } from '../data/showcase-examples';
import { AsciiPanel } from '../components/AsciiPanel';
import { LiveExample } from '../components/LiveExample';

export function ShowcasePage() {
  return (
    <div className="showcase">
      <section className="showcase__hero">
        <h1 className="showcase__title">Depix</h1>
        <p className="showcase__subtitle">
          Declarative Diagram DSL + Visual Editor
        </p>
        <p className="showcase__desc">
          ASCII로 스케치하던 다이어그램을, DSL로 선언하면 아름다운 캔버스가 완성됩니다.
          <br />
          캔버스 위에서 hover하면 바로 편집할 수 있습니다.
        </p>
      </section>

      <section className="showcase__flow-label">
        <span className="showcase__flow-step">Concept (ASCII)</span>
        <span className="showcase__flow-arrow">&rarr;</span>
        <span className="showcase__flow-step">DSL Code</span>
        <span className="showcase__flow-arrow">&rarr;</span>
        <span className="showcase__flow-step">Rendered Diagram</span>
      </section>

      <div className="showcase__examples">
        {SHOWCASE_EXAMPLES.map((ex) => (
          <section key={ex.id} className="showcase__item">
            <div className="showcase__item-header">
              <h2 className="showcase__item-title">{ex.title}</h2>
              <p className="showcase__item-desc">{ex.description}</p>
            </div>
            <div className="showcase__triple">
              <AsciiPanel content={ex.ascii} className="showcase__ascii" />
              <div className="showcase__arrow">&rarr;</div>
              <LiveExample
                dsl={ex.dsl}
                showCode={true}
                layout="row"
                width={480}
                height={270}
                className="showcase__live"
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
