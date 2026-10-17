# fgaBlinka30x — Agente inteligente para gestión de facturas

Prototipo web con un agente que recibe facturas simuladas, extrae sus datos, las compara con reglas de una empresa ficticia y emite una decisión:
- **Apta para pago (simulación)**
- **Frenada**
- **Requiere aprobación humana**

Datos 100% ficticios. No ejecuta pagos reales.

## Estado actual — Fase 2 completada

Backend mínimo funcional: base de datos PostgreSQL (SQLAlchemy + Alembic), modelos de datos, esquemas Pydantic y API REST con FastAPI.

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
│   │   │       └── invoices.py          # CRUD de facturas
│   │   ├── models/              # Modelos SQLAlchemy (todas las entidades del plan)
│   │   ├── schemas/             # Esquemas Pydantic (validación de entrada/salida)
│   │   ├── rules/               # Motor determinista de reglas (Fase 3)
│   │   └── services/
│   │       └── seed.py          # Carga de datos ficticios (Fase 1)
│   └── tests/
│       ├── conftest.py
│       └── test_crud.py
├── data-demo/                 # Dataset y reglas de la Fase 1
│   ├── demo-config.json
│   ├── expected-results.json
│   ├── invoices/
│   │   └── invoices.json
│   └── verify_expected.py
├── docs/
│   └── catalogo-reglas.md     # Catálogo de reglas y resultados esperados (Fase 1)
├── migrations/                # Migraciones de Alembic (PostgreSQL)
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 0001_initial_schema.py
├── alembic.ini
├── docker-compose.yml         # PostgreSQL + backend
├── LICENSE
└── README.md
```

## Endpoints disponibles (Fase 2)

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
| PATCH | `/api/v1/invoices/{id}` | Actualizar factura |

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
