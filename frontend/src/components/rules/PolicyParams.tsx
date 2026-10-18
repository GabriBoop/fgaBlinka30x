import { PaymentPolicy } from '../../types'
import { formatCurrency } from '../../lib/utils'

export default function PolicyParams({ policy }: { policy: PaymentPolicy }) {
  const values = [
    ['Moneda base', policy.currency],
    ['Máximo por factura', formatCurrency(policy.max_invoice_amount, policy.currency)],
    ['Umbral de aprobación humana', formatCurrency(policy.approval_threshold, policy.currency)],
    ['Presupuesto del periodo', formatCurrency(policy.period_budget, policy.currency)],
    ['Confianza mínima de extracción', `${(policy.min_extraction_confidence * 100).toFixed(0)}%`],
    ['Similitud mínima de beneficiario', `${(policy.name_similarity_threshold * 100).toFixed(0)}%`],
    ['Tolerancia de importe', `${policy.amount_tolerance_pct}%`],
    ['Ventana de posible duplicado', `${policy.possible_duplicate_date_window_days} día(s)`],
  ]

  return (
    <section className="card rules-section">
      <div className="rules-section-heading"><div><h2>Parámetros de la política</h2><p>Valores usados para evaluar nuevas facturas.</p></div><span className="badge badge-eligible">Activa · v{policy.version}</span></div>
      <div className="rules-params-grid">
        {values.map(([label, value]) => <div key={label} className="rules-param"><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <p className="field-hint">Periodo: {policy.period_type} · Base: fecha de emisión.</p>
    </section>
  )
}
