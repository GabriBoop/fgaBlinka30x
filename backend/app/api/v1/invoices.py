from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.invoice import Invoice
from app.schemas.invoice import InvoiceOut, InvoiceCreate, InvoiceUpdate

router = APIRouter()


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
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(invoice, field, value)
    db.commit()
    db.refresh(invoice)
    return invoice
