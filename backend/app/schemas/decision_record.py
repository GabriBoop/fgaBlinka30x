from pydantic import BaseModel, ConfigDict
from typing import Optional


class DecisionRecordBase(BaseModel):
    policy_version: int
    outcome: str
    reason_codes: list[str] = []
    explanation: Optional[str] = None
    rules_evaluated: list[str] = []


class DecisionRecordOut(DecisionRecordBase):
    id: str
    invoice_id: str
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
