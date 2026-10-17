from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.beneficiary import Beneficiary
from app.schemas.beneficiary import BeneficiaryOut, BeneficiaryCreate

router = APIRouter()


@router.get("/", response_model=list[BeneficiaryOut], tags=["beneficiaries"])
def list_beneficiaries(company_id: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Beneficiary)
    if company_id:
        query = query.filter(Beneficiary.company_id == company_id)
    return query.all()


@router.post("/", response_model=BeneficiaryOut, status_code=201, tags=["beneficiaries"])
def create_beneficiary(payload: BeneficiaryCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(Beneficiary)
        .filter(Beneficiary.id == payload.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="El beneficiario ya existe")
    beneficiary = Beneficiary(**payload.model_dump())
    db.add(beneficiary)
    db.commit()
    db.refresh(beneficiary)
    return beneficiary
