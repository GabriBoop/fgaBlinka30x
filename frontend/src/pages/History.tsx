import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { Loader2 } from 'lucide-react'
import { outcomeLabel, outcomeClass } from '../lib/utils'

export default function History() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listInvoices()
      .then(setInvoices)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="center-panel"><Loader2 size={32} /></div>

  return (
    <div className="page">
      <div className="card">
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          Cada decisión queda registrada con la versión de la política aplicada y los motivos. Una reevaluación añade un nuevo registro sin sobrescribir el original.
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="center-panel"><div className="empty-state">Sin facturas en el historial.</div></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Resultado</th>
                <th>Versión política</th>
                <th>Ver detalle</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 0' }}>{inv.invoice_number || inv.id}</td>
                  <td style={{ padding: '0.75rem 0' }}>
                    <span className={`badge ${outcomeClass(inv.status)}`}>{outcomeLabel(inv.status)}</span>
                  </td>
                  <td style={{ padding: '0.75rem 0' }}>v1</td>
                  <td style={{ padding: '0.75rem 0' }}><Link to={`/invoices/${inv.id}`} className="btn btn-sm btn-outline">Ver</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
