import { FormEvent, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { PaymentPolicy, PolicyDraft, PolicyMutation, RuleActionName, RuleCatalogItem } from '../../types'
import PolicyActionsMatrix from './PolicyActionsMatrix'
import PolicyChangeSummary from './PolicyChangeSummary'

interface PolicyEditorProps {
  source: PaymentPolicy
  draft: PolicyDraft
  catalog: RuleCatalogItem[]
  canEdit: boolean
  saving: boolean
  error: string | null
  onCancel: () => void
  onSave: (payload: PolicyMutation) => Promise<void>
}

type NumericField =
  | 'max_invoice_amount'
  | 'approval_threshold'
  | 'period_budget'
  | 'amount_tolerance_pct'
  | 'min_extraction_confidence'
  | 'name_similarity_threshold'
  | 'possible_duplicate_date_window_days'

const numberFields: Array<{ name: NumericField; label: string; min: string; max?: string; step: string }> = [
  { name: 'max_invoice_amount', label: 'Máximo por factura', min: '0', step: '0.01' },
  { name: 'approval_threshold', label: 'Umbral de aprobación humana', min: '0', step: '0.01' },
  { name: 'period_budget', label: 'Presupuesto del periodo', min: '0', step: '0.01' },
  { name: 'amount_tolerance_pct', label: 'Tolerancia de importe (%)', min: '0', step: '0.01' },
  { name: 'min_extraction_confidence', label: 'Confianza mínima de extracción', min: '0', max: '1', step: '0.01' },
  { name: 'name_similarity_threshold', label: 'Similitud mínima del beneficiario', min: '0', max: '1', step: '0.01' },
  { name: 'possible_duplicate_date_window_days', label: 'Ventana de posible duplicado (días)', min: '0', step: '1' },
]

function validateDraft(draft: PolicyDraft, catalog: RuleCatalogItem[]): string[] {
  const errors: string[] = []
  const amountFields: Array<[NumericField, string]> = [
    ['max_invoice_amount', 'Máximo por factura'],
    ['approval_threshold', 'Umbral de aprobación humana'],
    ['period_budget', 'Presupuesto del periodo'],
    ['amount_tolerance_pct', 'Tolerancia de importe'],
  ]

  if (!/^[A-Z]{3}$/.test(draft.currency)) errors.push('La moneda debe ser un código ISO de tres letras mayúsculas.')
  for (const [name, label] of amountFields) {
    const value = Number(draft[name])
    if (!draft[name].trim() || !Number.isFinite(value) || value < 0) errors.push(`${label}: ingresa un número mayor o igual que 0.`)
  }
  if (Number(draft.approval_threshold) > Number(draft.max_invoice_amount)) {
    errors.push('El umbral de aprobación no puede superar el máximo por factura.')
  }
  for (const [name, label] of [
    ['min_extraction_confidence', 'Confianza mínima de extracción'],
    ['name_similarity_threshold', 'Similitud mínima del beneficiario'],
  ] as const) {
    const value = Number(draft[name])
    if (!draft[name].trim() || !Number.isFinite(value) || value < 0 || value > 1) errors.push(`${label}: debe estar entre 0 y 1.`)
  }
  const duplicateDays = Number(draft.possible_duplicate_date_window_days)
  if (!draft.possible_duplicate_date_window_days.trim() || !Number.isInteger(duplicateDays) || duplicateDays < 0) errors.push('La ventana de duplicados debe ser un número entero igual o mayor que 0.')
  if (!['monthly', 'quarterly', 'yearly'].includes(draft.period_type)) errors.push('Selecciona un tipo de periodo válido.')
  if (draft.period_basis !== 'issue_date') errors.push('La base del periodo debe ser la fecha de emisión.')
  if (!draft.change_reason.trim()) errors.push('El motivo del cambio es obligatorio.')

  const selected = new Map(draft.rule_actions.map(({ code, action }) => [code, action]))
  for (const item of catalog) {
    const action = selected.get(item.code)
    if (!action) errors.push(`Falta definir una acción para ${item.code}.`)
    else if (!item.allowed_actions.includes(action)) errors.push(`La acción seleccionada para ${item.code} no está permitida.`)
  }
  if (selected.size !== catalog.length) errors.push('La matriz contiene motivos duplicados o desconocidos.')
  return errors
}

function mutationFromDraft(draft: PolicyDraft, companyId: string): PolicyMutation {
  return {
    company_id: companyId,
    version: draft.version,
    currency: draft.currency,
    max_invoice_amount: Number(draft.max_invoice_amount),
    approval_threshold: Number(draft.approval_threshold),
    period_budget: Number(draft.period_budget),
    period_type: draft.period_type,
    period_basis: draft.period_basis,
    amount_tolerance_pct: Number(draft.amount_tolerance_pct),
    min_extraction_confidence: Number(draft.min_extraction_confidence),
    name_similarity_threshold: Number(draft.name_similarity_threshold),
    possible_duplicate_date_window_days: Number(draft.possible_duplicate_date_window_days),
    rule_actions: draft.rule_actions,
    change_reason: draft.change_reason.trim(),
    activate: draft.activate,
  }
}

export default function PolicyEditor({ source, draft: initialDraft, catalog, canEdit, saving, error, onCancel, onSave }: PolicyEditorProps) {
  const [draft, setDraft] = useState(initialDraft)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const disabled = !canEdit || saving
  const updateNumeric = (name: NumericField, value: string) => setDraft((current) => ({ ...current, [name]: value }))
  const updateAction = (code: string, action: RuleActionName) => setDraft((current) => ({
    ...current,
    rule_actions: current.rule_actions.map((item) => item.code === code ? { ...item, action } : item),
  }))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = validateDraft(draft, catalog)
    setValidationErrors(errors)
    if (errors.length || !canEdit) return
    await onSave(mutationFromDraft(draft, source.company_id))
  }

  return (
    <form onSubmit={submit} noValidate>
      {!canEdit && (
        <div className="alert alert-info" role="status">
          <LockKeyhole size={17} aria-hidden="true" />
          <span>Formulario en solo lectura: selecciona un usuario de prueba para editar y guardar políticas.</span>
        </div>
      )}
      <section className="card rules-section">
        <div className="rules-section-heading">
          <div><h2>Borrador de la versión v{draft.version}</h2><p>Los cambios se guardarán como una nueva versión.</p></div>
        </div>
        <fieldset className="policy-fields" disabled={disabled}>
          <legend className="sr-only">Parámetros de la política</legend>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="policy-currency">Moneda base</label>
              <input id="policy-currency" className="form-control" value={draft.currency} maxLength={3} autoComplete="off" onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
            </div>
            {numberFields.map((field) => (
              <div className="form-group" key={field.name}>
                <label htmlFor={`policy-${field.name}`}>{field.label}</label>
                <input
                  id={`policy-${field.name}`}
                  className="form-control"
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={draft[field.name]}
                  onChange={(event) => updateNumeric(field.name, event.target.value)}
                />
              </div>
            ))}
            <div className="form-group">
              <label htmlFor="policy-period-type">Tipo de periodo</label>
              <select id="policy-period-type" className="form-control" value={draft.period_type} onChange={(event) => setDraft((current) => ({ ...current, period_type: event.target.value }))}>
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="policy-period-basis">Base del periodo</label>
              <select id="policy-period-basis" className="form-control" value={draft.period_basis} onChange={(event) => setDraft((current) => ({ ...current, period_basis: event.target.value }))}>
                <option value="issue_date">Fecha de emisión</option>
              </select>
            </div>
          </div>
        </fieldset>
      </section>

      <fieldset disabled={disabled} className="policy-actions-fieldset">
        <legend className="sr-only">Acciones para cada motivo</legend>
        <PolicyActionsMatrix catalog={catalog} actions={draft.rule_actions} editable={canEdit && !saving} onChange={updateAction} />
      </fieldset>

      <PolicyChangeSummary source={source} draft={draft} catalog={catalog} />

      <section className="card rules-section">
        <div className="form-group">
          <label htmlFor="policy-change-reason">Motivo del cambio <span aria-hidden="true">*</span></label>
          <textarea
            id="policy-change-reason"
            className="form-control"
            rows={3}
            maxLength={1000}
            required
            value={draft.change_reason}
            disabled={disabled}
            aria-describedby="policy-reason-hint"
            onChange={(event) => setDraft((current) => ({ ...current, change_reason: event.target.value }))}
          />
          <span id="policy-reason-hint" className="field-hint">Obligatorio. Describe brevemente por qué se crea esta versión.</span>
        </div>
        <label className="policy-activate-option">
          <input
            type="checkbox"
            checked={draft.activate}
            disabled={disabled}
            onChange={(event) => setDraft((current) => ({ ...current, activate: event.target.checked }))}
          />
          <span>Activar de inmediato</span>
        </label>
      </section>

      {validationErrors.length > 0 && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <strong>Revisa estos campos antes de guardar:</strong>
          <ul>{validationErrors.map((message) => <li key={message}>{message}</li>)}</ul>
        </div>
      )}
      {error && <div className="alert alert-error" role="alert" aria-live="assertive">{error}</div>}
      {!canEdit && <p className="field-hint" role="status" aria-live="polite">No se puede guardar hasta seleccionar un usuario de prueba.</p>}

      <div className="policy-editor-actions">
        <button className="btn btn-outline" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button className="btn btn-primary" type="submit" disabled={disabled}>{saving ? 'Guardando…' : 'Guardar nueva versión'}</button>
      </div>
    </form>
  )
}
