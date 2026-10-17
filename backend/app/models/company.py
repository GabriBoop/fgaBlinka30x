from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CompanyDemo(Base):
    __tablename__ = "company_demo"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    currency_base: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    policies = relationship("PaymentPolicy", back_populates="company", cascade="all, delete-orphan")
    beneficiaries = relationship("Beneficiary", back_populates="company", cascade="all, delete-orphan")
    agreements = relationship("Agreement", back_populates="company", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="company", cascade="all, delete-orphan")
