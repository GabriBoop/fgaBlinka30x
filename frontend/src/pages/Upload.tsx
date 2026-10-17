import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { File, Image, AlertTriangle } from 'lucide-react'

export default function Upload() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
      const inv = await api.uploadInvoice(file, companyId)
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
      <div className="page-header">
        <h1>Cargar factura</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '560px' }}>
        <div className="form-group">
          <label>Empresa (company_id)</label>
          <input className="form-control" placeholder="co_demo_001" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required />
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Archivo (PDF o imagen)</label>
          <div className="file-input" onClick={() => inputRef.current?.click()}>
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                <File size={24} style={{ color: '#2563eb' }} />
                <span>{file.name}</span>
              </div>
            ) : (
              <>
                <Image size={32} style={{ color: '#94a3b8' }} />
                <div>Haz clic para seleccionar un archivo</div>
              </>
            )}
            <div className="file-hint">Formatos: {accepted}. Máximo 10 MB.</div>
          </div>
          <input ref={inputRef} type="file" accept={accepted} style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <button type="submit" className="btn btn-primary" disabled={loading || !file || !companyId}>
            {loading ? 'Subiendo...' : 'Subir y extraer'}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>Cancelar</button>
        </div>
      </form>

      <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
        <AlertTriangle size={16} /> Los datos son ficticios. La extracción de PDF con texto usa pypdf; las imágenes requieren Tesseract instalado en el servidor.
      </div>
    </div>
  )
}

const inputRef = { current: null as HTMLInputElement | null }
