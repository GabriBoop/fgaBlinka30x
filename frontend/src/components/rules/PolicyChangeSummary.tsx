import { PaymentPolicy, PolicyDraft, RuleActionName, RuleCatalogItem } from '../../types'

interface PolicyChangeSummaryProps {
  source: PaymentPolicy
  draft: PolicyDraft
  catalog: RuleCatalogItem[]
}

function actionStateLabel(action: RuleActionName | undefined): string {
  if (action === 'BLOCKED') return 'Bloquear'
  if (action === 'NEEDS_HUMAN_APPROVAL') return 'Requiere aprobación humana'
  return 'Sin configurar'
}

export default function PolicyChangeSummary({ source, draft, catalog }: PolicyChangeSummaryProps) {
  const fields: Array<[string, string | number, string | number]> = [
    ['Moneda', source.currency, draft.currency],
    ['Máximo por factura', source.max_invoice_amount, draft.max_invoice_amount],
    ['Umbral de aprobación humana', source.approval_threshold, draft.approval_threshold],
    ['Presupuesto del periodo', source.period_budget, draft.period_budget],
    ['Tipo de periodo', source.period_type, draft.period_type],
    ['Base del periodo', source.period_basis, draft.period_basis],
    ['Tolerancia de importe (%)', source.amount_tolerance_pct, draft.amount_tolerance_pct],
    ['Confianza mínima de extracción', source.min_extraction_confidence, draft.min_extraction_confidence],
    ['Similitud mínima del beneficiario', source.name_similarity_threshold, draft.name_similarity_threshold],
    ['Ventana de posible duplicado (días)', source.possible_duplicate_date_window_days, draft.possible_duplicate_date_window_days],
  ]
  const sourceActions = new Map(source.rule_actions.map(({ code, action }) => [code, action]))
  const draftActions = new Map(draft.rule_actions.map(({ code, action }) => [code, action]))
  const actionLabels = new Map(catalog.map(({ code, label }) => [code, label]))
  const actionChanges = catalog
    .filter(({ code }) => sourceActions.get(code) !== draftActions.get(code))
    .map(({ code }) => [
      `Acción: ${actionLabels.get(code) ?? code} (${code})`,
      actionStateLabel(sourceActions.get(code)),
      actionStateLabel(draftActions.get(code)),
    ] as [string, string, string])
  const changes = [
    ...fields.filter(([, before, after]) => String(before) !== String(after)),
    ...actionChanges,
  ]

  return (
    <section className="card rules-section" aria-labelledby="policy-change-heading">
      <div className="rules-section-heading">
        <div>
          <h2 id="policy-change-heading">Resumen de cambios</h2>
          <p>Versión v{source.version} → v{draft.version}</p>
        </div>
      </div>
      {changes.length === 0 ? (
        <p role="status">No hay diferencias frente a la versión v{source.version}.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Campo</th><th>v{source.version}</th><th>v{draft.version}</th></tr></thead>
            <tbody>{changes.map(([name, before, after]) => (
              <tr key={name}><th scope="row">{name}</th><td>{before}</td><td>{after}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}
