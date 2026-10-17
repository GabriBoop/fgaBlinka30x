import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Loader2 } from 'lucide-react'

export default function ApprovalCenter() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listInvoices({ status: 'NEEDS_HUMAN_APPROVAL' })
      .then(setInvoices)
      .catch(() => setError('No se pudieron cargar las facturas pendientes'))
      .finally(() => setLoading(false))
  }, [])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const reason = prompt(`Justificación para ${action === 'approve' ? 'aprobar' : 'rechazar'} (obligatorio):`)
    if (!reason) return
    try {
      await api.reviewInvoice(id, action, reason)
      setInvoices((current) => current.filter((i) => i.id !== id))
    } catch (e: any) {
      setError(e.detail || 'Error registrando la acción')
    }
  }

  if (loading) return <div className="center-panel"><Loader2 size={32} /></div>
  if (error) return <div className="center-panel"><div className="alert alert-error">{error}</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Centro de aprobaciones</h1>
      </div>

      {invoices.length === 0 ? (
        <div className="center-panel"><div className="empty-state">No hay facturas pendientes de aprobación humana.</div></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº factura</th>
                <th>Beneficiario</th>
                <th>Importe</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoice_number || '—'}</td>
                  <td>{inv.beneficiary_id || '—'}</td>
                  <td>{inv.amount != null && inv.currency ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: inv.currency }).format(inv.amount) : '—'}</td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-sm btn-success" onClick={() => handleAction(inv.id, 'approve')}>Aprobar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleAction(inv.id, 'reject')}>Rechazar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
