def test_list_empty_beneficiaries(client):
    response = client.get("/api/v1/beneficiaries")
    assert response.status_code == 200
    assert response.json() == []


def test_create_and_list_beneficiary(client):
    payload = {
        "id": "ben_test_01",
        "company_id": "co_demo_001",
        "name": "Beneficiario Prueba S.A.S.",
        "normalized_name": "beneficiario prueba sas",
        "allowed": True,
        "reference_code": "BTP-01",
        "category": "Pruebas",
    }
    response = client.post("/api/v1/beneficiaries", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "ben_test_01"
    assert data["allowed"] is True

    response = client.get("/api/v1/beneficiaries?company_id=co_demo_001")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_create_duplicate_beneficiary_fails(client):
    payload = {
        "id": "ben_test_02",
        "company_id": "co_demo_001",
        "name": "Dup S.A.S.",
        "normalized_name": "dup sas",
    }
    client.post("/api/v1/beneficiaries", json=payload)
    response = client.post("/api/v1/beneficiaries", json=payload)
    assert response.status_code == 400


def test_create_policy(client):
    from sqlalchemy.orm import sessionmaker
    from conftest import engine as _engine
    from app.models.company import CompanyDemo

    _S = sessionmaker(bind=_engine)
    _db = _S()
    if not _db.query(CompanyDemo).filter(CompanyDemo.id == "co_demo_001").first():
        _db.add(CompanyDemo(id="co_demo_001", name="Co Demo", currency_base="USD"))
        _db.commit()
    _db.close()

    payload = {
        "id": "pol_test_01",
        "company_id": "co_demo_001",
        "version": 1,
        "active": True,
        "currency": "USD",
        "max_invoice_amount": "5000.00",
        "approval_threshold": "1000.00",
        "period_budget": "12000.00",
        "period_type": "monthly",
        "period_basis": "issue_date",
        "rule_actions": [
            {"code": "DUPLICATE_CONFIRMED", "action": "BLOCKED"},
            {"code": "ALL_CHECKS_PASSED", "action": "ELIGIBLE_SIMULATED"},
        ],
    }
    response = client.put("/api/v1/policy", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["id"].startswith("pol_v")
    assert data["version"] == 1
    assert data["active"] is True
    policy_id = data["id"]

    response = client.get("/api/v1/policy")
    assert response.status_code == 200
    assert response.json()["id"] == policy_id


def test_create_and_list_invoice(client):
    payload = {
        "id": "inv_test_01",
        "company_id": "co_demo_001",
        "beneficiary_id": "ben_test_01",
        "invoice_number": "T-001",
        "amount": "800.00",
        "currency": "USD",
        "issue_date": "2026-10-05",
        "due_date": "2026-11-04",
        "description": "Prueba",
        "source_type": "manual",
        "file_name": None,
        "file_hash": None,
        "extraction_confidence": 1.0,
        "raw_text": "texto de prueba",
    }
    response = client.post("/api/v1/invoices", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "inv_test_01"
    assert data["status"] == "PENDING"

    response = client.get("/api/v1/invoices/inv_test_01")
    assert response.status_code == 200
    assert response.json()["invoice_number"] == "T-001"

    response = client.get("/api/v1/invoices?status=PENDING&company_id=co_demo_001")
    assert response.status_code == 200
    assert len(response.json()) == 1

    response = client.get("/api/v1/invoices?beneficiary_id=ben_test_01")
    assert response.status_code == 200
    assert len(response.json()) == 1
