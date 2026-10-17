from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal


class EvaluationResult(BaseModel):
    invoice_id: str
    outcome: str
    reason_codes: list[str] = []
    explanation: Optional[str] = None
    reserved_budget: bool = False
    linked_invoice_id: Optional[str] = None
    policy_version: Optional[int] = None
    rules_evaluated: list[str] = []

    model_config = ConfigDict(from_attributes=True)
