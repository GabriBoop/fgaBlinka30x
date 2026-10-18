import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Beneficiary } from '../types'
import { currencyCodes } from '../data/currencyCodes'
import { AlertTriangle, File, X } from 'lucide-react'

const currencyNames = new Intl.DisplayNames(['es-CO'], { type: 'currency' })
const currencies = currencyCodes.map((code) => ({
  code,
  label: `${code} — ${currencyNames.of(code) || code}`,
}))

export default function Upload() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [beneficiaryId, setBeneficiaryId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [issueDate, setIssueDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    api.listBeneficiaries()
      .then((items) => {
        setBeneficiaries(items)
        setBeneficiaryId(items[0]?.id ?? '')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los proveedores')
      })
      .finally(() => setBeneficiariesLoading(false))
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const selectedBeneficiary = beneficiaries.find((item) => item.id === beneficiaryId)
    if (!selectedBeneficiary) {
      setError('Selecciona un proveedor de la lista.')
      return
    }
    if (dueDate < issueDate) {
      setError('La fecha de vencimiento no puede ser anterior a la fecha de emisión.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const invoice = await api.uploadInvoice(file, {
        beneficiaryId: selectedBeneficiary.id,
        companyId: selectedBeneficiary.company_id,
        amount: Number(amount),
        currency,
        issueDate,
        dueDate,
        description: description.trim() || undefined,
      })
      setSuccess(`Factura ${invoice.invoice_number || invoice.id} creada (estado: ${invoice.status}).`)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      setTimeout(() => navigate(`/invoices/${invoice.id}`), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la factura.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page center-panel">
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '560px' }}>
        <div className="form-group">
          <label htmlFor="beneficiary">Proveedor</label>
          <select
            id="beneficiary"
            className="form-control"
            value={beneficiaryId}
            onChange={(event) => setBeneficiaryId(event.target.value)}
            disabled={beneficiariesLoading || beneficiaries.length === 0}
            required
          >
            {beneficiariesLoading ? (
              <option value="">Cargando proveedores...</option>
            ) : beneficiaries.length === 0 ? (
              <option value="">No hay proveedores disponibles</option>
            ) : (
              beneficiaries.map((beneficiary) => (
                <option key={beneficiary.id} value={beneficiary.id}>
                  {beneficiary.name}
                  {beneficiary.category ? ` · ${beneficiary.category}` : ''}
                  {beneficiary.reference_code ? ` · ${beneficiary.reference_code}` : ''}
                  {beneficiary.allowed ? ' · Permitido' : ' · No permitido'}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="amount">Importe total</label>
          <input
            id="amount"
            className="form-control"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="currency">Moneda</label>
          <select
            id="currency"
            className="form-control"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            required
          >
            {currencies.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="issue-date">Fecha de emisión</label>
            <input
              id="issue-date"
              className="form-control"
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="due-date">Fecha de vencimiento</label>
            <input
              id="due-date"
              className="form-control"
              type="date"
              min={issueDate || undefined}
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Descripción <span className="field-hint">(opcional)</span></label>
          <textarea
            id="description"
            className="form-control"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="invoice-file">PDF <span className="field-hint">(opcional)</span></label>
          <div className="file-input" onClick={() => inputRef.current?.click()}>
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                <File size={24} style={{ color: 'var(--color-primary)' }} />
                <span>{file.name}</span>
                <button
                  type="button"
                  className="btn btn-icon btn-outline"
                  aria-label="Quitar archivo"
                  onClick={(event) => {
                    event.stopPropagation()
                    setFile(null)
                    if (inputRef.current) inputRef.current.value = ''
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <File size={32} style={{ color: 'var(--color-text-muted)' }} />
                <div>Haz clic para adjuntar un PDF</div>
              </>
            )}
            <div className="file-hint">Formato PDF. Máximo 10 MB.</div>
          </div>
          <input
            id="invoice-file"
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || beneficiariesLoading || beneficiaries.length === 0 || !beneficiaryId}
          >
            {loading ? 'Creando factura...' : 'Crear factura'}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>Cancelar</button>
        </div>
      </form>

      <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        <AlertTriangle size={16} /> El número de factura se genera automáticamente. Los datos son ficticios.
      </div>
    </div>
  )
}
