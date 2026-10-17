"""Endpoints de ingesta de documentos (Fase 4).

- POST /invoices/upload : sube un PDF o imagen, extrae texto y crea una factura PENDING.
- POST /invoices/{id}/extract : re-ejecuta la extracción sobre el archivo ya subido.

Los datos son 100% ficticios. No se ejecutan pagos.
"""
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.beneficiary import Beneficiary
from app.models.company import CompanyDemo
from app.models.invoice import Invoice
from app.schemas.invoice import InvoiceUploadOut
from app.services.extraction import extract_file

router = APIRouter()


@router.post("/upload", response_model=InvoiceUploadOut, status_code=201, tags=["invoices"])
async def upload_invoice(
    file: UploadFile = File(...),
    company_id: str | None = Form(None),
    beneficiary_id: str | None = Form(None),
    db: Session = Depends(get_db),
):
    resolved_company_id: str
    beneficiary = None
    if beneficiary_id:
        beneficiary = (
            db.query(Beneficiary)
            .filter(Beneficiary.id == beneficiary_id)
            .first()
        )
        if not beneficiary:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")
        if company_id and company_id != beneficiary.company_id:
            raise HTTPException(
                status_code=400,
                detail="El proveedor no pertenece a la empresa indicada",
            )
        resolved_company_id = beneficiary.company_id
    elif company_id:
        company = db.query(CompanyDemo).filter(CompanyDemo.id == company_id).first()
        if not company:
            raise HTTPException(status_code=404, detail="Empresa no encontrada")
        resolved_company_id = company_id
    else:
        raise HTTPException(
            status_code=422,
            detail="Seleccione un proveedor o indique una empresa",
        )

    content = await file.read()
    try:
        extracted = extract_file(content, file.filename or "archivo")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
    invoice = Invoice(
        id=invoice_id,
        company_id=resolved_company_id,
        beneficiary_id=beneficiary.id if beneficiary else None,
        invoice_number=None,
        amount=None,
        currency=None,
        issue_date=None,
        due_date=None,
        description=None,
        source_type=extracted.source_type,
        file_name=extracted.file_name,
        file_hash=extracted.file_hash,
        file_path=extracted.file_path,
        extraction_confidence=extracted.extraction_confidence,
        raw_text=extracted.raw_text,
        extracted=None,
        status="PENDING",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    return InvoiceUploadOut(
        id=invoice.id,
        company_id=invoice.company_id,
        beneficiary_id=invoice.beneficiary_id,
        status=invoice.status,
        created_at=str(invoice.created_at) if invoice.created_at else None,
        source_type=invoice.source_type,
        file_name=invoice.file_name,
        file_hash=invoice.file_hash,
        file_path=invoice.file_path,
        extraction_confidence=invoice.extraction_confidence,
        raw_text=invoice.raw_text,
        extracted=None,
        ocr_available=extracted.ocr_available,
        ocr_warning=extracted.ocr_warning,
    )


@router.post("/{invoice_id}/extract", tags=["invoices"])
def reextract_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if not invoice.file_path:
        raise HTTPException(status_code=400, detail="La factura no tiene archivo asociado")

    from pathlib import Path
    path = Path(invoice.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="El archivo subido ya no existe en disco")

    content = path.read_bytes()
    try:
        extracted = extract_file(content, invoice.file_name or "archivo")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    invoice.raw_text = extracted.raw_text
    invoice.extraction_confidence = extracted.extraction_confidence
    invoice.source_type = extracted.source_type
    db.commit()
    db.refresh(invoice)

    return {
        "invoice_id": invoice.id,
        "source_type": invoice.source_type,
        "raw_text": invoice.raw_text,
        "extraction_confidence": invoice.extraction_confidence,
        "ocr_available": extracted.ocr_available,
        "ocr_warning": extracted.ocr_warning,
    }
