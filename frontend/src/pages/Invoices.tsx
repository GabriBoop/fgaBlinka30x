import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { formatCurrency, formatDate, outcomeLabel, outcomeClass } from '../lib/utils'
import { Loader2, Plus, Search } from 'lucide-react'

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<{ status?: string; company_id?: string }>({})

  useEffect(() => {
    api.listInvoices(filter).then(setInvoices).finally(() => setLoading(false))
  }, [filter.status, filter.company_id])

  return (
    <div className="page">
      <div className="page-actions">
        <Link to="/upload" className="btn btn-primary">
          <Plus size={18} /> Cargar factura
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Search size={18} style={{ color: 'var(--color-text-muted)' }} />
          <select
            className="form-control"
            style={{ width: '200px' }}
            value={filter.status ?? ''}
            onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
          >
            <option value="">Todos los estados</option>
            <option value="ELIGIBLE_SIMULATED">Apta para pago simulado</option>
            <option value="BLOCKED">Frenada</option>
            <option value="NEEDS_HUMAN_APPROVAL">Requiere aprobación</option>
            <option value="PENDING">Pendiente</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="center-panel"><Loader2 size={32} /></div>
      ) : invoices.length === 0 ? (
        <div className="center-panel"><div className="empty-state">No hay facturas registradas.</div></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº factura</th>
                <th>Beneficiario</th>
                <th>Importe</th>
                <th>Moneda</th>
                <th>Emisión</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoice_number || '—'}</td>
                  <td>{inv.beneficiary_id || '—'}</td>
                  <td>{formatCurrency(inv.amount, inv.currency)}</td>
                  <td>{inv.currency || '—'}</td>
                  <td>{formatDate(inv.issue_date)}</td>
                  <td>
                    <span className={`badge ${outcomeClass(inv.status)}`}>{outcomeLabel(inv.status)}</span>
                  </td>
                  <td>
                    <Link to={`/invoices/${inv.id}`} className="btn btn-sm btn-outline">Ver</Link>
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
