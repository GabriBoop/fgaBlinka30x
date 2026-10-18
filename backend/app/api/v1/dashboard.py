from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.invoice import Invoice
from app.models.policy import PaymentPolicy

router = APIRouter()


@router.get("/summary", tags=["dashboard"])
def dashboard_summary(company_id: str | None = None, db: Session = Depends(get_db)):
    invoice_query = db.query(Invoice.status, func.count(Invoice.id))
    # El indicador del panel representa el importe de todas las facturas
    # registradas, independientemente de si ya fueron evaluadas o reservadas.
    amount_query = db.query(func.coalesce(func.sum(Invoice.amount), 0))
    policy_query = db.query(func.coalesce(func.sum(PaymentPolicy.period_budget), 0))

    if company_id:
        invoice_query = invoice_query.filter(Invoice.company_id == company_id)
        amount_query = amount_query.filter(Invoice.company_id == company_id)
        policy_query = policy_query.filter(PaymentPolicy.company_id == company_id)

    counts = dict(invoice_query.group_by(Invoice.status).all())
    active_budget = policy_query.filter(PaymentPolicy.active.is_(True)).scalar()
    consumed_budget = amount_query.scalar()

    return {
        "total": sum(counts.values()),
        "ELIGIBLE_SIMULATED": counts.get("ELIGIBLE_SIMULATED", 0),
        "BLOCKED": counts.get("BLOCKED", 0),
        "NEEDS_HUMAN_APPROVAL": counts.get("NEEDS_HUMAN_APPROVAL", 0),
        "PENDING": counts.get("PENDING", 0),
        "budget_consumed": float(consumed_budget or 0),
        "budget_total": float(active_budget or 0),
    }
