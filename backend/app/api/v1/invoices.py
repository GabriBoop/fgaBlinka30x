import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.invoice import Invoice
from app.models.human_review import HumanReview
from app.schemas.invoice import InvoiceOut, InvoiceCreate, InvoiceUpdate
from app.services.invoice_numbering import next_invoice_number

router = APIRouter()


class HumanReviewRequest(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")
    reason: str = Field(min_length=1, max_length=2000)
    reviewer_demo_id: str = Field(min_length=1, max_length=200)


@router.get("/", response_model=list[InvoiceOut], tags=["invoices"])
def list_invoices(
    company_id: str | None = None,
    status: str | None = None,
    beneficiary_id: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Invoice)
    if company_id:
        query = query.filter(Invoice.company_id == company_id)
    if status:
        query = query.filter(Invoice.status == status)
    if beneficiary_id:
        query = query.filter(Invoice.beneficiary_id == beneficiary_id)
    return query.order_by(Invoice.created_at.desc()).all()


@router.post("/", response_model=InvoiceOut, status_code=201, tags=["invoices"])
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    existing = db.query(Invoice).filter(Invoice.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="La factura ya existe")
    invoice = Invoice(**payload.model_dump())
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/{invoice_id}", response_model=InvoiceOut, tags=["invoices"])
def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return invoice


@router.patch("/{invoice_id}", response_model=InvoiceOut, tags=["invoices"])
def update_invoice(invoice_id: str, payload: InvoiceUpdate, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    previous_invoice_number = invoice.invoice_number
    for field, value in payload.model_dump(exclude_unset=True, exclude={"standardize_number"}).items():
        setattr(invoice, field, value)
    if payload.standardize_number:
        try:
            invoice.invoice_number = next_invoice_number(
                db, invoice.company_id, invoice.id, previous_invoice_number
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    db.commit()
    db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/review", tags=["invoices"])
def review_invoice(invoice_id: str, payload: HumanReviewRequest, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if invoice.status != "NEEDS_HUMAN_APPROVAL":
        raise HTTPException(status_code=409, detail="La factura no está pendiente de aprobación humana")
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=422, detail="La justificación es obligatoria")

    review = HumanReview(
        id=f"review_{uuid.uuid4().hex[:12]}",
        invoice_id=invoice.id,
        reviewer_demo_id=payload.reviewer_demo_id,
        action=payload.action,
        reason=reason,
    )
    invoice.status = "APPROVED" if payload.action == "approve" else "REJECTED"
    db.add(review)
    db.commit()
    return {"invoice_id": invoice.id, "status": invoice.status, "action": payload.action, "reason": reason}
