from sqlalchemy import String, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import JSON

from app.database import Base


class DecisionRecord(Base):
    __tablename__ = "decision_record"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoice.id"), nullable=False)
    policy_version: Mapped[int] = mapped_column(nullable=False)
    outcome: Mapped[str] = mapped_column(String, nullable=False)
    reason_codes: Mapped[list] = mapped_column(JSON, default=list)
    explanation: Mapped[str] = mapped_column(Text, nullable=True)
    rules_evaluated: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    invoice = relationship("Invoice", back_populates="decisions")
