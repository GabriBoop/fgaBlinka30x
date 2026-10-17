from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.budget_reservation import BudgetReservation
from app.models.invoice import Invoice
from app.models.policy import PaymentPolicy

router = APIRouter()


@router.get("/summary", tags=["dashboard"])
def dashboard_summary(company_id: str | None = None, db: Session = Depends(get_db)):
    invoice_query = db.query(Invoice.status, func.count(Invoice.id))
    reservation_query = db.query(func.coalesce(func.sum(BudgetReservation.amount), 0))
    policy_query = db.query(func.coalesce(func.sum(PaymentPolicy.period_budget), 0))

    if company_id:
        invoice_query = invoice_query.filter(Invoice.company_id == company_id)
        reservation_query = reservation_query.filter(BudgetReservation.company_id == company_id)
        policy_query = policy_query.filter(PaymentPolicy.company_id == company_id)

    counts = dict(invoice_query.group_by(Invoice.status).all())
    active_budget = policy_query.filter(PaymentPolicy.active.is_(True)).scalar()
    current_period = date.today().strftime("%Y-%m")
    consumed_budget = reservation_query.filter(
        BudgetReservation.period_key == current_period,
        BudgetReservation.status == "reserved",
    ).scalar()

    return {
        "total": sum(counts.values()),
        "ELIGIBLE_SIMULATED": counts.get("ELIGIBLE_SIMULATED", 0),
        "BLOCKED": counts.get("BLOCKED", 0),
        "NEEDS_HUMAN_APPROVAL": counts.get("NEEDS_HUMAN_APPROVAL", 0),
        "PENDING": counts.get("PENDING", 0),
        "budget_consumed": float(consumed_budget or 0),
        "budget_total": float(active_budget or 0),
    }
