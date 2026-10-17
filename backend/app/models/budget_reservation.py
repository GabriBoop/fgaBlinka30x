from sqlalchemy import String, DateTime, Numeric, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BudgetReservation(Base):
    __tablename__ = "budget_reservation"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoice.id"), nullable=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("company_demo.id"), nullable=False)
    period_key: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False)
    currency: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="reserved")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    invoice = relationship("Invoice", back_populates="budget_reservations")
    company = relationship("CompanyDemo")
