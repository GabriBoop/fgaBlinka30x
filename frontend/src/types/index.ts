/* Tipos del dominio compartidos con la API del backend (Fases 2-4). */

export type InvoiceOutcome =
  | 'ELIGIBLE_SIMULATED'
  | 'NEEDS_HUMAN_APPROVAL'
  | 'BLOCKED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'

export type InvoiceSource = 'pdf' | 'image' | 'manual' | 'email_text' | 'history'

export interface Invoice {
  id: string
  company_id: string
  beneficiary_id: string | null
  invoice_number: string | null
  amount: number | null
  currency: string | null
  issue_date: string | null
  due_date: string | null
  description: string | null
  source_type: InvoiceSource
  file_name: string | null
  file_hash: string | null
  file_path: string | null
  extraction_confidence: number | null
  raw_text: string | null
  extracted: any
  status: InvoiceOutcome
  created_at: string | null
}

export interface InvoiceCreate {
  id?: string
  company_id: string
  beneficiary_id?: string | null
  invoice_number?: string | null
  amount?: number | null
  currency?: string | null
  issue_date?: string | null
  due_date?: string | null
  description?: string | null
  source_type: InvoiceSource
  file_name?: string | null
  file_hash?: string | null
  extraction_confidence?: number | null
  raw_text?: string | null
}

export interface InvoiceUpdate {
  standardize_number?: boolean
  beneficiary_id?: string | null
  invoice_number?: string | null
  amount?: number | null
  currency?: string | null
  issue_date?: string | null
  due_date?: string | null
  description?: string | null
}

export interface Beneficiary {
  id: string
  company_id: string
  name: string
  normalized_name: string
  allowed: boolean
  reference_code: string | null
  category: string | null
}

export interface BeneficiaryCreate {
  id: string
  company_id: string
  name: string
  normalized_name: string
  allowed?: boolean
  reference_code?: string | null
  category?: string | null
}

export interface PolicyRuleAction {
  code: string
  action: string
}

export interface PaymentPolicy {
  id: string
  company_id: string
  version: number
  active: boolean
  currency: string
  max_invoice_amount: number
  approval_threshold: number
  period_budget: number
  period_type: string
  period_basis: string
  amount_tolerance_pct: number
  min_extraction_confidence: number
  name_similarity_threshold: number
  possible_duplicate_date_window_days: number
  created_at: string | null
  rule_actions: PolicyRuleAction[]
}

export interface DecisionRecord {
  id: string
  invoice_id: string
  policy_version: number
  outcome: InvoiceOutcome
  reason_codes: string[]
  explanation: string | null
  rules_evaluated: string[]
  created_at: string | null
}

export interface DashboardSummary {
  total: number
  ELIGIBLE_SIMULATED: number
  BLOCKED: number
  NEEDS_HUMAN_APPROVAL: number
  PENDING: number
  budget_consumed: number
  budget_total: number
}

export interface BudgetUpdate {
  period_budget: number
}

export interface ApiError {
  detail: string
}
