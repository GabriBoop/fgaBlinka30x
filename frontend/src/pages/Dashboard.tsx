import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { formatCurrency } from '../lib/utils'
import { Upload, Loader2, CheckCircle, Clock, ShieldCheck, History, FileText, Pencil, X } from 'lucide-react'

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetValue, setBudgetValue] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.dashboardSummary()
      .then(setSummary)
      .catch(() => setError('No se pudo cargar el resumen'))
      .finally(() => setLoading(false))
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
          <div className="metric-value" style={{ marginTop: '0.5rem', display: editingBudget ? 'none' : undefined }}>
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
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-muted)' }}>
            <Clock size={24} /> <strong>Última actualización</strong>
          </div>
          <div className="metric-value" style={{ marginTop: '0.5rem' }}>{new Date().toLocaleTimeString('es-CO')}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--color-text-muted)' }}>Acciones rápidas</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={() => navigate('/invoices')}>
            <FileText size={18} /> Ver facturas
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/approvals')}>
            <ShieldCheck size={18} /> Centro de aprobaciones
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/history')}>
            <History size={18} /> Historial de decisiones
          </button>
        </div>
      </div>
    </div>
  )
}
