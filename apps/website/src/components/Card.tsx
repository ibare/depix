interface CardProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export default function Card({ title, description, children }: CardProps) {
  return (
    <div className="card">
      <h3 className="card__title">{title}</h3>
      <p className="card__desc">{description}</p>
      {children && <div style={{ marginTop: '1em' }}>{children}</div>}
    </div>
  );
}
