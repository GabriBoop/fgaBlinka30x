"""Parser determinista para etiquetas frecuentes en facturas en español."""
import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation


FIELD_LABELS = (
    r"beneficiario",
    r"proveedor",
    r"raz[oó]n\s+social",
    r"emisor",
    r"n[uú]mero\s+(?:de\s+)?factura",
    r"n[º°o.]?\s*(?:de\s+)?factura",
    r"no\.?\s*(?:de\s+)?factura",
    r"nro\.?\s*(?:de\s+)?factura",
    r"factura\s*(?:n[º°o.]?|no\.?|nro\.?|#)?",
    r"fecha\s+(?:de\s+)?(?:emisi[oó]n|expedici[oó]n|factura)",
    r"fecha\s+(?:de\s+)?vencimiento",
    r"fecha\s+l[ií]mite\s+de\s+pago",
    r"vencimiento",
    r"fecha",
    r"importe",
    r"total",
    r"valor\s+total",
    r"monto",
    r"total\s+a\s+pagar",
    r"moneda",
    r"currency",
    r"concepto",
    r"descripci[oó]n",
    r"description",
)
LABEL_BOUNDARY = (
    r"(?=\s+(?:" + "|".join(FIELD_LABELS) + r")(?:\s*[:#]\s*|\s)|$)"
)
NUMBER_PATTERN = re.compile(
    r"(?<![\w/])(?:\d{1,3}(?:[ .,'’]\d{3})+|\d+)(?:[,.]\d{1,2})?(?!\w)"
)
SUPPORTED_CURRENCIES = frozenset(
    {
        "ARS", "AUD", "BRL", "CAD", "CHF", "CLP", "CNY", "COP", "EUR",
        "GBP", "JPY", "MXN", "PEN", "USD", "UYU",
    }
)


@dataclass(frozen=True)
class ParsedInvoice:
    fields: dict[str, str | None]
    confidence: float
    source_type: str


def _labeled_value(text: str, labels: tuple[str, ...]) -> str | None:
    label_pattern = "|".join(labels)
    match = re.search(
        rf"(?<!\w)(?:{label_pattern})(?:\s*[:#]\s*|\s+)(.*?){LABEL_BOUNDARY}",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None
    value = " ".join(match.group(1).split()).strip(" \t\r\n:;,-")
    return value or None


def _parse_amount(value: str | None) -> str | None:
    if not value:
        return None
    match = NUMBER_PATTERN.search(value)
    if not match:
        return None

    raw_amount = match.group(0).replace(" ", "").replace("'", "").replace("’", "")
    last_dot = raw_amount.rfind(".")
    last_comma = raw_amount.rfind(",")
    last_separator = max(last_dot, last_comma)

    if last_dot >= 0 and last_comma >= 0:
        decimal_separator = "." if last_dot > last_comma else ","
        decimal_digits = len(raw_amount) - last_separator - 1
        if decimal_digits in (1, 2):
            thousands_separator = "," if decimal_separator == "." else "."
            normalized = raw_amount.replace(thousands_separator, "")
            normalized = normalized.replace(decimal_separator, ".")
        else:
            normalized = raw_amount.replace(".", "").replace(",", "")
    elif last_separator >= 0:
        decimal_digits = len(raw_amount) - last_separator - 1
        if decimal_digits in (1, 2):
            normalized = raw_amount.replace(",", ".")
        else:
            normalized = raw_amount.replace(".", "").replace(",", "")
    else:
        normalized = raw_amount

    try:
        return format(Decimal(normalized).quantize(Decimal("0.01")), ".2f")
    except InvalidOperation:
        return None


def _parse_currency(*values: str | None) -> str | None:
    for value in values:
        if not value:
            continue
        for match in re.finditer(r"(?<![A-Z])([A-Z]{3})(?![A-Z])", value.upper()):
            currency = match.group(1)
            if currency in SUPPORTED_CURRENCIES:
                return currency
    return None


def _parse_date(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"(?<!\d)(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/. -]\d{1,2}[/. -]\d{4})(?!\d)", value)
    if not match:
        return None
    raw_date = match.group(1)
    for date_format in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(raw_date, date_format).date().isoformat()
        except ValueError:
            continue
    return None


def _clean_beneficiary(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\s*\([A-Z]{2,10}-\d{2,10}\)\s*$", "", value).strip()
    return cleaned or None


def parse_invoice_text(raw_text: str, source_type: str) -> ParsedInvoice:
    """Extrae únicamente valores respaldados por etiquetas y texto explícitos."""
    beneficiary = _clean_beneficiary(
        _labeled_value(
            raw_text,
            (r"beneficiario", r"proveedor", r"raz[oó]n\s+social", r"emisor"),
        )
    )
    invoice_number = _labeled_value(
        raw_text,
        (
            r"n[uú]mero\s+(?:de\s+)?factura",
            r"n[º°o.]?\s*(?:de\s+)?factura",
            r"no\.?\s*(?:de\s+)?factura",
            r"nro\.?\s*(?:de\s+)?factura",
            r"(?<!de )factura\s*(?:n[º°o.]?|no\.?|nro\.?|#)?",
        ),
    )
    amount_text = _labeled_value(
        raw_text,
        (r"importe", r"total\s+a\s+pagar", r"valor\s+total", r"total", r"monto"),
    )
    currency_text = _labeled_value(raw_text, (r"moneda", r"currency"))
    issue_date_text = _labeled_value(
        raw_text,
        (
            r"fecha\s+(?:de\s+)?(?:emisi[oó]n|expedici[oó]n|factura)",
            r"fecha",
        ),
    )
    due_date_text = _labeled_value(
        raw_text,
        (
            r"fecha\s+(?:de\s+)?vencimiento",
            r"fecha\s+l[ií]mite\s+de\s+pago",
            r"vencimiento",
        ),
    )
    description = _labeled_value(
        raw_text,
        (r"concepto", r"descripci[oó]n", r"description"),
    )
    fields = {
        "beneficiary_name": beneficiary,
        "invoice_number": invoice_number,
        "amount": _parse_amount(amount_text),
        "currency": _parse_currency(currency_text, amount_text),
        "issue_date": _parse_date(issue_date_text),
        "due_date": _parse_date(due_date_text),
        "description": description[:140] if description else "",
    }
    required_fields = ("beneficiary_name", "invoice_number", "amount", "currency", "issue_date")
    confidence = sum(fields[name] is not None for name in required_fields) / len(required_fields)
    return ParsedInvoice(fields=fields, confidence=confidence, source_type=source_type)
