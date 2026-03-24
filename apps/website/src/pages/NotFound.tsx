import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="section" style={{ textAlign: 'center' }}>
      <div className="container">
        <h1 style={{ marginBottom: '0.5em' }}>404</h1>
        <p style={{ color: 'var(--color-muted)', marginBottom: '2em' }}>Page not found.</p>
        <Link to="/" className="btn btn--outline">
          Home
        </Link>
      </div>
    </section>
  );
}
