import { useLang } from '../../i18n/context';
import DepixLive from '../../components/DepixLive';
import { PIPELINE_BEFORE, PIPELINE_AFTER } from '../../data/problem-dsl';

export default function ProblemSection() {
  const { t } = useLang();

  return (
    <section className="section section--alt">
      <div className="container">
        <div className="section__header">
          <h2 className="section__title">{t.problem.title}</h2>
        </div>
        <div className="grid grid--2">
          <div>
            <h3 style={{ marginBottom: '0.5em', fontSize: '1em', color: 'var(--color-muted)', fontWeight: 600 }}>
              {t.problem.before_title}
            </h3>
            <DepixLive dsl={PIPELINE_BEFORE} />
            <p style={{ marginTop: '1em', fontSize: '0.9em', color: 'var(--color-muted)', lineHeight: 1.5 }}>
              {t.problem.before_desc}
            </p>
          </div>
          <div>
            <h3 style={{ marginBottom: '0.5em', fontSize: '1em', color: 'var(--color-accent)', fontWeight: 600 }}>
              {t.problem.after_title}
            </h3>
            <DepixLive dsl={PIPELINE_AFTER} />
            <p style={{ marginTop: '1em', fontSize: '0.9em', color: 'var(--color-muted)', lineHeight: 1.5 }}>
              {t.problem.after_desc}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
