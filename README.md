# fgaBlinka30x — Agente inteligente para gestión de facturas

Prototipo web con un agente que recibe facturas simuladas, extrae sus datos, las compara con reglas de una empresa ficticia y emite una decisión:
- **Apta para pago (simulación)**
- **Frenada**
- **Requiere aprobación humana**

Datos 100% ficticios. No ejecuta pagos reales.

## Estado actual — Fase 4 completada

Backend con base de datos PostgreSQL (SQLAlchemy + Alembic), modelos de datos, esquemas Pydantic y API REST con FastAPI.
- **Fase 2:** CRUD de políticas, beneficiarios y facturas.
- **Fase 3:** motor determinista de reglas (R1–R7), endpoint `/evaluate`, registro de decisiones (`decision_record`) y control de presupuesto (`budget_reservation`).
- **Fase 4:** ingesta de documentos — `POST /invoices/upload` (PDF/imagen → texto con pypdf u OCR) y `POST /invoices/{id}/extract` (re-extracción), con creación de factura en `PENDING` para corrección humana de campos antes de evaluar.

## Estructura del repositorio

```text
fgaBlinka30x/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # App FastAPI
│   │   ├── database.py          # Engine, sesión y Base de SQLAlchemy
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       ├── policy.py            # CRUD y activación de políticas
│   │   │       ├── beneficiaries.py     # CRUD de beneficiarios
│   │   │       ├── invoices.py          # CRUD de facturas
│   │   │       ├── evaluate.py          # /evaluate y /decisions (Fase 3)
│   │   │       └── upload.py            # /upload y /extract (Fase 4)
│   │   ├── models/              # Modelos SQLAlchemy (todas las entidades del plan)
│   │   ├── schemas/             # Esquemas Pydantic (validación de entrada/salida)
│   │   ├── rules/               # Motor determinista de reglas (Fase 3)
│   │   ├── services/
│   │   │   ├── seed.py          # Carga de datos ficticios (Fase 1)
│   │   │   ├── evaluation.py    # Ejecutar motor y persistir decisión + reserva (Fase 3)
│   │   │   ├── extraction.py    # Extracción de texto de PDF/imagen (Fase 4)
│   │   │   └── ocr.py           # OCR con Tesseract (opcional, Fase 4)
│   │   └── tests/
│   │       ├── conftest.py
│   │       ├── test_crud.py
│   │       ├── test_evaluate.py
│   │       ├── test_rules.py
│   │       └── test_upload.py
├── data-demo/                 # Dataset y reglas de la Fase 1
│   ├── demo-config.json
│   ├── expected-results.json
│   ├── invoices/
│   │   └── invoices.json
│   ├── uploads/               # Archivos subidos (Fase 4, se crea al usar)
│   └── verify_expected.py
├── docs/
│   └── catalogo-reglas.md     # Catálogo de reglas y resultados esperados (Fase 1)
├── migrations/                # Migraciones de Alembic (PostgreSQL)
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       ├── 0001_initial_schema.py
│       ├── 0002_add_extracted_to_invoice.py
│       └── 0003_add_file_path_to_invoice.py
├── alembic.ini
├── docker-compose.yml         # PostgreSQL + backend
├── LICENSE
└── README.md
```

## Endpoints disponibles (Fases 2 a 4)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado del servicio |
| GET | `/api/v1/policy` | Política activa |
| PUT | `/api/v1/policy` | Crear nueva versión de política |
| POST | `/api/v1/policy/activate` | Activar una versión de política |
| GET | `/api/v1/beneficiaries` | Listar beneficiarios (filtro opcional `company_id`) |
| POST | `/api/v1/beneficiaries` | Crear beneficiario |
| GET | `/api/v1/invoices` | Listar facturas (filtros: `company_id`, `status`, `beneficiary_id`) |
| POST | `/api/v1/invoices` | Crear factura (entrada manual) |
| GET | `/api/v1/invoices/{id}` | Obtener una factura |
| PATCH | `/api/v1/invoices/{id}` | Actualizar factura (corregir campos extraídos) |
| POST | `/api/v1/invoices/upload` | Subir PDF/imagen, extraer texto y crear factura `PENDING` (Fase 4) |
| POST | `/api/v1/invoices/{id}/extract` | Re-ejecutar extracción sobre el archivo ya subido (Fase 4) |
| POST | `/api/v1/invoices/{id}/evaluate` | Aplicar reglas y registrar decisión (sin ejecutar pagos) (Fase 3) |
| GET | `/api/v1/invoices/{id}/decisions` | Historial de decisiones de una factura (Fase 3) |

Documentación interactiva automática: `http://localhost:8000/docs` (una vez levantado el backend).

## Cómo levantar el entorno

### Con Docker Compose (recomendado)

```bash
docker compose up -d
```

Levanta PostgreSQL y el backend. La documentación queda en `http://localhost:8000/docs`.

### Sin Docker

```bash
cd backend
pip install -r requirements.txt
# Configurar DATABASE_URL (por defecto apunta a localhost:5432/facturas_demo)
uvicorn app.main:app --reload
```

Luego ejecutar las migraciones:

```bash
alembic upgrade head
```

Y cargar los datos ficticios de la Fase 1:

```bash
PYTHONPATH=backend python -m app.services.seed
```

## Ejecutar pruebas

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

Las pruebas usan SQLite en memoria y cubren CRUD de beneficiarios, políticas y facturas.

## Próximos pasos (Fase 3)

Implementar el motor determinista de reglas (R1-R7), el endpoint `/evaluate` y el registro de decisiones (`decision_record`), siguiendo el orden de evaluación y la precedencia definidos en `docs/catalogo-reglas.md`.

## Licencia

MIT — ver `LICENSE`.
