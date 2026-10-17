import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { formatCurrency, formatDate, outcomeLabel, outcomeClass, reasonChipClass } from '../lib/utils'
import { Loader2, RefreshCw, Edit2 } from 'lucide-react'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<any>(null)
  const [decisions, setDecisions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([api.getInvoice(id), api.listDecisions(id)]).then(([inv, dec]) => {
      setInvoice(inv)
      setDecisions(dec)
      setLoading(false)
    }).catch((e: any) => {
      setError(e.detail || 'Error cargando factura')
      setLoading(false)
    })
  }, [id])

  const handleEvaluate = async () => {
    if (!id) return
    try {
      const res = await api.evaluateInvoice(id)
      setInvoice((prev: any) => ({ ...prev, status: res.outcome }))
      setDecisions((prev: any[]) => [res, ...prev])
    } catch (e: any) {
      setError(e.detail || 'Error evaluando factura')
    }
  }

  if (loading) return <div className="center-panel"><Loader2 size={32} /></div>
  if (error) return <div className="center-panel"><div className="alert alert-error">{error}</div></div>
  if (!invoice) return <div className="center-panel">Factura no encontrada</div>

  return (
    <div className="page center-panel">
      <div className="page-header">
        <Link to="/invoices" className="btn btn-sm btn-outline">← Volver</Link>
        <h1>Factura #{invoice.invoice_number || invoice.id}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline btn-sm" onClick={handleEvaluate} disabled={invoice.status !== 'PENDING'}>
            <RefreshCw size={16} /> Evaluar
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/invoices/${id}/edit`)}>
            <Edit2 size={16} /> Editar campos
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Estado</div>
          <span className={`badge ${outcomeClass(invoice.status)}`} style={{ display: 'block', marginTop: '0.25rem' }}>{outcomeLabel(invoice.status)}</span>
        </div>
        <div className="card">
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Importe</div>
          <div style={{ marginTop: '0.25rem', fontSize: '1.1rem', fontWeight: '600' }}>{formatCurrency(invoice.amount, invoice.currency)}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Moneda</div>
          <div style={{ marginTop: '0.25rem' }}>{invoice.currency || '—'}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Emisión</div>
          <div style={{ marginTop: '0.25rem' }}>{formatDate(invoice.issue_date)}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Vencimiento</div>
          <div style={{ marginTop: '0.25rem' }}>{formatDate(invoice.due_date)}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Origen</div>
          <div style={{ marginTop: '0.25rem' }}>{invoice.source_type}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--color-text-muted)' }}>Campos extraídos</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {[
              { label: 'Beneficiario', value: invoice.extracted?.beneficiary_name || invoice.beneficiary_id || '—' },
              { label: 'Nº factura', value: invoice.invoice_number || invoice.extracted?.invoice_number || '—' },
              { label: 'Importe', value: formatCurrency(invoice.extracted?.amount ?? invoice.amount, invoice.currency) },
              { label: 'Moneda', value: invoice.currency || invoice.extracted?.currency || '—' },
              { label: 'Fecha emisión', value: formatDate(invoice.issue_date || invoice.extracted?.issue_date) },
              { label: 'Fecha vencimiento', value: formatDate(invoice.due_date || invoice.extracted?.due_date) },
              { label: 'Concepto', value: invoice.description || invoice.extracted?.description || '—' },
              { label: 'Confianza', value: invoice.extraction_confidence != null ? `${(invoice.extraction_confidence * 100).toFixed(0)}%` : '—' },
            ].map((f) => (
              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{f.label}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{f.value}</span>
              </div>
            ))}
          </div>
          {invoice.raw_text && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Texto de origen</h4>
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.75rem', fontSize: '0.8rem', fontFamily: 'monospace', overflow: 'auto', maxHeight: '200px' }}>{invoice.raw_text}</div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--color-text-muted)' }}>Decisiones</h3>
          {decisions.length === 0 ? (
            <div className="empty-state" style={{ padding: '1rem' }}>Sin decisiones registradas.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {decisions.map((d) => (
                <div key={d.id} className={`decision-box decision-${d.outcome.toLowerCase()}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.3rem' }}>
                    <span className={`badge ${outcomeClass(d.outcome)}`}>{outcomeLabel(d.outcome)}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(d.created_at).toLocaleString('es-CO')}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{d.explanation || 'Sin explicación.'}</div>
                  {d.reason_codes && d.reason_codes.length > 0 && (
                    <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {d.reason_codes.map((c: string) => (
                        <span key={c} className={`chip ${reasonChipClass(c)}`}>{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
