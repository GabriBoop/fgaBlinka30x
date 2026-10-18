import { Invoice, InvoiceCreate, InvoiceUpdate, Beneficiary, BeneficiaryCreate, PaymentPolicy, DecisionRecord, DashboardSummary, InvoiceOutcome, BudgetUpdate, RuleCatalogItem, PolicyMutation, ApiValidationIssue } from '../types/index'

const API_BASE = '/api/v1'

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
    this.name = 'ApiError'
  }
}

function formatApiDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail.map((issue: ApiValidationIssue | string) => {
      if (typeof issue === 'string') return issue
      const location = issue.loc?.filter((part) => part !== 'body' && part !== 'query' && part !== 'path').join('.')
      return [location, issue.msg].filter(Boolean).join(': ')
    }).filter(Boolean)
    return messages.length ? messages.join(' · ') : 'Los datos enviados no son válidos.'
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail)
  return ''
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(
        0,
        `No se pudo conectar con la API en ${API_BASE}${path}. Comprueba que el backend esté activo y que el proxy /api esté disponible desde la dirección de la aplicación.`,
      )
    }
    throw error
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = formatApiDetail((body as { detail?: unknown }).detail) || detail
    } catch {
      // ignorar si no es JSON
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  getPolicy: () => request<PaymentPolicy>('/policy/'),
  getPolicyCatalog: () => request<RuleCatalogItem[]>('/policy/catalog'),
  listPolicyVersions: () => request<PaymentPolicy[]>('/policy/versions'),
  createPolicy: (body: PolicyMutation) => request<PaymentPolicy>('/policy/', {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  updateBudget: (body: BudgetUpdate) => request<PaymentPolicy>('/policy/budget', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),
  activatePolicy: (policyId: string) => request<{ policy_id: string; active: boolean }>('/policy/activate', {
    method: 'POST',
    body: JSON.stringify({ policy_id: policyId }),
  }),

  listBeneficiaries: (companyId?: string) => {
    const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : ''
    return request<Beneficiary[]>(`/beneficiaries${qs}`)
  },
  createBeneficiary: (body: BeneficiaryCreate) => request<Beneficiary>('/beneficiaries', {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  listInvoices: (params?: { company_id?: string; status?: string; beneficiary_id?: string }) => {
    const qs = new URLSearchParams()
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.status) qs.set('status', params.status)
    if (params?.beneficiary_id) qs.set('beneficiary_id', params.beneficiary_id)
    return request<Invoice[]>(`/invoices?${qs.toString()}`)
  },
  createInvoice: (body: InvoiceCreate) => request<Invoice>('/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  getInvoice: (id: string) => request<Invoice>(`/invoices/${id}`),
  updateInvoice: (id: string, body: InvoiceUpdate) => request<Invoice>(`/invoices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),

  uploadInvoice: async (file: File, beneficiaryId: string): Promise<Invoice> => {
    const form = new FormData()
    form.append('file', file)
    form.append('beneficiary_id', beneficiaryId)
    const res = await fetch(`${API_BASE}/invoices/upload`, { method: 'POST', body: form })
    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = await res.json()
        detail = (body as { detail?: string }).detail || detail
      } catch { /* ignore */ }
      throw new ApiError(res.status, detail)
    }
    return res.json()
  },
  reextractInvoice: (id: string) => request<{ invoice_id: string; raw_text: string; extraction_confidence: number | null }>(`/invoices/${id}/extract`, {
    method: 'POST',
  }),

  evaluateInvoice: (id: string) => request<{
    invoice_id: string
    outcome: InvoiceOutcome
    reason_codes: string[]
    explanation: string | null
    reserved_budget: boolean
    linked_invoice_id: string | null
    policy_version: number | null
    rules_evaluated: string[]
    decision_id: string
  }>(`/invoices/${id}/evaluate`, { method: 'POST' }),
  listDecisions: (id: string) => request<DecisionRecord[]>(`/invoices/${id}/decisions`),
  reviewInvoice: (id: string, action: 'approve' | 'reject', reason: string) => request<{ invoice_id: string; status: InvoiceOutcome }>(`/invoices/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ action, reason, reviewer_demo_id: 'demo_user' }),
  }),

  dashboardSummary: (companyId?: string) => {
    const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : ''
    return request<DashboardSummary>(`/dashboard/summary${qs}`)
  },
}
