from fastapi import APIRouter

from app.api.v1 import policy, beneficiaries, invoices

api_router = APIRouter()

api_router.include_router(policy.router, prefix="/policy", tags=["policy"])
api_router.include_router(beneficiaries.router, prefix="/beneficiaries", tags=["beneficiaries"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
