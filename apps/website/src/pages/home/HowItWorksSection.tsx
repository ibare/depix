import { useLang } from '../../i18n/context';
import CodeBlock from '../../components/CodeBlock';

const CODE = `// ① System prompt includes Depix DSL grammar
const dsl = await llm.generate(prompt, { system: DEPIX_DSL_PROMPT });

// ② Compile and render
<DepixCanvas data={dsl} width={800} height={450} />`;

export default function HowItWorksSection() {
  const { t } = useLang();

  return (
    <section className="section">
      <div className="container">
        <div className="section__header">
          <h2 className="section__title">{t.howItWorks.title}</h2>
          <p className="section__subtitle">{t.howItWorks.sub}</p>
        </div>
        <div style={{ maxWidth: '640px' }}>
          <CodeBlock code={CODE} />
        </div>
        <div style={{ marginTop: '2em', display: 'flex', flexDirection: 'column', gap: '0.75em' }}>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.95em' }}>{t.howItWorks.step1}</p>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.95em' }}>{t.howItWorks.step2}</p>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.95em' }}>{t.howItWorks.step3}</p>
        </div>
      </div>
    </section>
  );
}
