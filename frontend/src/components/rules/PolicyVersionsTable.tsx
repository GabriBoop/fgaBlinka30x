import { PaymentPolicy } from '../../types'
import { Copy, Power } from 'lucide-react'

interface PolicyVersionsTableProps {
  policies: PaymentPolicy[]
  canEdit: boolean
  busy: boolean
  onActivate: (policy: PaymentPolicy) => void
  onDuplicate: (policy: PaymentPolicy) => void
}

export default function PolicyVersionsTable({ policies, canEdit, busy, onActivate, onDuplicate }: PolicyVersionsTableProps) {
  return (
    <section className="card rules-section">
      <div className="rules-section-heading"><div><h2>Historial de versiones</h2><p>Las decisiones anteriores conservan la versión con la que fueron evaluadas.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Versión</th><th>Estado</th><th>Creada</th><th>Presupuesto</th><th>Acciones</th></tr></thead><tbody>
        {policies.map((policy) => <tr key={policy.id}>
          <td>v{policy.version}</td>
          <td><span className={`policy-version-state ${policy.active ? 'is-active' : ''}`}>{policy.active ? 'Activa' : 'Histórica (inactiva)'}</span></td>
          <td>{policy.created_at ? new Date(policy.created_at).toLocaleDateString('es-CO') : '—'}</td>
          <td>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: policy.currency }).format(policy.period_budget)}</td>
          <td>
            <div className="policy-version-actions">
              {policy.active
                ? <span aria-label={`La versión ${policy.version} ya está activa`}>Actual</span>
                : <button className="btn btn-outline btn-sm" type="button" disabled={!canEdit || busy} onClick={() => onActivate(policy)}><Power size={15} /> Activar</button>}
              <button className="btn btn-outline btn-sm" type="button" disabled={busy} onClick={() => onDuplicate(policy)}><Copy size={15} /> Duplicar como nueva</button>
            </div>
          </td>
        </tr>)}
      </tbody></table></div>
      {!canEdit && <p className="field-hint">Selecciona un usuario de prueba para activar versiones.</p>}
    </section>
  )
}
