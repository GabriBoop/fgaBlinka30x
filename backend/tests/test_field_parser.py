from types import SimpleNamespace

from app.rules.engine import evaluate
from app.services.field_parser import parse_invoice_text


def test_parse_invoice_fields_from_capture_text():
    result = parse_invoice_text(
        "Beneficiario: Mantenimiento Pacífico S.A.S. (MAN-007) "
        "Importe: 750$ USD",
        "pdf",
    )

    assert result.fields == {
        "beneficiary_name": "Mantenimiento Pacífico S.A.S.",
        "invoice_number": None,
        "amount": "750.00",
        "currency": "USD",
        "issue_date": None,
        "due_date": None,
        "description": "",
    }


def test_parse_invoice_does_not_infer_missing_invoice_number_or_dates():
    result = parse_invoice_text(
        "Proveedor: Taller Demo\nImporte: 1.234,50 COP\n"
        "Fecha de vencimiento: 31/10/2026\nConcepto: Mantenimiento preventivo",
        "pdf",
    )

    assert result.fields["amount"] == "1234.50"
    assert result.fields["currency"] == "COP"
    assert result.fields["invoice_number"] is None
    assert result.fields["issue_date"] is None
    assert result.fields["due_date"] == "2026-10-31"
    assert result.fields["description"] == "Mantenimiento preventivo"


def test_parse_invoice_extracts_labeled_invoice_number_and_issue_date():
    result = parse_invoice_text(
        "Factura: F-2048\nFecha de emisión: 2026-10-18",
        "pdf",
    )

    assert result.fields["invoice_number"] == "F-2048"
    assert result.fields["issue_date"] == "2026-10-18"


def test_parse_invoice_common_alternate_labels():
    result = parse_invoice_text(
        "Razón social: Mantenimiento Pacífico S.A.S.\n"
        "N° de factura: FAC-2026-0081\n"
        "Fecha de emisión: 18/10/2026\n"
        "Fecha límite de pago: 18/11/2026\n"
        "Total a pagar: USD 750.00\n"
        "Descripción: Mantenimiento preventivo",
        "pdf",
    )

    assert result.fields == {
        "beneficiary_name": "Mantenimiento Pacífico S.A.S.",
        "invoice_number": "FAC-2026-0081",
        "amount": "750.00",
        "currency": "USD",
        "issue_date": "2026-10-18",
        "due_date": "2026-11-18",
        "description": "Mantenimiento preventivo",
    }


def test_parse_invoice_number_without_colon():
    result = parse_invoice_text(
        "Proveedor: Mantenimiento Pacífico S.A.S.\n"
        "Factura No. FAC-2026-0081\n"
        "Fecha: 18/10/2026\n"
        "Total: $750.00 USD",
        "pdf",
    )

    assert result.fields["beneficiary_name"] == "Mantenimiento Pacífico S.A.S."
    assert result.fields["invoice_number"] == "FAC-2026-0081"
    assert result.fields["amount"] == "750.00"


def test_description_is_only_taken_from_document_and_limited_to_140_chars():
    description_text = "servicio " * 30
    parsed = parse_invoice_text(f"Concepto: {description_text}", "pdf")
    missing = parse_invoice_text("Beneficiario: Taller Demo", "pdf")

    assert parsed.fields["description"] == description_text[:140]
    assert missing.fields["description"] == ""


def test_missing_invoice_number_and_issue_date_still_require_human_approval():
    parsed = parse_invoice_text(
        "Beneficiario: Mantenimiento Pacífico S.A.S. (MAN-007) "
        "Importe: 750$ USD",
        "pdf",
    )
    invoice = SimpleNamespace(
        id="inv_missing_fields",
        extracted=parsed.fields,
        source_type="pdf",
        extraction_confidence=parsed.confidence,
        file_hash=None,
    )
    policy = SimpleNamespace(
        version=1,
        currency="USD",
        min_extraction_confidence=0.8,
        max_invoice_amount=5000,
        approval_threshold=1000,
        period_budget=10000,
        rule_actions={},
    )

    result = evaluate(
        invoice,
        policy,
        beneficiaries=[],
        agreements_map={},
        all_invoices=[],
        reservations_by_period={},
        rule_actions={
            "MISSING_REQUIRED_FIELDS": "NEEDS_HUMAN_APPROVAL",
            "BENEFICIARY_UNKNOWN": "BLOCKED",
        },
    )

    assert "MISSING_REQUIRED_FIELDS" in result.reason_codes
    assert result.outcome == "BLOCKED"
