import { useState } from 'react';
import { PLAYGROUND_LEVELS } from '../data/playground-levels';
import { LiveExample } from '../components/LiveExample';

export function PlaygroundPage() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [exampleIdx, setExampleIdx] = useState(0);

  const level = PLAYGROUND_LEVELS[levelIdx];
  const example = level.examples[exampleIdx];

  const handleLevelChange = (idx: number) => {
    setLevelIdx(idx);
    setExampleIdx(0);
  };

  return (
    <div className="playground">
      {/* Level tabs */}
      <div className="playground__levels">
        {PLAYGROUND_LEVELS.map((lv, i) => (
          <button
            key={lv.id}
            className={`playground__level-btn${i === levelIdx ? ' active' : ''}`}
            onClick={() => handleLevelChange(i)}
          >
            {lv.label}
          </button>
        ))}
      </div>

      <p className="playground__level-desc">{level.description}</p>

      <div className="playground__body">
        {/* Sidebar: example list */}
        <nav className="playground__sidebar">
          <ul className="playground__example-list">
            {level.examples.map((ex, i) => (
              <li key={ex.id}>
                <button
                  className={`playground__example-btn${i === exampleIdx ? ' active' : ''}`}
                  onClick={() => setExampleIdx(i)}
                >
                  {ex.title}
                </button>
              </li>
            ))}
          </ul>
          <div className="playground__hint">
            <strong>Hint</strong>
            <p>{example.hint}</p>
          </div>
        </nav>

        {/* Main: editable live example */}
        <div className="playground__main">
          <LiveExample
            key={example.id}
            dsl={example.dsl}
            showCode={true}
            editable={true}
            layout="col"
            width={720}
            height={360}
            className="playground__live"
          />
        </div>
      </div>
    </div>
  );
}
