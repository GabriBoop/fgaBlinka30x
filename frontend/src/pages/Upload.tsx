import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Beneficiary, Invoice } from '../types'
import { currencyCodes } from '../data/currencyCodes'
import { AlertTriangle, File, FileText, Pencil, Upload as UploadIcon, X } from 'lucide-react'

const currencyNames = new Intl.DisplayNames(['es-CO'], { type: 'currency' })
const currencies = currencyCodes.map((code) => ({
  code,
  label: `${code} — ${currencyNames.of(code) || code}`,
}))

type UploadMode = 'details' | 'file'

export default function Upload() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<UploadMode | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [beneficiaryId, setBeneficiaryId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
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
    if (mode !== 'details') return
    setBeneficiariesLoading(true)
    api.listBeneficiaries()
      .then((items) => {
        setBeneficiaries(items)
        setBeneficiaryId(items[0]?.id ?? '')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los proveedores')
      })
      .finally(() => setBeneficiariesLoading(false))
  }, [mode])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (mode === 'file') {
      if (!file) {
        setError('Selecciona un archivo para continuar.')
        return
      }
    } else if (mode === 'details') {
      const selectedBeneficiary = beneficiaries.find((item) => item.id === beneficiaryId)
      if (!selectedBeneficiary) {
        setError('Selecciona un proveedor de la lista.')
        return
      }
      if (dueDate < issueDate) {
        setError('La fecha de vencimiento no puede ser anterior a la fecha de emisión.')
        return
      }
    } else {
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      let invoice: Invoice
      if (mode === 'file') {
        if (!file) return
        invoice = await api.uploadInvoiceFile(file)
      } else {
        const selectedBeneficiary = beneficiaries.find((item) => item.id === beneficiaryId)!
        const details = {
          beneficiaryId: selectedBeneficiary.id,
          companyId: selectedBeneficiary.company_id,
          invoiceNumber: invoiceNumber.trim() || undefined,
          amount: Number(amount),
          currency,
          issueDate,
          dueDate,
          description: description.trim() || undefined,
        }
        if (file) {
          invoice = await api.uploadInvoice(file, details)
        } else {
          invoice = await api.createInvoice({
            company_id: details.companyId,
            beneficiary_id: details.beneficiaryId,
            invoice_number: details.invoiceNumber ?? null,
            amount: details.amount,
            currency: details.currency,
            issue_date: details.issueDate,
            due_date: details.dueDate,
            description: details.description ?? null,
            source_type: 'manual',
            extracted: {
              beneficiary_name: selectedBeneficiary.name,
              invoice_number: details.invoiceNumber ?? null,
              amount: String(details.amount),
              currency: details.currency,
              issue_date: details.issueDate,
              due_date: details.dueDate,
              description: details.description ?? '',
              _field_sources: {
                beneficiary_name: 'manual',
                invoice_number: 'manual',
                amount: 'manual',
                currency: 'manual',
                issue_date: 'manual',
                due_date: 'manual',
                description: 'manual',
              },
            },
          })
        }
      }
      let evaluationError: string | null = null
      try {
        const evaluation = await api.evaluateInvoice(invoice.id)
        invoice = { ...invoice, status: evaluation.outcome }
      } catch (err: unknown) {
        evaluationError = err instanceof Error ? err.message : 'Error desconocido'
      }
      setError(evaluationError
        ? `La factura se creó, pero no se pudo evaluar: ${evaluationError}`
        : null)
      setSuccess(`Factura ${invoice.invoice_number || invoice.id} creada (estado: ${invoice.status}).`)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      const destination = mode === 'file'
        ? `/invoices/${invoice.id}/edit`
        : `/invoices/${invoice.id}`
      setTimeout(() => navigate(destination), 1500)
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

      {!mode ? (
        <section className="card upload-mode-card" aria-labelledby="upload-title">
          <h1 id="upload-title">Cargar factura</h1>
          <p>Elige cómo quieres registrar la factura.</p>
          <div className="upload-mode-options">
            <button type="button" className="upload-mode-option" onClick={() => setMode('details')}>
              <Pencil size={24} aria-hidden="true" />
              <span className="upload-mode-title">Llenar datos</span>
              <span className="upload-mode-description">Captura los datos de la factura y adjunta un archivo si lo deseas.</span>
            </button>
            <button type="button" className="upload-mode-option" onClick={() => setMode('file')}>
              <UploadIcon size={24} aria-hidden="true" />
              <span className="upload-mode-title">Subir archivo</span>
              <span className="upload-mode-description">Sube el documento para extraer sus datos automáticamente.</span>
            </button>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>Cancelar</button>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="card upload-form">
          <div className="upload-form-heading">
            <div>
              <h1>{mode === 'details' ? 'Llenar datos de la factura' : 'Subir archivo'}</h1>
              <p>{mode === 'details' ? 'Completa los datos; adjuntar el documento es opcional.' : 'Selecciona únicamente el archivo de la factura.'}</p>
            </div>
            <button type="button" className="btn btn-outline" onClick={() => {
              setMode(null)
              setError(null)
            }}>
              Cambiar opción
            </button>
          </div>

          {mode === 'details' && (
            <>
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
                <label htmlFor="invoice-number">Número de factura <span className="field-hint">(opcional)</span></label>
                <input
                  id="invoice-number"
                  className="form-control"
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                />
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
            </>
          )}

          <div className="form-group">
            <label htmlFor="invoice-file">
              {mode === 'details' ? 'Archivo de la factura' : 'Archivo'}
              {mode === 'details' && <span className="field-hint">(opcional)</span>}
            </label>
            <label className="file-input" htmlFor="invoice-file">
              {file ? (
                <div className="upload-selected-file">
                  <File size={24} aria-hidden="true" />
                  <span>{file.name}</span>
                </div>
              ) : (
                <>
                  <FileText size={32} aria-hidden="true" />
                  <div>Haz clic para seleccionar un archivo</div>
                </>
              )}
              <div className="file-hint">PDF o imagen. Máximo 10 MB.</div>
            </label>
            {file && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setFile(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
              >
                <X size={16} aria-hidden="true" /> Quitar archivo
              </button>
            )}
            <input
              id="invoice-file"
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,application/pdf,image/png,image/jpeg,image/tiff,image/bmp"
              className="visually-hidden"
              onChange={handleFileChange}
              required={mode === 'file'}
            />
          </div>

          <div className="upload-form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || (mode === 'details' && (beneficiariesLoading || beneficiaries.length === 0 || !beneficiaryId))}
            >
              {loading ? 'Creando factura...' : mode === 'file' ? 'Subir factura' : 'Crear factura'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="upload-note">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>Los datos son ficticios. Las facturas con campos incompletos requieren revisión.</span>
      </div>
    </div>
  )
}
