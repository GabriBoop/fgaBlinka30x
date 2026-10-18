from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PolicyChangeReason(Base):
    __tablename__ = "policy_change_reason"

    policy_id: Mapped[str] = mapped_column(ForeignKey("payment_policy.id"), primary_key=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
