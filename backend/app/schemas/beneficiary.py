from pydantic import BaseModel, ConfigDict


class BeneficiaryBase(BaseModel):
    name: str
    normalized_name: str
    allowed: bool = True
    reference_code: str | None = None
    category: str | None = None


class BeneficiaryOut(BeneficiaryBase):
    id: str
    company_id: str

    model_config = ConfigDict(from_attributes=True)


class BeneficiaryCreate(BeneficiaryBase):
    id: str
    company_id: str
