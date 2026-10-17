# Fase 1 — Catálogo de reglas y dataset de prueba

Empresa ficticia: **Orquídea Andina S.A.S.** · Moneda base: **USD** · Política **v1**.
Ningún componente de este documento ejecuta pagos. Todos los datos son inventados.

## 1. Estados de decisión

| Estado | Etiqueta en la interfaz | Significado | ¿Requiere persona? |
|---|---|---|---|
| `ELIGIBLE_SIMULATED` | Apta para pago simulado | Pasó todas las reglas. Reserva presupuesto. | No |
| `NEEDS_HUMAN_APPROVAL` | Requiere aprobación | Excepción prevista por la política o certeza insuficiente. No reserva presupuesto hasta que una persona la apruebe. | Sí |
| `BLOCKED` | Frenada | Condición que impide continuar. En el MVP una persona no puede forzarla a apta. | No (solo puede archivarla o confirmarla) |

**Jerarquía de seguridad** (si hay varios problemas gana el más seguro): `BLOCKED` > `NEEDS_HUMAN_APPROVAL` > `ELIGIBLE_SIMULATED`. Siempre se guardan **todos** los motivos.

## 2. Política v1 (parámetros)

| Parámetro | Valor |
|---|---|
| Máximo absoluto por factura | 5.000,00 USD |
| Umbral de aprobación humana | 1.000,00 USD |
| Presupuesto por periodo | 12.000,00 USD, mensual |
| Periodo de una factura | Mes de la **fecha de emisión** |
| Tolerancia de importe frente al acuerdo | 0 % (exacto) |
| Confianza mínima de extracción | 0,80 (no aplica a entrada manual) |
| Similitud mínima para "nombre ambiguo" | 0,85 |
| Ventana de fecha para posible duplicado | 0 días (misma fecha de emisión) |

Acciones configurables por motivo (valores por defecto): ver `data-demo/demo-config.json` → `policy.rule_actions`.

## 3. Reglas y precedencia

Se evalúan **todas** en este orden y se acumulan los motivos. Si un dato necesario falta, la regla queda como *no evaluada* (nunca se inventa el dato).

| # | Regla | Condición | Código de motivo | Resultado |
|---|---|---|---|---|
| R1 | Datos mínimos | Faltan beneficiario, nº de factura, importe, moneda o fecha de emisión | `MISSING_REQUIRED_FIELDS` | Humano |
| R1 | Coherencia | Importe ≤ 0 o vencimiento anterior a emisión | `INVALID_FIELD` | Humano |
| R1 | Confianza | Confianza de extracción < 0,80 | `LOW_EXTRACTION_CONFIDENCE` | Humano |
| R2 | Duplicado confirmado | Mismo beneficiario + nº de factura normalizado, **o** mismo hash de archivo | `DUPLICATE_CONFIRMED` | Frenada (enlaza la original) |
| R2 | Posible duplicado | Mismo beneficiario, importe, moneda y fecha de emisión pero distinto nº | `POSSIBLE_DUPLICATE` | Humano |
| R3 | Beneficiario no permitido | Registrado con `allowed = false` | `BENEFICIARY_NOT_ALLOWED` | Frenada |
| R3 | Beneficiario desconocido | Sin coincidencia en el registro | `BENEFICIARY_UNKNOWN` | Frenada |
| R3 | Nombre ambiguo | No idéntico tras normalizar, pero similitud ≥ 0,85 | `BENEFICIARY_NAME_AMBIGUOUS` | Humano |
| R4 | Moneda distinta | Moneda ≠ moneda de la política (sin conversión) | `CURRENCY_MISMATCH` | Humano |
| R4 | Acuerdo vencido | Fecha de emisión fuera de la vigencia del acuerdo | `AGREEMENT_EXPIRED` | Humano |
| R4 | Importe ≠ acuerdo | Importe distinto del esperado | `AGREEMENT_AMOUNT_MISMATCH` | Humano |
| R5 | Máximo absoluto | Importe > 5.000,00 | `ABOVE_MAX_INVOICE` | Frenada |
| R6 | Presupuesto | Importe > presupuesto restante del periodo | `BUDGET_EXCEEDED` | Frenada |
| R7 | Umbral humano | 1.000,00 < importe ≤ 5.000,00 (solo si no supera el máximo) | `ABOVE_APPROVAL_THRESHOLD` | Humano |
| — | Todo correcto | Ningún motivo anterior | `ALL_CHECKS_PASSED` | Apta |

Notas de aplicación:
- Un beneficiario sin acuerdo registrado hace que R4 sea *no aplicable* (no bloquea).
- R4 no se evalúa si el beneficiario no es coincidencia exacta.
- R5–R7 no se evalúan si falta el importe o la moneda no es la de la política.

## 4. Definiciones

- **Nombre normalizado:** minúsculas, sin tildes, sin puntos, otros signos como espacio, espacios colapsados (`S.A.S.` → `sas`).
- **Número de factura normalizado:** mayúsculas, sin espacios, guiones ni barras (`tc 8841` = `TC-8841`).
- **Presupuesto restante** = presupuesto del periodo − reservas del periodo. Solo reservan presupuesto las facturas `ELIGIBLE_SIMULATED` y las aprobadas por una persona.
- **Orden de procesamiento:** el presupuesto depende del orden; el dataset se procesa por `order`. La invariante que se debe cumplir siempre es que la suma de reservas nunca supere el presupuesto.

## 5. Datos demo

Todo en `data-demo/demo-config.json`.

- **8 beneficiarios:** 7 permitidos y 1 registrado pero no permitido (Eventos Horizonte). Categorías: insumos, tecnología, servicios generales, logística, consultoría, mantenimiento y eventos.
- **7 acuerdos** (uno vencido el 30/09/2026; Eventos Horizonte no tiene).
- **3 facturas históricas** (septiembre) para probar duplicados.
- **Estado inicial de presupuesto:** agosto 300,00 disponibles · septiembre 1.200,00 · octubre 12.000,00.

## 6. Dataset de prueba (26 facturas)

Totales esperados: **5 aptas · 10 frenadas · 11 requieren aprobación**.

| ID | Caso | Resultado esperado | Motivos |
|---|---|---|---|
| INV-001 | Factura válida | Apta | — |
| INV-002 | Factura válida (imagen) | Apta | — |
| INV-003 | Factura válida | Apta | — |
| INV-004 | Duplicada (nº idéntico a HIST-01) | Frenada | `DUPLICATE_CONFIRMED` |
| INV-005 | Duplicada por nº normalizado + varios motivos | Frenada | `DUPLICATE_CONFIRMED`, `ABOVE_APPROVAL_THRESHOLD` |
| INV-006 | Beneficiario nuevo | Frenada | `BENEFICIARY_UNKNOWN` |
| INV-007 | Beneficiario no permitido | Frenada | `BENEFICIARY_NOT_ALLOWED` |
| INV-008 | Importe ≠ acuerdo | Aprobación | `AGREEMENT_AMOUNT_MISMATCH` |
| INV-009 | Supera umbral humano | Aprobación | `ABOVE_APPROVAL_THRESHOLD` |
| INV-010 | Supera umbral humano | Aprobación | `ABOVE_APPROVAL_THRESHOLD` |
| INV-011 | Supera el máximo (coincide con acuerdo) | Frenada | `ABOVE_MAX_INVOICE` |
| INV-012 | Máximo + acuerdo inconsistente | Frenada | `AGREEMENT_AMOUNT_MISMATCH`, `ABOVE_MAX_INVOICE` |
| INV-013 | Correo sin importe | Aprobación | `MISSING_REQUIRED_FIELDS` |
| INV-014 | Moneda ilegible + OCR dudoso | Aprobación | `MISSING_REQUIRED_FIELDS`, `LOW_EXTRACTION_CONFIDENCE` |
| INV-015 | Datos completos, OCR dudoso | Aprobación | `LOW_EXTRACTION_CONFIDENCE` |
| INV-016 | Moneda EUR | Aprobación | `CURRENCY_MISMATCH` |
| INV-017 | Nombre escrito distinto | Aprobación | `BENEFICIARY_NAME_AMBIGUOUS` |
| INV-018 | Posible duplicado | Aprobación | `POSSIBLE_DUPLICATE` |
| INV-019 | Vencimiento anterior a emisión | Aprobación | `INVALID_FIELD` |
| INV-020 | Acuerdo vencido | Aprobación | `AGREEMENT_EXPIRED` |
| INV-021 | Simultáneas (primera, sep.) | Apta | — |
| INV-022 | Simultáneas (segunda, sep.) | Frenada | `BUDGET_EXCEEDED` |
| INV-023 | Presupuesto insuficiente (ago.) | Frenada | `BUDGET_EXCEEDED` |
| INV-024 | Factura válida (correo) | Apta | — |
| INV-025 | Combinación de problemas | Frenada | `LOW_EXTRACTION_CONFIDENCE`, `BENEFICIARY_UNKNOWN`, `ABOVE_MAX_INVOICE` |
| INV-026 | Duplicado detectado solo por hash | Frenada | `MISSING_REQUIRED_FIELDS`, `DUPLICATE_CONFIRMED` |

El detalle (explicaciones, facturas vinculadas, campos faltantes, reglas no evaluadas) está en `data-demo/expected-results.json`.

## 7. Escenarios de comportamiento (para las Fases 3 y 6)

| ID | Escenario | Resultado esperado |
|---|---|---|
| S-01 | Reevaluar INV-001 | Se añade un nuevo registro de decisión; no se duplica la factura ni la reserva (octubre sigue en 2.100,00 tras el lote). |
| S-02 | Persona de prueba aprueba INV-009 con justificación | Queda registrada la revisión; la decisión automática original se conserva; se reserva 1.450,00 en octubre re-comprobando presupuesto. |
| S-03 | Aprobar sin justificación | Rechazado por validación; no cambia nada. |
| S-04 | Intentar aprobar una factura `BLOCKED` | Rechazado: en el MVP solo se pueden resolver las `NEEDS_HUMAN_APPROVAL`. |
| S-05 | Rechazar INV-010 con justificación | Queda registrado el rechazo; no reserva presupuesto. |
| S-06 | Subir el umbral a 2.000 en la política v2 | Las decisiones anteriores siguen mostrando v1; solo las nuevas evaluaciones usan v2. |
| S-07 | INV-021 e INV-022 evaluadas en paralelo | Nunca quedan ambas aptas (suma 1.300 > 1.200 disponibles). |

## 8. Decisiones que tomé y conviene que valides

1. **Frenar vs. escalar:** frenan duplicado confirmado, beneficiario no permitido o desconocido, máximo superado y presupuesto agotado. Escalan datos dudosos, desajustes de acuerdo, moneda distinta y umbral. Se cambia en `rule_actions`.
2. **Hash idéntico = duplicado confirmado** (el plan lo trata como señal adicional; aquí basta por sí solo porque son los mismos bytes).
3. **Periodo por fecha de emisión**, no de vencimiento ni de recepción.
4. **Facturas por aprobar no reservan presupuesto** hasta que una persona las aprueba.
5. **Tolerancia de importe 0 %**, para que cualquier diferencia sea visible.
6. **Las facturas `BLOCKED` no se pueden forzar** a aptas en el MVP.
7. **Autonomía:** como el plan la define como "decididas correctamente sin intervención", propongo informar dos cifras: (a) decisiones correctas del agente (26/26 esperado) y (b) aptas automáticas (5/26 ≈ 19 %), junto con el número enviado a revisión (11).

## 9. Cómo verificar

```bash
cd data-demo
python3 -I verify_expected.py
```

Es una comprobación de consistencia de la Fase 1, no el motor definitivo (Fase 3). Resultado actual: **26/26 casos consistentes**; reservas finales: agosto 11.700,00 · septiembre 11.400,00 · octubre 2.100,00.
