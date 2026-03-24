import { useLang } from '../i18n/context';
import Card from '../components/Card';

export default function UseCases() {
  const { t } = useLang();

  const cases = [
    { title: t.useCases.markdown_title, desc: t.useCases.markdown_desc },
    { title: t.useCases.slides_title, desc: t.useCases.slides_desc },
    { title: t.useCases.image_title, desc: t.useCases.image_desc },
    { title: t.useCases.app_title, desc: t.useCases.app_desc },
  ];

  return (
    <section className="section">
      <div className="container">
        <div className="section__header">
          <h1 className="section__title">{t.useCases.title}</h1>
          <p className="section__subtitle">{t.useCases.sub}</p>
        </div>
        <div className="grid grid--2">
          {cases.map((c) => (
            <Card key={c.title} title={c.title} description={c.desc} />
          ))}
        </div>
      </div>
    </section>
  );
}
