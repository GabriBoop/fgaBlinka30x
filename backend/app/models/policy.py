from sqlalchemy import String, DateTime, Numeric, Boolean, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PaymentPolicy(Base):
    __tablename__ = "payment_policy"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("company_demo.id"), nullable=False)
    version: Mapped[int] = mapped_column(nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    currency: Mapped[str] = mapped_column(String, nullable=False)
    max_invoice_amount: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False)
    approval_threshold: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False)
    period_budget: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False)
    period_type: Mapped[str] = mapped_column(String, nullable=False)
    period_basis: Mapped[str] = mapped_column(String, nullable=False)
    amount_tolerance_pct: Mapped[float] = mapped_column(Numeric(asdecimal=False), default=0)
    min_extraction_confidence: Mapped[float] = mapped_column(default=0.80)
    name_similarity_threshold: Mapped[float] = mapped_column(default=0.85)
    possible_duplicate_date_window_days: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    company = relationship("CompanyDemo", back_populates="policies")
    rule_actions = relationship("RuleAction", back_populates="policy", cascade="all, delete-orphan")
