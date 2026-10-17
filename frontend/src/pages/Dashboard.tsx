import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { formatCurrency } from '../lib/utils'
import { Upload, Loader2, CheckCircle, Clock, ShieldCheck, History, FileText } from 'lucide-react'

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.dashboardSummary()
      .then(setSummary)
      .catch(() => setError('No se pudo cargar el resumen'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="center-panel"><Loader2 size={32} style={{ color: 'var(--color-text-muted)' }} /></div>
  if (error) return <div className="center-panel"><div className="alert alert-error">{error}</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Panel</h1>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-success)' }}>
            <CheckCircle size={24} /> <strong>Presupuesto</strong>
          </div>
          <div className="metric-value" style={{ marginTop: '0.5rem' }}>
            {summary?.budget_consumed != null ? formatCurrency(summary.budget_consumed) : '—'} / {summary?.budget_total != null ? formatCurrency(summary.budget_total) : '—'}
          </div>
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
