import { Lock } from 'lucide-react'
import { PolicyRuleAction, RuleActionName, RuleCatalogItem } from '../../types'

const actionLabels: Record<RuleActionName, string> = {
  BLOCKED: 'Bloquear',
  NEEDS_HUMAN_APPROVAL: 'Requiere aprobación humana',
}

function isRuleActionName(value: string): value is RuleActionName {
  return value === 'BLOCKED' || value === 'NEEDS_HUMAN_APPROVAL'
}

interface PolicyActionsMatrixProps {
  catalog: RuleCatalogItem[]
  actions: PolicyRuleAction[]
  editable: boolean
  onChange: (code: string, action: RuleActionName) => void
}

export default function PolicyActionsMatrix({ catalog, actions, editable, onChange }: PolicyActionsMatrixProps) {
  const selected = new Map(actions.map(({ code, action }) => [code, action]))
  const grouped = catalog.reduce<Record<string, RuleCatalogItem[]>>((groups, item) => {
    ;(groups[item.rule] ??= []).push(item)
    return groups
  }, {})

  return (
    <section className="card rules-section">
      <div className="rules-section-heading">
        <div><h2>Matriz de decisiones</h2><p>Configura la respuesta para cada motivo de evaluación. Las acciones fijas tienen candado.</p></div>
      </div>
      {Object.entries(grouped).sort(([left], [right]) => left.localeCompare(right)).map(([rule, items]) => (
        <div className="rule-group" key={rule}>
          <h3>{rule}</h3>
          {items.map((item) => {
            const action = selected.get(item.code) ?? item.default_action
            const locked = item.allowed_actions.length === 1
            return (
              <div className="rule-action-row policy-action-row" key={item.code}>
                <div className="policy-action-description">
                  <strong>{item.label}</strong>
                  <p>{item.description}</p>
                  <code>{item.code}</code>
                </div>
                {editable && !locked ? (
                  <label className="policy-action-control" htmlFor={`action-${item.code}`}>
                    <span className="sr-only">Acción para {item.label}</span>
                    <select
                      id={`action-${item.code}`}
                      className="form-control"
                      value={action}
                      onChange={(event) => {
                        if (isRuleActionName(event.target.value)) onChange(item.code, event.target.value)
                      }}
                    >
                      {item.allowed_actions.map((option) => (
                        <option key={option} value={option}>{actionLabels[option]}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="policy-action-state">
                    {locked && <Lock size={15} aria-hidden="true" />}
                    <span>{actionLabels[action]}</span>
                    {locked && <span className="field-hint">Acción fija</span>}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}
