import { Home, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PageNotFound() {
  return (
    <div className="page not-found-page">
      <section className="card not-found-card" aria-labelledby="not-found-title">
        <div className="not-found-icon" aria-hidden="true">
          <SearchX size={30} />
        </div>
        <p className="not-found-code">404</p>
        <h2 id="not-found-title">Página no encontrada</h2>
        <p className="not-found-message">
          No encontramos la página que buscas. Puede que la dirección haya cambiado o no exista.
        </p>
        <Link to="/" className="btn btn-primary">
          <Home size={18} />
          Volver al panel
        </Link>
      </section>
    </div>
  )
}
