import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Loader2, ShieldCheck } from 'lucide-react'

export default function Rules() {
  const [policy, setPolicy] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getPolicy()
      .then(setPolicy)
      .catch(() => setError('No se pudo cargar la política'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="center-panel"><Loader2 size={32} /></div>
  if (error) return <div className="center-panel"><div className="alert alert-error">{error}</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reglas y políticas</h1>
      </div>

      <div className="card" style={{ maxWidth: '700px' }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: '#64748b' }}>Política activa v{policy?.version}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Moneda base</div>
            <div>{policy?.currency}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Máximo por factura</div>
            <div>{policy?.max_invoice_amount != null ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: policy.currency }).format(policy.max_invoice_amount) : '—'}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Umbral aprobación humana</div>
            <div>{policy?.approval_threshold != null ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: policy.currency }).format(policy.approval_threshold) : '—'}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Presupuesto periodo</div>
            <div>{policy?.period_budget != null ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: policy.currency }).format(policy.period_budget) : '—'}</div>
          </div>
        </div>

        <h3 style={{ fontSize: '0.95rem', marginTop: '1.5rem', marginBottom: '0.5rem', color: '#64748b' }}>Acciones por motivo</h3>
        <table style={{ width: '100%', marginTop: '0.5rem' }}>
          <thead>
            <tr><th style={{ textAlign: 'left' }}>Código</th><th style={{ textAlign: 'left' }}>Acción</th></tr>
          </thead>
          <tbody>
            {(policy?.rule_actions || []).map((ra: any) => (
              <tr key={ra.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.5rem 0', fontSize: '0.85rem', fontFamily: 'monospace' }}>{ra.code}</td>
                <td style={{ padding: '0.5rem 0', fontSize: '0.85rem' }}>{ra.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1.5rem', maxWidth: '700px', fontSize: '0.85rem', color: '#64748b' }}>
        <ShieldCheck size={16} /> Esta pantalla solo consulta la política. Los cambios de reglas se realizan mediante la API (PUT /api/v1/policy).
      </div>
    </div>
  )
}
