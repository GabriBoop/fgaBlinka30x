import { Lock, ShieldAlert, UserRoundCheck } from 'lucide-react'
import { PolicyRuleAction, RuleCatalogItem } from '../../types'

const actionInfo: Record<string, { label: string; icon: typeof ShieldAlert; className: string }> = {
  BLOCKED: { label: 'Frenar', icon: ShieldAlert, className: 'chip-blocked' },
  NEEDS_HUMAN_APPROVAL: { label: 'Aprobación humana', icon: UserRoundCheck, className: 'chip-approval' },
}

export default function RuleActionsTable({ catalog, actions }: { catalog: RuleCatalogItem[]; actions: PolicyRuleAction[] }) {
  const selected = new Map(actions.map((item) => [item.code, item.action]))
  const grouped = catalog.reduce<Record<string, RuleCatalogItem[]>>((groups, item) => {
    ;(groups[item.rule] ??= []).push(item)
    return groups
  }, {})

  return (
    <section className="card rules-section">
      <div className="rules-section-heading"><div><h2>Matriz de decisiones</h2><p>Qué ocurre cuando se detecta cada motivo.</p></div></div>
      {Object.entries(grouped).map(([rule, items]) => (
        <div className="rule-group" key={rule}>
          <h3>{rule}</h3>
          {items.map((item) => {
            const action = actionInfo[selected.get(item.code) ?? item.default_action] ?? actionInfo.NEEDS_HUMAN_APPROVAL
            const ActionIcon = action.icon
            return <div className="rule-action-row" key={item.code}>
              <div><strong>{item.label}</strong><p>{item.description}</p><code>{item.code}</code></div>
              <div className={`chip ${action.className}`}><ActionIcon size={15} />{action.label}{item.allowed_actions.length === 1 && <Lock size={13} aria-label="Acción fija" />}</div>
            </div>
          })}
        </div>
      ))}
    </section>
  )
}
