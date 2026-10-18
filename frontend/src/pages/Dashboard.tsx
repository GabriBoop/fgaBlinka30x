import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { formatCurrency } from '../lib/utils'
import { Upload, Loader2, CheckCircle, Clock, Pencil, X } from 'lucide-react'
import type { Beneficiary, Invoice } from '../types'

type ImportantDateRange = '7' | '15' | '30' | 'all'
type ImportantDateField = 'creation' | 'due'

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetValue, setBudgetValue] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const [importantInvoices, setImportantInvoices] = useState<Invoice[]>([])
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [importantDatesError, setImportantDatesError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<ImportantDateRange>('15')
  const [dateField, setDateField] = useState<ImportantDateField>('creation')

  useEffect(() => {
    api.dashboardSummary()
      .then(setSummary)
      .catch(() => setError('No se pudo cargar el resumen'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    Promise.all([
      api.listInvoices({ status: 'APPROVED' }),
      api.listInvoices({ status: 'HUMAN_APPROVED' }),
      api.listBeneficiaries(),
    ])
      .then(([approvedInvoices, humanApprovedInvoices, loadedBeneficiaries]) => {
        setImportantInvoices([...approvedInvoices, ...humanApprovedInvoices])
        setBeneficiaries(loadedBeneficiaries)
      })
      .catch(() => setImportantDatesError('No se pudieron cargar las fechas importantes.'))
  }, [])

  const startBudgetEdit = () => {
    setBudgetValue(String(summary?.budget_total ?? 0))
    setBudgetError(null)
    setEditingBudget(true)
  }

  const saveBudget = async (event: React.FormEvent) => {
    event.preventDefault()
    const periodBudget = Number(budgetValue)
    if (!Number.isFinite(periodBudget) || periodBudget < 0) {
      setBudgetError('Ingresa un presupuesto válido (igual o mayor que 0).')
      return
    }
    setSavingBudget(true)
    setBudgetError(null)
    try {
      const policy = await api.updateBudget({ period_budget: periodBudget })
      setSummary((current: any) => ({ ...current, budget_total: policy.period_budget }))
      setEditingBudget(false)
    } catch (err: any) {
      setBudgetError(err.detail || err.message || 'No se pudo actualizar el presupuesto.')
    } finally {
      setSavingBudget(false)
    }
  }

  if (loading) return <div className="center-panel"><Loader2 size={32} style={{ color: 'var(--color-text-muted)' }} /></div>
  if (error) return <div className="center-panel"><div className="alert alert-error">{error}</div></div>

  const budgetExceeded = (summary?.budget_consumed ?? 0) > (summary?.budget_total ?? 0)
  const beneficiaryNames = new Map(beneficiaries.map((beneficiary) => [beneficiary.id, beneficiary.name]))
  const cutoff = dateRange === 'all' ? null : getLocalDateKey(getDaysAgo(Number(dateRange) - 1))
  const visibleInvoices = importantInvoices
    .filter((invoice) => {
      const invoiceDate = dateField === 'creation'
        ? invoice.created_at ? getLocalDateKey(new Date(invoice.created_at)) : null
        : invoice.due_date?.slice(0, 10) ?? null
      return invoiceDate !== null && (cutoff === null || invoiceDate >= cutoff)
    })
    .sort((a, b) => {
      const dateA = dateField === 'creation' ? a.created_at : a.due_date
      const dateB = dateField === 'creation' ? b.created_at : b.due_date
      return (dateB ?? '').localeCompare(dateA ?? '')
    })

  return (
    <div className="page">
      <div className="page-actions">
        <Link to="/upload" className="btn btn-primary">
          <Upload size={18} /> Cargar factura
        </Link>
      </div>

      <div className="metric-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem' }}>
        <div>
          <div className="metric-label">Facturas totales</div>
          <div className="metric-value">{summary?.total ?? 0}</div>
        </div>
        <div>
          <div className="metric-label">Aptas para pago simulado</div>
          <div className="metric-value" style={{ color: 'var(--color-success)' }}>{summary?.ELIGIBLE_SIMULATED ?? 0}</div>
        </div>
        <div>
          <div className="metric-label">Frenadas</div>
          <div className="metric-value" style={{ color: 'var(--color-danger)' }}>{summary?.BLOCKED ?? 0}</div>
        </div>
        <div>
          <div className="metric-label">Requieren aprobación</div>
          <div className="metric-value" style={{ color: 'var(--color-warning)' }}>{summary?.NEEDS_HUMAN_APPROVAL ?? 0}</div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', color: 'var(--color-success)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle size={24} /> <strong>Presupuesto</strong>
            </div>
            {!editingBudget && <button className="btn btn-sm btn-outline" onClick={startBudgetEdit}><Pencil size={15} /> Editar</button>}
          </div>
          <div className={budgetExceeded ? 'metric-value budget-amount-exceeded' : 'metric-value'} style={{ marginTop: '0.5rem', display: editingBudget ? 'none' : undefined }}>
            {summary?.budget_consumed != null ? formatCurrency(summary.budget_consumed) : '—'} / {summary?.budget_total != null ? formatCurrency(summary.budget_total) : '—'}
          </div>
          {editingBudget && (
            <form onSubmit={saveBudget} style={{ marginTop: '0.75rem' }}>
              <label className="metric-label" htmlFor="budget">Presupuesto en USD</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                <input id="budget" className="form-control" type="number" min="0" step="0.01" value={budgetValue} onChange={(e) => setBudgetValue(e.target.value)} autoFocus disabled={savingBudget} />
                <button className="btn btn-primary" type="submit" disabled={savingBudget}>{savingBudget ? 'Guardando...' : 'Guardar'}</button>
                <button className="btn btn-outline btn-icon" type="button" aria-label="Cancelar edición" onClick={() => setEditingBudget(false)} disabled={savingBudget}><X size={18} /></button>
              </div>
              {budgetError && <div className="field-hint" style={{ color: 'var(--color-danger)' }}>{budgetError}</div>}
            </form>
          )}
          {budgetExceeded && <div className="budget-exceeded-alert">Tu presupuesto ha sido sobrepasado!!!</div>}
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-muted)' }}>
            <Clock size={24} /> <strong>Última actualización</strong>
          </div>
          <div className="metric-value" style={{ marginTop: '0.5rem' }}>{new Date().toLocaleTimeString('es-CO')}</div>
        </div>
      </div>

      <section className="card important-dates" aria-labelledby="important-dates-title">
        <div className="important-dates-heading">
          <h2 id="important-dates-title">Fechas importantes</h2>
          <div className="important-dates-filters">
            <label>
              <span>Días</span>
              <select className="form-control" value={dateRange} onChange={(event) => setDateRange(event.target.value as ImportantDateRange)}>
                <option value="7">Últimos 7 días</option>
                <option value="15">Últimos 15 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="all">Desde siempre</option>
              </select>
            </label>
            <label>
              <span>Fecha</span>
              <select className="form-control" value={dateField} onChange={(event) => setDateField(event.target.value as ImportantDateField)}>
                <option value="creation">Creación</option>
                <option value="due">Vencimiento</option>
              </select>
            </label>
          </div>
        </div>
        {importantDatesError ? (
          <div className="alert alert-error" role="alert">{importantDatesError}</div>
        ) : visibleInvoices.length === 0 ? (
          <div className="empty-state">No hay facturas aprobadas para el periodo y la fecha seleccionados.</div>
        ) : (
          <ul className="important-dates-list">
            {visibleInvoices.map((invoice) => {
              const date = dateField === 'creation' ? invoice.created_at : invoice.due_date
              return (
                <li key={invoice.id}>
                  <Link to={`/invoices/${invoice.id}`} className="important-invoice">
                    <span className="important-invoice-main">
                      <strong>{invoice.invoice_number || invoice.id}</strong>
                      <span className="important-invoice-meta">
                        {beneficiaryNames.get(invoice.beneficiary_id ?? '') ?? 'Proveedor no especificado'}
                        {' · '}
                        {formatCurrency(invoice.amount, invoice.currency ?? 'USD')}
                      </span>
                    </span>
                    <time
                      className={`important-invoice-date important-invoice-date-${dateField}`}
                      dateTime={date ?? undefined}
                    >
                      {formatImportantDate(date)}
                    </time>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

    </div>
  )
}

function getDaysAgo(days: number): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatImportantDate(value: string | null): string {
  if (!value) return '—'
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
