import json
from pathlib import Path
from decimal import Decimal
from difflib import SequenceMatcher

from app.rules.engine import evaluate
from app.rules.normalization import norm_name


class _Obj:
    def __init__(self, **kw):
        self.__dict__.update(kw)


def _norm_num(s):
    import re
    return re.sub(r"[\s\-/]", "", s.upper())


BASE = Path(__file__).resolve().parents[2]
DEMO = BASE / "data-demo"


def _load():
    cfg = json.loads((DEMO / "demo-config.json").read_text(encoding="utf-8"))
    invoices = json.loads((DEMO / "invoices.json").read_text(encoding="utf-8"))["invoices"]
    expected = {r["invoice_id"]: r for r in json.loads((DEMO / "expected-results.json").read_text(encoding="utf-8"))["results"]}
    return cfg, invoices, expected


def _build_objects(cfg):
    pol = cfg["policy"]
    policy = _Obj(
        currency=pol["currency"],
        max_invoice_amount=Decimal(pol["max_invoice_amount"]),
        approval_threshold=Decimal(pol["approval_threshold"]),
        period_budget=Decimal(pol["period_budget"]),
        min_extraction_confidence=pol.get("min_extraction_confidence", 0.80),
        rule_actions=pol["rule_actions"],
        version=pol["version"],
    )
    beneficiaries = [_Obj(id=b["id"], normalized_name=b["normalized_name"], allowed=b["allowed"]) for b in cfg["beneficiaries"]]
    agreements = [_Obj(id=a["id"], beneficiary_id=a["beneficiary_id"], valid_from=a["valid_from"], valid_to=a["valid_to"], expected_amount=Decimal(a["expected_amount"])) for a in cfg["agreements"]]
    agreements_map = {a["beneficiary_id"]: agreements[i] for i, a in enumerate(cfg["agreements"])}
    return policy, beneficiaries, agreements_map


def _resolve_beneficiary_id(extracted, beneficiaries):
    name = extracted.get("beneficiary_name")
    if not name:
        return None
    n = norm_name(name)
    for b in beneficiaries:
        if b.normalized_name == n:
            return b.id
    return None


def _build_invoice(inv, history, beneficiaries):
    extracted = inv.get("extracted") or {}
    return _Obj(
        id=inv["id"],
        source_type=inv.get("source_type", "manual"),
        extraction_confidence=inv.get("extraction_confidence"),
        file_hash=inv.get("file_hash"),
        extracted=extracted,
        invoice_number=extracted.get("invoice_number"),
        amount=_to_decimal(extracted.get("amount")),
        currency=extracted.get("currency"),
        issue_date=extracted.get("issue_date"),
        due_date=extracted.get("due_date"),
        beneficiary_id=_resolve_beneficiary_id(extracted, beneficiaries),
    )


def _to_decimal(v):
    if v is None:
        return None
    try:
        return Decimal(str(v))
    except Exception:
        return None


def test_motor_contra_dataset_26():
    cfg, invoices, expected = _load()
    policy, beneficiaries, agreements_map = _build_objects(cfg)

    history = []
    for h in cfg["history_invoices"]:
        history.append(_Obj(
            id=h["id"],
            beneficiary_id=h["beneficiary_id"],
            invoice_number=h["invoice_number"],
            amount=_to_decimal(h["amount"]),
            currency=h["currency"],
            issue_date=h["issue_date"],
            file_hash=h.get("file_hash"),
        ))

    reservations = {k: Decimal(v) for k, v in cfg.get("opening_reservations_undetailed", {}).items() if not k.startswith("_")}
    for h in cfg["history_invoices"]:
        p = h["issue_date"][:7]
        reservations[p] = reservations.get(p, Decimal("0")) + Decimal(h["amount"])

    store = list(history)
    errors = 0
    counts = {}
    for inv in sorted(invoices, key=lambda i: i["order"]):
        invoice = _build_invoice(inv, history, beneficiaries)
        all_invoices = store + [invoice]
        result = evaluate(invoice, policy, beneficiaries, agreements_map, all_invoices, dict(reservations))
        counts[result.outcome] = counts.get(result.outcome, 0) + 1
        exp = expected[inv["id"]]
        problems = []
        if result.outcome != exp["outcome"]:
            problems.append(f"resultado {result.outcome} != {exp['outcome']}")
        if result.reason_codes != exp["reason_codes"]:
            problems.append(f"motivos {result.reason_codes} != {exp['reason_codes']}")
        if result.reserved_budget != exp["reserves_budget"]:
            problems.append(f"reserva {result.reserved_budget} != {exp['reserves_budget']}")
        if result.linked_invoice_id != exp.get("linked_invoice"):
            problems.append(f"vinculada {result.linked_invoice_id} != {exp.get('linked_invoice')}")
        if problems:
            errors += 1
            print(f"[FALLO] {inv['id']}: " + "; ".join(problems))
        else:
            print(f"[ok]    {inv['id']}: {result.outcome} {result.reason_codes}")
        if result.reserved_budget:
            p = str(invoice.issue_date)[:7]
            reservations[p] = reservations.get(p, Decimal("0")) + Decimal(str(invoice.amount))
        store.append(invoice)

    print()
    print("Conteo calculado:", counts)
    print("Conteo esperado:  ", {"ELIGIBLE_SIMULATED": 5, "BLOCKED": 10, "NEEDS_HUMAN_APPROVAL": 11})
    assert errors == 0, f"{errors} casos con diferencias"
    assert counts == {"ELIGIBLE_SIMULATED": 5, "BLOCKED": 10, "NEEDS_HUMAN_APPROVAL": 11}
