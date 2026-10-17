from decimal import Decimal, InvalidOperation
from dataclasses import dataclass, field
from datetime import date

from app.rules.normalization import norm_name, norm_num, name_similarity


@dataclass
class RuleResult:
    outcome: str = "PENDING"
    reason_codes: list = field(default_factory=list)
    explanation: str | None = None
    reserved_budget: bool = False
    linked_invoice_id: str | None = None
    not_evaluated: list = field(default_factory=list)
    policy_version: int | None = None
    rules_evaluated: list = field(default_factory=list)


def _amount(value):
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _missing(ex, required):
    return [k for k in required if not ex.get(k)]


def _resolve_beneficiary(ex, beneficiaries):
    name = ex.get("beneficiary_name")
    if not name:
        return None, None
    n = norm_name(name)
    exact = [b for b in beneficiaries if b.normalized_name == n]
    if exact:
        return exact[0], "exact"
    best = 0.0
    for b in beneficiaries:
        r = SequenceMatcher_ratio(n, b.normalized_name)
        if r > best:
            best = r
    threshold = 0.85
    status = "ambiguous" if best >= threshold else "unknown"
    return None, status


def SequenceMatcher_ratio(a, b):
    from difflib import SequenceMatcher
    return SequenceMatcher(None, a, b).ratio()


def _find_confirmed_duplicate(invoice, beneficiaries, all_invoices):
    ex = invoice.extracted or {}
    ben = getattr(invoice, "_resolved_beneficiary", None)
    status = getattr(invoice, "_resolved_beneficiary_status", None)
    num = ex.get("invoice_number")
    num_norm = norm_num(num) if num else None
    file_hash = invoice.file_hash
    for other in all_invoices:
        if other.id == invoice.id:
            continue
        if file_hash and other.file_hash and file_hash == other.file_hash:
            return other
        if ben and status == "exact" and num_norm and other.beneficiary_id == ben.id:
            other_num = other.invoice_number
            if other_num and norm_num(other_num) == num_norm:
                return other
    return None


def _find_possible_duplicate(invoice, beneficiaries, all_invoices):
    ex = invoice.extracted or {}
    ben = getattr(invoice, "_resolved_beneficiary", None)
    status = getattr(invoice, "_resolved_beneficiary_status", None)
    amount = _amount(ex.get("amount"))
    currency = ex.get("currency")
    issue_date = ex.get("issue_date")
    num = ex.get("invoice_number")
    num_norm = norm_num(num) if num else None
    if not (ben and status == "exact" and amount is not None and currency and issue_date and num_norm):
        return None
    for other in all_invoices:
        if other.id == invoice.id:
            continue
        if (other.beneficiary_id == ben.id
                and _amount(other.amount) == amount
                and other.currency == currency
                and str(other.issue_date) == str(issue_date)
                and other.invoice_number
                and norm_num(other.invoice_number) != num_norm):
            return other
    return None


def evaluate(invoice, policy, beneficiaries, agreements_map, all_invoices, reservations_by_period, rule_actions=None):
    result = RuleResult()
    ex = invoice.extracted or {}
    source_type = invoice.source_type or ""
    confidence = invoice.extraction_confidence

    required = ["beneficiary_name", "invoice_number", "amount", "currency", "issue_date"]
    missing = _missing(ex, required)
    invalid = []
    amount = _amount(ex.get("amount"))
    if amount is not None and amount <= 0:
        invalid.append("amount")
    if ex.get("due_date") and ex.get("issue_date") and str(ex["due_date"]) < str(ex["issue_date"]):
        invalid.append("due_date")

    result.rules_evaluated.append("R1")
    if missing:
        result.reason_codes.append("MISSING_REQUIRED_FIELDS")
        result.not_evaluated.extend(["R4", "R5", "R6", "R7"])
    if invalid:
        result.reason_codes.append("INVALID_FIELD")
    if source_type != "manual" and confidence is not None and confidence < policy.min_extraction_confidence:
        result.reason_codes.append("LOW_EXTRACTION_CONFIDENCE")

    ben, status = _resolve_beneficiary(ex, beneficiaries)
    invoice._resolved_beneficiary = ben
    invoice._resolved_beneficiary_status = status

    # R2 duplicados
    result.rules_evaluated.append("R2")
    confirmed = _find_confirmed_duplicate(invoice, beneficiaries, all_invoices)
    possible = None
    if not confirmed:
        possible = _find_possible_duplicate(invoice, beneficiaries, all_invoices)
    if confirmed:
        result.reason_codes.append("DUPLICATE_CONFIRMED")
        result.linked_invoice_id = confirmed.id
    elif possible:
        result.reason_codes.append("POSSIBLE_DUPLICATE")
        result.linked_invoice_id = possible.id

    # R3 beneficiario
    result.rules_evaluated.append("R3")
    if status == "unknown":
        result.reason_codes.append("BENEFICIARY_UNKNOWN")
    elif status == "ambiguous":
        result.reason_codes.append("BENEFICIARY_NAME_AMBIGUOUS")
    elif ben and not ben.allowed:
        result.reason_codes.append("BENEFICIARY_NOT_ALLOWED")

    # R4
    result.rules_evaluated.append("R4")
    ccy_ok = bool(ex.get("currency"))
    base_ccy = policy.currency
    if ccy_ok and ex["currency"] != base_ccy:
        result.reason_codes.append("CURRENCY_MISMATCH")
    elif status == "exact" and amount is not None and ccy_ok and ben and ben.id in agreements_map:
        a = agreements_map[ben.id]
        issue = ex.get("issue_date")
        if not (str(a.valid_from) <= str(issue) <= str(a.valid_to)):
            result.reason_codes.append("AGREEMENT_EXPIRED")
        elif amount != _amount(a.expected_amount):
            result.reason_codes.append("AGREEMENT_AMOUNT_MISMATCH")

    # R5-R7
    can_amount_rules = (
        amount is not None
        and ccy_ok
        and ex.get("currency") == base_ccy
        and "amount" not in invalid
        and bool(ex.get("issue_date"))
    )
    if can_amount_rules:
        result.rules_evaluated.extend(["R5", "R6", "R7"])
        if amount > _amount(policy.max_invoice_amount):
            result.reason_codes.append("ABOVE_MAX_INVOICE")
        period = str(ex["issue_date"])[:7]
        budget = _amount(policy.period_budget)
        reserved = reservations_by_period.get(period, Decimal("0"))
        remaining = budget - reserved
        if amount > remaining:
            result.reason_codes.append("BUDGET_EXCEEDED")
        if amount <= _amount(policy.max_invoice_amount) and amount > _amount(policy.approval_threshold):
            result.reason_codes.append("ABOVE_APPROVAL_THRESHOLD")

    # resultado y precedencia
    actions_map = rule_actions if rule_actions is not None else getattr(policy, "rule_actions", {}) or {}
    actions = {}
    for code in result.reason_codes:
        actions[code] = actions_map.get(code)
    if "BLOCKED" in actions.values():
        result.outcome = "BLOCKED"
    elif any(v == "NEEDS_HUMAN_APPROVAL" for v in actions.values()):
        result.outcome = "NEEDS_HUMAN_APPROVAL"
    else:
        result.outcome = "ELIGIBLE_SIMULATED"
        result.reason_codes = ["ALL_CHECKS_PASSED"]

    result.reserved_budget = result.outcome == "ELIGIBLE_SIMULATED"
    result.policy_version = policy.version
    return result
