from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.policy import PaymentPolicy
from app.models.rule_action import RuleAction
from app.models.company import CompanyDemo
from app.schemas.policy import PaymentPolicyOut, PolicyCreate, PolicyActivate

router = APIRouter()


@router.get("/", response_model=PaymentPolicyOut, tags=["policy"])
def get_active_policy(db: Session = Depends(get_db)):
    policy = db.query(PaymentPolicy).filter(PaymentPolicy.active == True).first()  # noqa: E712
    if not policy:
        raise HTTPException(status_code=404, detail="No hay política activa")
    return policy


@router.put("/", response_model=PaymentPolicyOut, tags=["policy"])
def create_policy(payload: PolicyCreate, db: Session = Depends(get_db)):
    company = db.query(CompanyDemo).filter(CompanyDemo.id == payload.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    new_policy = PaymentPolicy(
        id=f"pol_v{payload.version}",
        company_id=payload.company_id,
        version=payload.version,
        active=payload.active,
        currency=payload.currency,
        max_invoice_amount=payload.max_invoice_amount,
        approval_threshold=payload.approval_threshold,
        period_budget=payload.period_budget,
        period_type=payload.period_type,
        period_basis=payload.period_basis,
        amount_tolerance_pct=payload.amount_tolerance_pct,
        min_extraction_confidence=payload.min_extraction_confidence,
        name_similarity_threshold=payload.name_similarity_threshold,
        possible_duplicate_date_window_days=payload.possible_duplicate_date_window_days,
    )
    db.add(new_policy)

    if payload.active:
        db.query(PaymentPolicy).filter(
            PaymentPolicy.company_id == payload.company_id,
            PaymentPolicy.id != new_policy.id,
        ).update({PaymentPolicy.active: False})

    db.flush()
    for ra in payload.rule_actions:
        db.add(RuleAction(code=ra.code, policy_id=new_policy.id, action=ra.action))

    db.commit()
    db.refresh(new_policy)
    return new_policy


@router.post("/activate", tags=["policy"])
def activate_policy(payload: PolicyActivate, db: Session = Depends(get_db)):
    policy = db.query(PaymentPolicy).filter(PaymentPolicy.id == payload.policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada")
    db.query(PaymentPolicy).filter(PaymentPolicy.company_id == policy.company_id).update(
        {PaymentPolicy.active: False}
    )
    policy.active = True
    db.commit()
    return {"policy_id": policy.id, "active": True}
