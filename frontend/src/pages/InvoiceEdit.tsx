import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, FileText, Loader2, Save, ShieldCheck, Sparkles, X } from 'lucide-react'
import { api } from '../services/api'
import { formatCurrency, outcomeClass, outcomeLabel } from '../lib/utils'
import { isStandardInvoiceNumber, nextInvoiceNumber } from '../lib/invoiceNumbering'
import { currencyCodes } from '../data/currencyCodes'
import type { Beneficiary, Invoice } from '../types'

type FormValues = {
  invoice_number: string
  beneficiary_id: string
  amount: string
  currency: string
  issue_date: string
  due_date: string
  description: string
}

type SuggestedValues = Partial<Record<keyof FormValues, string>>

const currencyNames = new Intl.DisplayNames(['es-CO'], { type: 'currency' })
const CURRENCIES = currencyCodes.map((code) => ({ code, label: `${code} — ${currencyNames.of(code) || code}` }))

const emptyValues: FormValues = {
  invoice_number: '', beneficiary_id: '', amount: '', currency: '', issue_date: '', due_date: '', description: '',
}

function findPattern(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim().replace(/[\s,;:.]+$/, '')
  }
  return ''
}

function parseDate(value: string): string {
  const trimmed = value.trim()
  let match = trimmed.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  match = trimmed.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b/)
  if (match) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
  return ''
}

function parseAmount(value: string): string {
  const cleaned = value.replace(/[^\d,.-]/g, '')
  if (!cleaned) return ''
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized = cleaned
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIsComma = lastComma > lastDot
    normalized = decimalIsComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '')
  } else if (lastComma >= 0) {
    const decimals = cleaned.length - lastComma - 1
    normalized = decimals > 0 && decimals <= 2 ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '')
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    const decimalAt = cleaned.lastIndexOf('.')
    normalized = cleaned.slice(0, decimalAt).replace(/\./g, '') + cleaned.slice(decimalAt)
  }
  return Number.isFinite(Number(normalized)) ? String(Number(normalized)) : ''
}

function inferFields(text: string): SuggestedValues {
  if (!text.trim()) return {}
  const invoiceNumber = findPattern(text, [
    /(?:factura|invoice|n[úu]mero\s*(?:de\s*)?factura|invoice\s*(?:no|number|#))\s*(?:n[°º.]?\s*)?[:#-]?\s*([A-Z0-9][A-Z0-9/-]{2,})/i,
    /\b((?:F|FAC|INV)[- ]?\d{3,})\b/i,
  ])
  const issueDate = findPattern(text, [/(?:fecha\s*(?:de\s*)?emisi[oó]n|fecha\s*factura|issue\s*date|invoice\s*date)\s*[:#-]?\s*([^\n\r]+)/i])
  const dueDate = findPattern(text, [/(?:fecha\s*(?:de\s*)?vencimiento|vencimiento|due\s*date|payment\s*due)\s*[:#-]?\s*([^\n\r]+)/i])
  const amount = findPattern(text, [
    /(?:total\s*(?:a\s*pagar|factura|due)?|importe\s*total|monto\s*total|grand\s*total|amount\s*due)\s*[:\s]*((?:COP|USD|EUR|MXN|ARS|CLP|\$|€|£)\s*[\d.,]+|[\d.,]+\s*(?:COP|USD|EUR|MXN|ARS|CLP))/i,
  ])
  const currency = findPattern(text, [/(?:COP|USD|EUR|MXN|ARS|CLP|\$|€|£)/i]).toUpperCase()
  const beneficiary = findPattern(text, [
    /(?:proveedor|nombre\s*(?:del\s*)?proveedor|emisor|supplier|vendor|from)\s*[:#-]?\s*([^\n\r]+)/i,
  ])
  const description = findPattern(text, [/(?:concepto|descripci[oó]n|detalle|servicio|description|item)\s*[:#-]?\s*([^\n\r]+)/i])
  const result: SuggestedValues = {}
  if (invoiceNumber) result.invoice_number = invoiceNumber
  if (issueDate) result.issue_date = parseDate(issueDate)
  if (dueDate) result.due_date = parseDate(dueDate)
  if (amount) result.amount = parseAmount(amount)
  if (currency) result.currency = currency === '$' ? 'USD' : currency === '€' ? 'EUR' : currency === '£' ? 'GBP' : currency
  if (beneficiary) result.beneficiary_id = beneficiary
  if (description) result.description = description
  return result
}

function initialValues(invoice: Invoice, beneficiaries: Beneficiary[]) {
  const guessed = inferFields(invoice.raw_text || '')
  const extracted = invoice.extracted && typeof invoice.extracted === 'object' ? invoice.extracted as Record<string, unknown> : {}
  const textValue = (key: string) => typeof extracted[key] === 'string' || typeof extracted[key] === 'number' ? String(extracted[key]) : ''
  const supplierName = guessed.beneficiary_id || textValue('beneficiary_name') || textValue('supplier')
  const normalizedSupplier = supplierName.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const matchedBeneficiary = beneficiaries.find((item) => {
    const name = `${item.name} ${item.normalized_name}`.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return normalizedSupplier && (name.includes(normalizedSupplier) || normalizedSupplier.includes(item.name.toLocaleLowerCase()))
  })
  const val = (key: keyof FormValues, actual: unknown, extractedValue?: string) => {
    if (actual !== null && actual !== undefined && String(actual) !== '') return String(actual)
    return extractedValue || guessed[key] || ''
  }
  const values: FormValues = {
    invoice_number: val('invoice_number', invoice.invoice_number, textValue('invoice_number')),
    beneficiary_id: invoice.beneficiary_id || matchedBeneficiary?.id || '',
    amount: val('amount', invoice.amount, textValue('amount')),
    currency: val('currency', invoice.currency, textValue('currency')).toUpperCase(),
    issue_date: val('issue_date', invoice.issue_date, textValue('issue_date')),
    due_date: val('due_date', invoice.due_date, textValue('due_date')),
    description: val('description', invoice.description, textValue('description')),
  }
  const suggested: SuggestedValues = {}
  if (supplierName && !matchedBeneficiary && !invoice.beneficiary_id) suggested.beneficiary_id = supplierName
  ;(Object.keys(values) as (keyof FormValues)[]).forEach((key) => {
    if (!invoice[key as keyof Invoice] && values[key]) suggested[key] = values[key]
  })
  return { values, suggested }
}

export default function InvoiceEdit() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [companyInvoices, setCompanyInvoices] = useState<Invoice[]>([])
  const [values, setValues] = useState<FormValues>(emptyValues)
  const [suggested, setSuggested] = useState<SuggestedValues>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [autoNumber, setAutoNumber] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    Promise.all([api.getInvoice(id), api.listBeneficiaries(), api.listInvoices()])
      .then(([loadedInvoice, loadedBeneficiaries, allInvoices]) => {
        const initial = initialValues(loadedInvoice, loadedBeneficiaries)
        const existingNumberIsStandard = isStandardInvoiceNumber(initial.values.invoice_number)
        const shouldAutoNumber = !initial.values.invoice_number || existingNumberIsStandard
        const sameCompanyInvoices = allInvoices.filter((item) => item.company_id === loadedInvoice.company_id)
        if (shouldAutoNumber && !existingNumberIsStandard) {
          initial.values.invoice_number = nextInvoiceNumber(sameCompanyInvoices, loadedInvoice.id)
        }
        setInvoice(loadedInvoice)
        setBeneficiaries(loadedBeneficiaries)
        setCompanyInvoices(sameCompanyInvoices)
        setValues(initial.values)
        setSuggested(initial.suggested)
        setAutoNumber(shouldAutoNumber)
      })
      .catch((e: Error) => setError(e.message || 'No se pudo cargar la factura.'))
      .finally(() => setLoading(false))
  }, [id])

  const beneficiaryOptions = useMemo(() => beneficiaries.filter((item) => !invoice || item.company_id === invoice.company_id), [beneficiaries, invoice])
  const update = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (suggested[field]) setSuggested((current) => ({ ...current, [field]: undefined }))
    if (field === 'invoice_number') setAutoNumber(false)
  }

  const selectBeneficiary = (beneficiaryId: string) => {
    setValues((current) => ({ ...current, beneficiary_id: beneficiaryId }))
    if (suggested.beneficiary_id) setSuggested((current) => ({ ...current, beneficiary_id: undefined }))
  }

  const standardizeInvoiceNumber = () => {
    const currentNumber = invoice?.invoice_number
    const generatedNumber = isStandardInvoiceNumber(currentNumber)
      ? currentNumber?.toUpperCase() ?? ''
      : nextInvoiceNumber(companyInvoices, id)
    if (!generatedNumber) {
      setError('Se agotó la secuencia de facturas al llegar a Z999.')
      return
    }
    setError('')
    setValues((current) => ({ ...current, invoice_number: generatedNumber }))
    setAutoNumber(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const amount = values.amount.trim() ? Number(values.amount) : null
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      setError('El importe debe ser un número válido mayor o igual a cero.')
      return
    }
    if (values.issue_date && values.due_date && values.due_date < values.issue_date) {
      setError('La fecha de vencimiento no puede ser anterior a la fecha de emisión.')
      return
    }
    setSaving(true)
    try {
      const saved = await api.updateInvoice(id, {
        invoice_number: values.invoice_number.trim() || null,
        beneficiary_id: values.beneficiary_id || null,
        amount,
        currency: values.currency.trim().toUpperCase() || null,
        issue_date: values.issue_date || null,
        due_date: values.due_date || null,
        description: values.description.trim() || null,
        standardize_number: autoNumber,
      })
      setInvoice(saved)
      setValues((current) => ({ ...current, invoice_number: saved.invoice_number || '' }))
      setAutoNumber(isStandardInvoiceNumber(saved.invoice_number))
      setNotice('Los cambios de la factura se guardaron correctamente.')
    } catch (e: any) {
      setError(e.detail || e.message || 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  const review = async (action: 'approve' | 'reject') => {
    const reason = window.prompt(`Escribe la justificación para ${action === 'approve' ? 'aprobar' : 'rechazar'} esta factura:`)?.trim()
    if (!reason) return
    setReviewing(true)
    setError('')
    try {
      const result = await api.reviewInvoice(id, action, reason)
      setInvoice((current) => current ? { ...current, status: result.status } : current)
      setNotice(action === 'approve' ? 'Factura aprobada y decisión registrada.' : 'Factura rechazada y decisión registrada.')
    } catch (e: any) {
      setError(e.detail || e.message || 'No se pudo registrar la aprobación.')
    } finally {
      setReviewing(false)
    }
  }

  if (loading) return <div className="center-panel"><Loader2 size={32} className="spin" /></div>
  if (!invoice) return <div className="page"><div className="alert alert-error">{error || 'No se encontró la factura.'}</div><Link className="btn btn-outline" to="/invoices">Volver a facturas</Link></div>

  const rawText = invoice.raw_text || ''
  return (
    <div className="page">
      <div className="page-header" style={{ alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <Link to={`/invoices/${id}`} className="btn btn-sm btn-outline" style={{ marginBottom: '0.75rem' }}><ArrowLeft size={15} /> Volver al detalle</Link>
          <h1>Editar factura {invoice.invoice_number || `#${invoice.id}`}</h1>
          <div className="subtitle">Revisa los datos detectados en el documento y completa los campos pendientes.</div>
        </div>
        <span className={`badge ${outcomeClass(invoice.status)}`}>{outcomeLabel(invoice.status)}</span>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      {Object.keys(suggested).length > 0 && <div className="alert alert-info" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
        <Sparkles size={18} /><span>Prellené {Object.keys(suggested).length} campo(s) con patrones del texto extraído. Revísalos antes de guardar; la lectura automática puede contener errores.</span>
      </div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)', gap: '1rem', alignItems: 'start' }}>
        <form className="card" onSubmit={save}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Datos de la factura</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="invoice_number">Número de factura</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input id="invoice_number" className="form-control" value={values.invoice_number} onChange={(e) => update('invoice_number', e.target.value)} />
                <button type="button" className="btn btn-outline" onClick={standardizeInvoiceNumber}>Estandarizar</button>
              </div>
              {autoNumber && <small className="field-hint">Código interno sugerido: {values.invoice_number} · Secuencia global A000–Z999. Se confirmará al guardar.</small>}
            </div>
            <div className="form-group"><label htmlFor="beneficiary_id">Proveedor / beneficiario</label><select id="beneficiary_id" className="form-control" value={values.beneficiary_id} onChange={(e) => selectBeneficiary(e.target.value)}><option value="">Selecciona un beneficiario</option>{beneficiaryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.category ? ` · ${item.category}` : ''}</option>)}</select>{suggested.beneficiary_id && <small className="field-hint">Texto detectado: “{suggested.beneficiary_id}”. Elige el beneficiario correspondiente.</small>}</div>
          </div>
          <div className="form-row">
            <div className="form-group"><label htmlFor="amount">Importe total</label><input id="amount" type="number" min="0" step="0.01" className="form-control" value={values.amount} onChange={(e) => update('amount', e.target.value)} /></div>
            <div className="form-group"><label htmlFor="currency">Moneda</label><select id="currency" className="form-control" value={values.currency} onChange={(e) => update('currency', e.target.value)}><option value="">Selecciona una moneda</option>{values.currency && !CURRENCIES.some((currency) => currency.code === values.currency) && <option value={values.currency}>{values.currency}</option>}{CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label htmlFor="issue_date">Fecha de emisión</label><input id="issue_date" type="date" className="form-control" value={values.issue_date} onChange={(e) => update('issue_date', e.target.value)} /></div>
            <div className="form-group"><label htmlFor="due_date">Fecha de vencimiento</label><input id="due_date" type="date" className="form-control" value={values.due_date} onChange={(e) => update('due_date', e.target.value)} /></div>
          </div>
          <div className="form-group"><label htmlFor="description">Concepto / descripción</label><textarea id="description" className="form-control" rows={3} value={values.description} onChange={(e) => update('description', e.target.value)} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => navigate(`/invoices/${id}`)}><X size={16} /> Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </form>

        <aside style={{ display: 'grid', gap: '1rem' }}>
          <div className="card">
            <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><FileText size={18} /> Documento de origen</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{invoice.file_name || 'Sin archivo adjunto'}{invoice.extraction_confidence != null ? ` · Confianza OCR ${(invoice.extraction_confidence * 100).toFixed(0)}%` : ''}</p>
            {rawText ? <details style={{ marginTop: '0.9rem' }}><summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Ver texto reconocido</summary><pre style={{ marginTop: '0.6rem', maxHeight: '300px', overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{rawText}</pre></details> : <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>No hay texto OCR disponible para sugerir campos.</p>}
          </div>
          {invoice.status === 'NEEDS_HUMAN_APPROVAL' && <div className="card">
            <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><ShieldCheck size={18} /> Aprobación humana</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.9rem' }}>Guarda primero cualquier corrección. La aprobación requiere una justificación.</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-success btn-sm" disabled={reviewing || saving} onClick={() => review('approve')}><Check size={15} /> Aprobar</button>
              <button className="btn btn-danger btn-sm" disabled={reviewing || saving} onClick={() => review('reject')}><X size={15} /> Rechazar</button>
            </div>
          </div>}
          <div className="card" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-text)' }}>Vista previa del importe</strong>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.35rem', color: 'var(--color-text)' }}>{formatCurrency(values.amount ? Number(values.amount) : null, values.currency || 'COP')}</div>
          </div>
        </aside>
      </div>
    </div>
  )
}
