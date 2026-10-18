from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import Field, field_validator, model_validator

from app.rules.catalog import RULE_CATALOG


class RuleActionBase(BaseModel):
    code: str
    action: str


class PaymentPolicyBase(BaseModel):
    version: int = Field(ge=1)
    active: bool = False
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    max_invoice_amount: Decimal = Field(ge=0)
    approval_threshold: Decimal = Field(ge=0)
    period_budget: Decimal = Field(ge=0)
    period_type: Literal["monthly", "quarterly", "yearly"]
    period_basis: Literal["issue_date"]
    amount_tolerance_pct: Decimal = Field(default=Decimal("0"), ge=0)
    min_extraction_confidence: float = Field(default=0.80, ge=0, le=1)
    name_similarity_threshold: float = Field(default=0.85, ge=0, le=1)
    possible_duplicate_date_window_days: int = Field(default=0, ge=0)
    rule_actions: list[RuleActionBase] = []

    @model_validator(mode="after")
    def approval_threshold_within_invoice_limit(self):
        if self.approval_threshold > self.max_invoice_amount:
            raise ValueError("approval_threshold no puede superar max_invoice_amount")
        return self

    @field_validator("rule_actions")
    @classmethod
    def validate_rule_actions(cls, actions):
        action_map = {action.code: action.action for action in actions}
        if len(action_map) != len(actions):
            raise ValueError("rule_actions no puede contener códigos duplicados")

        catalog = {item["code"]: item for item in RULE_CATALOG}
        if set(action_map) != set(catalog):
            raise ValueError("rule_actions debe incluir exactamente todos los códigos del catálogo")
        for code, action in action_map.items():
            if action not in catalog[code]["allowed_actions"]:
                raise ValueError(f"La acción {action} no está permitida para {code}")
        return actions


class PaymentPolicyOut(PaymentPolicyBase):
    id: str
    company_id: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PolicyCreate(PaymentPolicyBase):
    company_id: str
    change_reason: str = Field(min_length=1, max_length=1000)
    activate: bool = True

    @field_validator("change_reason")
    @classmethod
    def validate_change_reason(cls, reason):
        if not reason.strip():
            raise ValueError("El motivo del cambio es obligatorio")
        return reason.strip()


class PolicyActivate(BaseModel):
    policy_id: str


class BudgetUpdate(BaseModel):
    period_budget: Decimal
