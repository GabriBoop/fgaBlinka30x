"""Generación de números internos de factura en secuencia alfanumérica."""
import re

from sqlalchemy.orm import Session

from app.models.company import CompanyDemo
from app.models.invoice import Invoice

_STANDARD_NUMBER = re.compile(r"^([A-Z])(\d{3})$", re.IGNORECASE)
_SEQUENCES_PER_LETTER = 1000
_MAX_SEQUENCE = 26 * _SEQUENCES_PER_LETTER - 1


def _parse_sequence(invoice_number: str | None) -> int | None:
    if not invoice_number:
        return None
    match = _STANDARD_NUMBER.fullmatch(invoice_number.strip())
    if not match:
        return None
    letter_index = ord(match.group(1).upper()) - ord("A")
    return letter_index * _SEQUENCES_PER_LETTER + int(match.group(2))


def _format_sequence(sequence: int) -> str:
    if sequence > _MAX_SEQUENCE:
        raise ValueError("Se agotó la secuencia de facturas al llegar a Z999")
    letter = chr(ord("A") + sequence // _SEQUENCES_PER_LETTER)
    number = sequence % _SEQUENCES_PER_LETTER
    return f"{letter}{number:03d}"


def next_invoice_number(
    db: Session,
    company_id: str,
    current_invoice_id: str,
    existing_number: str | None = None,
) -> str:
    company = (
        db.query(CompanyDemo)
        .filter(CompanyDemo.id == company_id)
        .with_for_update()
        .first()
    )
    if not company:
        raise ValueError("No se encontró la empresa de la factura")

    existing_invoices = (
        db.query(Invoice.id, Invoice.invoice_number)
        .filter(Invoice.company_id == company_id, Invoice.id != current_invoice_id)
        .all()
    )
    occupied_numbers = {
        invoice_number.strip().upper()
        for _, invoice_number in existing_invoices
        if invoice_number and _parse_sequence(invoice_number) is not None
    }
    normalized_existing = existing_number.strip().upper() if existing_number else ""
    if _parse_sequence(normalized_existing) is not None and normalized_existing not in occupied_numbers:
        return normalized_existing

    existing_sequences = [
        sequence
        for _, invoice_number in existing_invoices
        if (sequence := _parse_sequence(invoice_number)) is not None
    ]
    if existing_sequences:
        next_sequence = max(existing_sequences) + 1
    else:
        next_sequence = len(existing_invoices)

    return _format_sequence(next_sequence)
