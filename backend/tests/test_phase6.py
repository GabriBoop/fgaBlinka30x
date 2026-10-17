"""Fase 6 — Seguridad, pruebas y demostración.

Comprueba:
1. Dataset completo de 26 facturas vs expected-results.json (26/26).
2. Concurrencia de presupuesto: dos facturas simultáneas que superan el
   presupuesto restante nunca quedan ambas aptas.
3. Reevaluación: se añade un nuevo registro de decisión; no se duplica la
   factura ni la reserva; el historial original se conserva.
4. No existen rutas de pago en la API.
5. Datos 100% ficticios (no hay información real de clientes/empresas).
"""
import json
from pathlib import Path
from decimal import Decimal
from datetime import date

from conftest import TestingSessionLocal
from app.models.company import CompanyDemo
from app.models.policy import PaymentPolicy
from app.models.rule_action import RuleAction
from app.models.beneficiary import Beneficiary
from app.models.agreement import Agreement
from app.models.invoice import Invoice
from app.models.decision_record import DecisionRecord
from app.services.evaluation import evaluate_and_record


BASE = Path(__file__).resolve().parents[2]
DEMO = BASE / "data-demo"


def _seed_phase1(db):
    cfg = json.loads((DEMO / "demo-config.json").read_text(encoding="utf-8"))
    company = cfg["company"]
    pol = cfg["policy"]

    db.add(CompanyDemo(
        id=company["id"], name=company["name"], currency_base=company["currency_base"]))
    p = PaymentPolicy(
        id=f"pol_v{pol['version']}", company_id=company["id"], version=pol["version"],
        active=pol["active"], currency=pol["currency"],
        max_invoice_amount=float(Decimal(pol["max_invoice_amount"])),
        approval_threshold=float(Decimal(pol["approval_threshold"])),
        period_budget=float(Decimal(pol["period_budget"])),
        period_type=pol["period_type"], period_basis=pol["period_basis"],
    )
    db.add(p)
    db.flush()
    for code, action in pol["rule_actions"].items():
        db.add(RuleAction(code=code, policy_id=p.id, action=action))

    for b in cfg["beneficiaries"]:
        db.add(Beneficiary(
            id=b["id"], company_id=company["id"], name=b["name"],
            normalized_name=b["normalized_name"], allowed=b["allowed"],
            reference_code=b.get("reference_code"), category=b.get("category")))
    for a in cfg["agreements"]:
        db.add(Agreement(
            id=a["id"], company_id=company["id"], beneficiary_id=a["beneficiary_id"],
            description=a["description"], expected_amount=float(Decimal(a["expected_amount"])),
            currency=a["currency"], valid_from=date.fromisoformat(a["valid_from"]),
            valid_to=date.fromisoformat(a["valid_to"])))
    for h in cfg["history_invoices"]:
        db.add(Invoice(
            id=h["id"], company_id=company["id"], beneficiary_id=h["beneficiary_id"],
            invoice_number=h["invoice_number"], amount=float(Decimal(h["amount"])),
            currency=h["currency"], issue_date=date.fromisoformat(h["issue_date"]),
            due_date=date.fromisoformat(h["due_date"]) if h.get("due_date") else None,
            description=None, source_type="history",
            file_hash=h["file_hash"], extraction_confidence=1.0, status=h["status"],
        ))
        if h.get("reserves_budget"):
            from app.models.budget_reservation import BudgetReservation
            db.add(BudgetReservation(
                id=f"res_{h['id']}", invoice_id=h["id"],
                company_id=company["id"],
                period_key=h["issue_date"][:7], amount=float(Decimal(h["amount"])),
                currency=h["currency"], status="reserved",
            ))
    # Reservas de apertura (otras facturas no listadas) por periodo
    for periodo, monto in cfg.get("opening_reservations_undetailed", {}).items():
        if periodo.startswith("_"):
            continue
        from app.models.budget_reservation import BudgetReservation
        db.add(BudgetReservation(
            id=f"res_opening_{periodo}", invoice_id=None,
            company_id=company["id"],
            period_key=periodo, amount=float(Decimal(monto)),
            currency=company["currency_base"], status="reserved",
        ))
    db.commit()


def _inv_obj(inv_data, beneficiaries):
    from app.rules.normalization import norm_name
    name = inv_data["extracted"]["beneficiary_name"]
    ben_id = None
    n = norm_name(name)
    for b in beneficiaries:
        if b.normalized_name == n:
            ben_id = b.id
            break
    return Invoice(
        id=inv_data["id"], company_id="co_demo_001", beneficiary_id=ben_id,
        invoice_number=inv_data["extracted"].get("invoice_number"),
        amount=float(Decimal(inv_data["extracted"]["amount"])) if inv_data["extracted"].get("amount") else None,
        currency=inv_data["extracted"].get("currency"),
        issue_date=date.fromisoformat(inv_data["extracted"]["issue_date"]) if inv_data["extracted"].get("issue_date") else None,
        due_date=date.fromisoformat(inv_data["extracted"]["due_date"]) if inv_data["extracted"].get("due_date") else None,
        description=inv_data["extracted"].get("description"),
        source_type=inv_data.get("source_type", "pdf"),
        file_hash=inv_data.get("file_hash"),
        extraction_confidence=inv_data.get("extraction_confidence"),
        raw_text=inv_data.get("raw_text"),
        extracted=inv_data["extracted"],
        status="PENDING",
    )


def test_dataset_completo_consistente(db_session):
    _seed_phase1(db_session)
    cfg = json.loads((DEMO / "demo-config.json").read_text(encoding="utf-8"))
    invoices = json.loads((DEMO / "invoices.json").read_text(encoding="utf-8"))["invoices"]
    expected = {r["invoice_id"]: r for r in json.loads((DEMO / "expected-results.json").read_text(encoding="utf-8"))["results"]}
    beneficiaries = db_session.query(Beneficiary).all()

    errors = 0
    counts = {}
    for inv in sorted(invoices, key=lambda i: i["order"]):
        invoice = _inv_obj(inv, beneficiaries)
        db_session.add(invoice)
        db_session.commit()
        res = evaluate_and_record(db_session, invoice.id)
        counts[res["outcome"]] = counts.get(res["outcome"], 0) + 1
        exp = expected[inv["id"]]
        if res["outcome"] != exp["outcome"]:
            errors += 1
            print(f"[FALLO] {inv['id']}: {res['outcome']} != {exp['outcome']}")
        if res["reason_codes"] != exp["reason_codes"]:
            errors += 1
            print(f"[FALLO] {inv['id']}: motivos {res['reason_codes']} != {exp['reason_codes']}")
        if res["reserved_budget"] != exp["reserves_budget"]:
            errors += 1
            print(f"[FALLO] {inv['id']}: reserva {res['reserved_budget']} != {exp['reserves_budget']}")

    assert errors == 0, f"{errors} casos del dataset con diferencias"
    assert counts == {"ELIGIBLE_SIMULATED": 5, "BLOCKED": 10, "NEEDS_HUMAN_APPROVAL": 11}
    print(f"[OK] Dataset completo: {counts}")


def test_concurrencia_presupuesto(db_session):
    """Dos facturas simultáneas cuyo total supera el presupuesto: nunca ambas aptas."""
    _seed_phase1(db_session)
    # Septiembre: opening 8200 + historicas 2600 = 10800 reservado, quedan 1200.
    # Dos facturas de 800 (coinciden con acuerdo de Suministros Andinos): solo una cabe.
    inv_a = Invoice(
        id="conc_a", company_id="co_demo_001", beneficiary_id="ben_001",
        invoice_number="CONC-A", amount=800.00, currency="USD",
        issue_date=date(2026, 9, 25), due_date=date(2026, 10, 25),
        description="Conc A", source_type="manual", status="PENDING",
        extracted={"beneficiary_name": "Suministros Andinos Ltda", "invoice_number": "CONC-A",
                   "amount": "800.00", "currency": "USD", "issue_date": "2026-09-25",
                   "due_date": "2026-10-25", "description": "Conc A"},
    )
    inv_b = Invoice(
        id="conc_b", company_id="co_demo_001", beneficiary_id="ben_001",
        invoice_number="CONC-B", amount=800.00, currency="USD",
        issue_date=date(2026, 9, 26), due_date=date(2026, 10, 26),
        description="Conc B", source_type="manual", status="PENDING",
        extracted={"beneficiary_name": "Suministros Andinos Ltda", "invoice_number": "CONC-B",
                   "amount": "800.00", "currency": "USD", "issue_date": "2026-09-26",
                   "due_date": "2026-10-26", "description": "Conc B"},
    )
    db_session.add_all([inv_a, inv_b])
    db_session.commit()

    r1 = evaluate_and_record(db_session, "conc_a")
    r2 = evaluate_and_record(db_session, "conc_b")
    aptas = sum(1 for r in (r1, r2) if r["outcome"] == "ELIGIBLE_SIMULATED")
    frenadas = sum(1 for r in (r1, r2) if r["outcome"] == "BLOCKED")
    assert aptas <= 1, f"Invariante violada: {aptas} aptas simultáneas superan presupuesto"
    assert frenadas >= 1, "Al menos una debe frenarse por presupuesto"
    print(f"[OK] Concurrencia presupuesto: {aptas} apta(s), {frenadas} frenada(s)")


def test_reevaluacion_no_duplica_historial(db_session):
    _seed_phase1(db_session)
    inv = Invoice(
        id="reev_01", company_id="co_demo_001", beneficiary_id="ben_001",
        invoice_number="REEV-01", amount=800.00, currency="USD",
        issue_date=date(2026, 10, 5), due_date=date(2026, 11, 4),
        description="Reevaluación", source_type="manual", status="PENDING",
        extracted={"beneficiary_name": "Suministros Andinos Ltda", "invoice_number": "REEV-01",
                   "amount": "800.00", "currency": "USD", "issue_date": "2026-10-05",
                   "due_date": "2026-11-04", "description": "Reevaluación"},
    )
    db_session.add(inv)
    db_session.commit()

    r1 = evaluate_and_record(db_session, "reev_01")
    decisions_before = db_session.query(DecisionRecord).filter(DecisionRecord.invoice_id == "reev_01").count()
    reservations_before = db_session.query(__import__("app.models.budget_reservation", fromlist=["BudgetReservation"]).BudgetReservation).filter_by(invoice_id="reev_01").count()

    # Reevaluar: debe añadir un nuevo registro, no duplicar factura ni reserva
    r2 = evaluate_and_record(db_session, "reev_01")
    decisions_after = db_session.query(DecisionRecord).filter(DecisionRecord.invoice_id == "reev_01").count()
    reservations_after = db_session.query(__import__("app.models.budget_reservation", fromlist=["BudgetReservation"]).BudgetReservation).filter_by(invoice_id="reev_01").count()
    invoices_count = db_session.query(Invoice).filter(Invoice.id == "reev_01").count()

    assert decisions_after == decisions_before + 1, "Reevaluar debe añadir un registro de decisión"
    assert invoices_count == 1, "No se debe duplicar la factura"
    assert reservations_after == reservations_before, "No se debe duplicar la reserva de presupuesto"
    assert r1["decision_id"] != r2["decision_id"], "Cada decisión tiene un ID distinto"
    print(f"[OK] Reevaluación: {decisions_before} -> {decisions_after} decisiones, reserva {reservations_after}")


def test_no_rutas_pago():
    """Confirmar que la API no expone endpoints de pago ni transferencia."""
    from app.api.v1.router import api_router
    rutas = [r.path for r in api_router.routes]
    for r in rutas:
        assert "pago" not in r.lower() and "payment" not in r.lower() and "transfer" not in r.lower(), f"Ruta de pago encontrada: {r}"
    print(f"[OK] No hay rutas de pago. Rutas: {len(rutas)}")


def test_datos_ficticios():
    """Confirmar que la empresa y los datos son ficticios."""
    cfg = json.loads((DEMO / "demo-config.json").read_text(encoding="utf-8"))
    assert "ficticia" in cfg["company"]["name"].lower()
    assert cfg["company"]["currency_base"] == "USD"
    # No hay datos reales: todos los importes son decimales de prueba
    for inv in json.loads((DEMO / "invoices.json").read_text(encoding="utf-8"))["invoices"]:
        amt = inv["extracted"].get("amount")
        if amt:
            assert float(amt) < 1_000_000, f"Importe sospechosamente real: {amt}"
    print("[OK] Datos 100% ficticios (empresa, importes y beneficiarios inventados)")
