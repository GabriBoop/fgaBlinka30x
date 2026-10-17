from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal


class CompanyDemoBase(BaseModel):
    id: str
    name: str
    currency_base: str


class CompanyDemoOut(CompanyDemoBase):
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
