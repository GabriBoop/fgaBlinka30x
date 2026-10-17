"""Verificación de consistencia de la Fase 1 (NO es el motor de reglas de la Fase 3).

Recalcula cada factura con una implementación mínima de R1-R7 y compara con
expected-results.json, que fue escrito a mano. Si hay diferencias, hay un error
en el dataset o en la definición de las reglas.
"""
import json
import re
import unicodedata
from datetime import date
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from pathlib import Path

BASE = Path(__file__).parent
cfg = json.loads((BASE / "demo-config.json").read_text(encoding="utf-8"))
invoices = json.loads((BASE / "invoices.json").read_text(encoding="utf-8"))["invoices"]
expected = {r["invoice_id"]: r for r in json.loads((BASE / "expected-results.json").read_text(encoding="utf-8"))["results"]}

pol = cfg["policy"]
ACTIONS = pol["rule_actions"]
MAX = Decimal(pol["max_invoice_amount"])
THRESHOLD = Decimal(pol["approval_threshold"])
BUDGET = Decimal(pol["period_budget"])
BASE_CCY = pol["currency"]
bens = cfg["beneficiaries"]
agreements = {a["beneficiary_id"]: a for a in cfg["agreements"]}


def norm_name(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace(".", "")
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s).split())


def norm_num(s):
    return re.sub(r"[\s\-/]", "", s.upper())


reserved = {k: Decimal(v) for k, v in cfg["opening_reservations_undetailed"].items() if not k.startswith("_")}
store = []
for h in cfg["history_invoices"]:
    store.append({"id": h["id"], "ben": h["beneficiary_id"], "num": h["invoice_number"], "amount": Decimal(h["amount"]),
                  "ccy": h["currency"], "issue": h["issue_date"], "hash": h["file_hash"]})
    p = h["issue_date"][:7]
    reserved[p] = reserved.get(p, Decimal("0")) + Decimal(h["amount"])


def evaluate(inv):
    ex = inv["extracted"]
    codes, linked = [], None
    amount = None
    if ex.get("amount"):
        try:
            amount = Decimal(ex["amount"])
        except InvalidOperation:
            amount = None
    required = ["beneficiary_name", "invoice_number", "amount", "currency", "issue_date"]
    missing = [k for k in required if not ex.get(k)]
    invalid = []
    if amount is not None and amount <= 0:
        invalid.append("amount")
    if ex.get("due_date") and ex.get("issue_date") and ex["due_date"] < ex["issue_date"]:
        invalid.append("due_date")
    # R1
    if missing:
        codes.append("MISSING_REQUIRED_FIELDS")
    if invalid:
        codes.append("INVALID_FIELD")
    if inv["source_type"] != "manual" and inv["extraction_confidence"] < pol["min_extraction_confidence"]:
        codes.append("LOW_EXTRACTION_CONFIDENCE")
    # resolver beneficiario
    ben, status = None, None
    if ex.get("beneficiary_name"):
        n = norm_name(ex["beneficiary_name"])
        exact = [b for b in bens if b["normalized_name"] == n]
        if exact:
            ben, status = exact[0], "exact"
        else:
            best = max(SequenceMatcher(None, n, b["normalized_name"]).ratio() for b in bens)
            status = "ambiguous" if best >= pol["name_similarity_threshold"] else "unknown"
    # R2 duplicados
    confirmed = possible = None
    for s in store:
        if inv.get("file_hash") and s.get("hash") == inv["file_hash"]:
            confirmed = s
            break
        if ben and ex.get("invoice_number") and s["ben"] == ben["id"] and norm_num(s["num"]) == norm_num(ex["invoice_number"]):
            confirmed = s
            break
    if not confirmed and ben and amount is not None and ex.get("currency") and ex.get("invoice_number"):
        for s in store:
            if (s["ben"] == ben["id"] and s["amount"] == amount and s["ccy"] == ex["currency"]
                    and s["issue"] == ex["issue_date"] and norm_num(s["num"]) != norm_num(ex["invoice_number"])):
                possible = s
                break
    if confirmed:
        codes.append("DUPLICATE_CONFIRMED")
        linked = confirmed["id"]
    elif possible:
        codes.append("POSSIBLE_DUPLICATE")
        linked = possible["id"]
    # R3
    if status == "unknown":
        codes.append("BENEFICIARY_UNKNOWN")
    elif status == "ambiguous":
        codes.append("BENEFICIARY_NAME_AMBIGUOUS")
    elif ben and not ben["allowed"]:
        codes.append("BENEFICIARY_NOT_ALLOWED")
    # R4
    ccy_ok = bool(ex.get("currency"))
    if ccy_ok and ex["currency"] != BASE_CCY:
        codes.append("CURRENCY_MISMATCH")
    elif status == "exact" and amount is not None and ccy_ok and ben["id"] in agreements:
        a = agreements[ben["id"]]
        if not (a["valid_from"] <= ex["issue_date"] <= a["valid_to"]):
            codes.append("AGREEMENT_EXPIRED")
        elif amount != Decimal(a["expected_amount"]):
            codes.append("AGREEMENT_AMOUNT_MISMATCH")
    can_amount_rules = amount is not None and ccy_ok and ex["currency"] == BASE_CCY and "amount" not in invalid and bool(ex.get("issue_date"))
    if can_amount_rules:
        if amount > MAX:
            codes.append("ABOVE_MAX_INVOICE")
        period = ex["issue_date"][:7]
        if amount > BUDGET - reserved.get(period, Decimal("0")):
            codes.append("BUDGET_EXCEEDED")
        if amount <= MAX and amount > THRESHOLD:
            codes.append("ABOVE_APPROVAL_THRESHOLD")
    # resultado
    outcomes = [ACTIONS[c] for c in codes]
    if "BLOCKED" in outcomes:
        outcome = "BLOCKED"
    elif outcomes:
        outcome = "NEEDS_HUMAN_APPROVAL"
    else:
        outcome, codes = "ELIGIBLE_SIMULATED", ["ALL_CHECKS_PASSED"]
    reserves = outcome == "ELIGIBLE_SIMULATED"
    if reserves:
        p = ex["issue_date"][:7]
        reserved[p] = reserved.get(p, Decimal("0")) + amount
    store.append({"id": inv["id"], "ben": ben["id"] if ben else None, "num": ex.get("invoice_number") or "",
                  "amount": amount, "ccy": ex.get("currency"), "issue": ex.get("issue_date"), "hash": inv.get("file_hash")})
    return outcome, codes, reserves, linked


errors = 0
counts = {}
for inv in sorted(invoices, key=lambda i: i["order"]):
    outcome, codes, reserves, linked = evaluate(inv)
    counts[outcome] = counts.get(outcome, 0) + 1
    exp = expected[inv["id"]]
    problems = []
    if outcome != exp["outcome"]:
        problems.append(f"resultado {outcome} != {exp['outcome']}")
    if codes != exp["reason_codes"]:
        problems.append(f"motivos {codes} != {exp['reason_codes']}")
    if reserves != exp["reserves_budget"]:
        problems.append(f"reserva {reserves} != {exp['reserves_budget']}")
    if linked != exp.get("linked_invoice"):
        problems.append(f"vinculada {linked} != {exp.get('linked_invoice')}")
    if problems:
        errors += 1
        print(f"[FALLO] {inv['id']}: " + "; ".join(problems))
    else:
        print(f"[ok]    {inv['id']}: {outcome} {codes}")

print()
print("Conteo calculado:", counts)
print("Reservas finales por periodo:", {k: str(v) for k, v in sorted(reserved.items())})
print("RESULTADO:", "TODO CONSISTENTE" if errors == 0 else f"{errors} casos con diferencias")
