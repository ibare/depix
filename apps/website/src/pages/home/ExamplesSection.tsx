import { useState } from 'react';
import { useLang } from '../../i18n/context';
import TabGroup from '../../components/TabGroup';
import CodeBlock from '../../components/CodeBlock';
import DepixLive from '../../components/DepixLive';
import { EXAMPLE_TABS } from '../../data/example-tabs';

export default function ExamplesSection() {
  const { t } = useLang();
  const [activeId, setActiveId] = useState(EXAMPLE_TABS[0].id);
  const active = EXAMPLE_TABS.find((tab) => tab.id === activeId) ?? EXAMPLE_TABS[0];

  const tabs = EXAMPLE_TABS.map((tab) => ({
    id: tab.id,
    label: t.examples.tabs[tab.prompt_key],
  }));

  return (
    <section className="section section--alt">
      <div className="container">
        <div className="section__header">
          <h2 className="section__title">{t.examples.title}</h2>
          <p className="section__subtitle">{t.examples.sub}</p>
        </div>

        <TabGroup tabs={tabs} activeId={activeId} onChange={setActiveId} />

        {/* Prompt */}
        <div style={{ marginBottom: '1.5em', padding: '1em 1.25em', background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.8em', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t.examples.prompt_label}
          </span>
          <p style={{ marginTop: '0.5em', fontStyle: 'italic', color: 'var(--color-text)' }}>
            {t.examples.prompts[active.prompt_key]}
          </p>
        </div>

        {/* Result — full width on top */}
        <div style={{ marginBottom: '1.5em' }}>
          <span style={{ fontSize: '0.8em', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5em' }}>
            {t.examples.result_label}
          </span>
          <DepixLive dsl={active.dsl} />
        </div>

        {/* DSL Code — collapsible below */}
        <details>
          <summary style={{ fontSize: '0.85em', color: 'var(--color-muted)', cursor: 'pointer', marginBottom: '0.5em', fontWeight: 500 }}>
            {t.examples.dsl_label}
          </summary>
          <CodeBlock code={active.dsl} />
        </details>
      </div>
    </section>
  );
}
