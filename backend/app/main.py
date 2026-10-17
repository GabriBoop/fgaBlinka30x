from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
import app.models  # registra todos los modelos en Base.metadata
from app.api.v1.router import api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Agente Inteligente de Gestión de Facturas",
    description="API REST para el prototipo del agente de facturas (Fase 2). "
    "Datos 100% ficticios. No ejecuta pagos reales.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["salud"])
def health():
    return {"status": "ok"}
