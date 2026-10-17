from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Any


class InvoiceBase(BaseModel):
    beneficiary_id: Optional[str] = None
    invoice_number: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    description: Optional[str] = None
    source_type: str
    file_name: Optional[str] = None
    file_hash: Optional[str] = None
    extraction_confidence: Optional[float] = None
    raw_text: Optional[str] = None
    extracted: Optional[Any] = None


class InvoiceOut(InvoiceBase):
    id: str
    company_id: str
    status: str
    created_at: datetime | None = None
    extracted: Optional[Any] = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceCreate(InvoiceBase):
    id: str
    company_id: str


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    beneficiary_id: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
