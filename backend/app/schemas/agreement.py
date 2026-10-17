from pydantic import BaseModel, ConfigDict
from datetime import date
from decimal import Decimal


class AgreementBase(BaseModel):
    description: str
    expected_amount: Decimal
    currency: str
    valid_from: date
    valid_to: date


class AgreementOut(AgreementBase):
    id: str
    company_id: str
    beneficiary_id: str

    model_config = ConfigDict(from_attributes=True)


class AgreementCreate(AgreementBase):
    id: str
    company_id: str
    beneficiary_id: str
