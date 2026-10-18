"""Catálogo único de motivos configurables de la política."""

BLOCKED = "BLOCKED"
APPROVAL = "NEEDS_HUMAN_APPROVAL"

RULE_CATALOG = [
    {"code": "MISSING_REQUIRED_FIELDS", "rule": "R1", "label": "Campos obligatorios ausentes", "description": "Faltan datos necesarios para evaluar la factura.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": APPROVAL},
    {"code": "INVALID_FIELD", "rule": "R1", "label": "Dato inválido", "description": "Un importe o una fecha no cumple el formato esperado.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": APPROVAL},
    {"code": "LOW_EXTRACTION_CONFIDENCE", "rule": "R1", "label": "Baja confianza de extracción", "description": "La lectura automática del documento no alcanza el mínimo definido.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": APPROVAL},
    {"code": "DUPLICATE_CONFIRMED", "rule": "R2", "label": "Duplicado confirmado", "description": "La factura coincide con una ya registrada.", "allowed_actions": [BLOCKED], "default_action": BLOCKED},
    {"code": "POSSIBLE_DUPLICATE", "rule": "R2", "label": "Posible duplicado", "description": "La factura comparte señales relevantes con otra factura.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": APPROVAL},
    {"code": "BENEFICIARY_NOT_ALLOWED", "rule": "R3", "label": "Beneficiario no permitido", "description": "El proveedor existe, pero no está autorizado.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": BLOCKED},
    {"code": "BENEFICIARY_UNKNOWN", "rule": "R3", "label": "Beneficiario desconocido", "description": "No se encontró un proveedor compatible.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": BLOCKED},
    {"code": "BENEFICIARY_NAME_AMBIGUOUS", "rule": "R3", "label": "Beneficiario ambiguo", "description": "Hay una coincidencia posible, pero no suficiente para confirmarla.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": APPROVAL},
    {"code": "CURRENCY_MISMATCH", "rule": "R4", "label": "Moneda distinta", "description": "La factura no usa la moneda base de la política.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": APPROVAL},
    {"code": "AGREEMENT_EXPIRED", "rule": "R4", "label": "Acuerdo vencido", "description": "El acuerdo del proveedor no está vigente en la fecha de emisión.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": APPROVAL},
    {"code": "AGREEMENT_AMOUNT_MISMATCH", "rule": "R4", "label": "Importe fuera del acuerdo", "description": "El importe no coincide con el valor pactado.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": APPROVAL},
    {"code": "ABOVE_MAX_INVOICE", "rule": "R5", "label": "Supera máximo por factura", "description": "El importe excede el máximo permitido.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": BLOCKED},
    {"code": "BUDGET_EXCEEDED", "rule": "R6", "label": "Supera presupuesto", "description": "El importe excede el presupuesto disponible del periodo.", "allowed_actions": [BLOCKED, APPROVAL], "default_action": BLOCKED},
    {"code": "ABOVE_APPROVAL_THRESHOLD", "rule": "R7", "label": "Supera umbral de aprobación", "description": "La factura necesita aprobación humana por su importe.", "allowed_actions": [APPROVAL], "default_action": APPROVAL},
]
