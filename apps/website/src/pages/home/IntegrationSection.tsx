import { useLang } from '../../i18n/context';
import Card from '../../components/Card';
import CodeBlock from '../../components/CodeBlock';

const REACT_CODE = `import { DepixCanvas } from '@depix/react';

<DepixCanvas data={dsl} width={800} height={450} />`;

const MD_CODE = `# Architecture Overview

\`\`\`depix
layers {
  layer "Frontend" { node "React" }
  layer "Backend"  { node "Node.js" }
}
\`\`\``;

const API_CODE = `import { compile } from '@depix/core';

const { ir } = compile(dsl);
// → render to PNG, SVG, or JSON`;

export default function IntegrationSection() {
  const { t } = useLang();

  return (
    <section className="section">
      <div className="container">
        <div className="section__header">
          <h2 className="section__title">{t.integration.title}</h2>
          <p className="section__subtitle">{t.integration.sub}</p>
        </div>
        <div className="grid grid--3">
          <Card title={t.integration.react_title} description={t.integration.react_desc}>
            <CodeBlock code={REACT_CODE} copyable={false} />
          </Card>
          <Card title={t.integration.markdown_title} description={t.integration.markdown_desc}>
            <CodeBlock code={MD_CODE} copyable={false} />
          </Card>
          <Card title={t.integration.api_title} description={t.integration.api_desc}>
            <CodeBlock code={API_CODE} copyable={false} />
          </Card>
        </div>
      </div>
    </section>
  );
}
