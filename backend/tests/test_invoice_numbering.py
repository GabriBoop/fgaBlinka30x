from app.models.company import CompanyDemo
from app.models.invoice import Invoice


def _add_company(db_session):
    db_session.add(
        CompanyDemo(id="co_numbers", name="Empresa prueba", currency_base="COP")
    )
    db_session.commit()


def _add_invoice(db_session, invoice_id, invoice_number=None):
    db_session.add(
        Invoice(
            id=invoice_id,
            company_id="co_numbers",
            source_type="manual",
            invoice_number=invoice_number,
            status="PENDING",
        )
    )
    db_session.commit()


def _standardize(client, invoice_id):
    return client.patch(
        f"/api/v1/invoices/{invoice_id}",
        json={"standardize_number": True},
    )


def test_standardization_starts_at_a000(client, db_session):
    _add_company(db_session)
    _add_invoice(db_session, "invoice-first")

    response = _standardize(client, "invoice-first")

    assert response.status_code == 200, response.text
    assert response.json()["invoice_number"] == "A000"


def test_existing_invoices_set_current_position_near_a006(client, db_session):
    _add_company(db_session)
    for index in range(7):
        _add_invoice(db_session, f"legacy-{index}", f"EXT-{index}")

    response = _standardize(client, "legacy-6")

    assert response.status_code == 200, response.text
    assert response.json()["invoice_number"] == "A006"

    _add_invoice(db_session, "new-invoice")
    next_response = _standardize(client, "new-invoice")

    assert next_response.status_code == 200, next_response.text
    assert next_response.json()["invoice_number"] == "A007"


def test_standardization_rolls_from_a999_to_b000(client, db_session):
    _add_company(db_session)
    _add_invoice(db_session, "invoice-a999", "A999")
    _add_invoice(db_session, "invoice-next")

    response = _standardize(client, "invoice-next")

    assert response.status_code == 200, response.text
    assert response.json()["invoice_number"] == "B000"


def test_standardization_rejects_values_after_z999(client, db_session):
    _add_company(db_session)
    _add_invoice(db_session, "invoice-z999", "Z999")
    _add_invoice(db_session, "invoice-exhausted")

    response = _standardize(client, "invoice-exhausted")

    assert response.status_code == 422
    assert response.json()["detail"] == "Se agotó la secuencia de facturas al llegar a Z999"
