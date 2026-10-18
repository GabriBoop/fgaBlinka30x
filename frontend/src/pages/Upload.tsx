import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { Beneficiary } from '../types'
import { File, Image, AlertTriangle } from 'lucide-react'

export default function Upload() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [beneficiaryId, setBeneficiaryId] = useState('')
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const beneficiary = beneficiaries.find((item) => item.id === beneficiaryId)
      if (!beneficiary) {
        setError('Selecciona un proveedor de la lista')
        return
      }
      const inv = await api.uploadInvoice(file, beneficiary.id)
      setSuccess(`Factura ${inv.invoice_number || inv.id} creada (estado: ${inv.status}).`)
      setFile(null)
      setTimeout(() => navigate(`/invoices/${inv.id}`), 1500)
    } catch (err: any) {
      setError(err.detail || 'Error al subir la factura')
    } finally {
      setLoading(false)
    }
  }

  const accepted = '.pdf,.png,.jpg,.jpeg,.tiff,.bmp'

  return (
    <div className="page center-panel">
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '560px' }}>
        <div className="form-group">
          <label htmlFor="beneficiary">Proveedor</label>
          <select
            id="beneficiary"
            className="form-control"
            value={beneficiaryId}
            onChange={(e) => setBeneficiaryId(e.target.value)}
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

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Archivo (PDF o imagen)</label>
          <div className="file-input" onClick={() => inputRef.current?.click()}>
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                <File size={24} style={{ color: 'var(--color-primary)' }} />
                <span>{file.name}</span>
              </div>
            ) : (
              <>
                <Image size={32} style={{ color: 'var(--color-text-muted)' }} />
                <div>Haz clic para seleccionar un archivo</div>
              </>
            )}
            <div className="file-hint">Formatos: {accepted}. Máximo 10 MB.</div>
          </div>
          <input ref={inputRef} type="file" accept={accepted} style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <button type="submit" className="btn btn-primary" disabled={loading || beneficiariesLoading || beneficiaries.length === 0 || !file || !beneficiaryId}>
            {loading ? 'Subiendo...' : 'Subir y extraer'}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>Cancelar</button>
        </div>
      </form>

      <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        <AlertTriangle size={16} /> Los datos son ficticios. La extracción de PDF con texto usa pypdf; las imágenes requieren Tesseract instalado en el servidor.
      </div>
    </div>
  )
}

const inputRef = { current: null as HTMLInputElement | null }
