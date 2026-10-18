from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RuleAction(Base):
    __tablename__ = "policy_rule_action"

    code: Mapped[str] = mapped_column(String, primary_key=True)
    policy_id: Mapped[str] = mapped_column(ForeignKey("payment_policy.id"), primary_key=True)
    action: Mapped[str] = mapped_column(String, nullable=False)

    policy = relationship("PaymentPolicy", back_populates="rule_actions")
