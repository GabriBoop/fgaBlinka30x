import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Loader2 } from 'lucide-react'

export default function Beneficiaries() {
  const [beneficiaries, setBeneficiaries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listBeneficiaries()
      .then(setBeneficiaries)
      .catch(() => setError('No se pudieron cargar los beneficiarios'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="center-panel"><Loader2 size={32} /></div>
  if (error) return <div className="center-panel"><div className="alert alert-error">{error}</div></div>

  return (
    <div className="page">
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>¿Permitido?</th>
              <th>Código referencia</th>
            </tr>
          </thead>
          <tbody>
            {beneficiaries.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '0.75rem 0', fontWeight: '500' }}>{b.name}</td>
                <td style={{ padding: '0.75rem 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{b.category || '—'}</td>
                <td style={{ padding: '0.75rem 0' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    {b.allowed ? '●' : '○'} {b.allowed ? 'Permitido' : 'No permitido'}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 0', fontSize: '0.85rem', fontFamily: 'monospace' }}>{b.reference_code || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {beneficiaries.length === 0 && (
        <div className="center-panel"><div className="empty-state">No hay beneficiarios registrados.</div></div>
      )}
    </div>
  )
}
