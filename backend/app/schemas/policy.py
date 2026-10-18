from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal


class RuleActionBase(BaseModel):
    code: str
    action: str


class PaymentPolicyBase(BaseModel):
    version: int
    active: bool = False
    currency: str
    max_invoice_amount: Decimal
    approval_threshold: Decimal
    period_budget: Decimal
    period_type: str
    period_basis: str
    amount_tolerance_pct: Decimal = Decimal("0")
    min_extraction_confidence: float = 0.80
    name_similarity_threshold: float = 0.85
    possible_duplicate_date_window_days: int = 0
    rule_actions: list[RuleActionBase] = []


class PaymentPolicyOut(PaymentPolicyBase):
    id: str
    company_id: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PolicyCreate(PaymentPolicyBase):
    company_id: str


class PolicyActivate(BaseModel):
    policy_id: str


class BudgetUpdate(BaseModel):
    period_budget: Decimal
