from sqlalchemy import String, Date, DateTime, Numeric, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Agreement(Base):
    __tablename__ = "agreement"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("company_demo.id"), nullable=False)
    beneficiary_id: Mapped[str] = mapped_column(ForeignKey("beneficiary.id"), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    expected_amount: Mapped[float] = mapped_column(Numeric(asdecimal=False), nullable=False)
    currency: Mapped[str] = mapped_column(String, nullable=False)
    valid_from: Mapped[str] = mapped_column(Date, nullable=False)
    valid_to: Mapped[str] = mapped_column(Date, nullable=False)

    company = relationship("CompanyDemo", back_populates="agreements")
    beneficiary = relationship("Beneficiary", back_populates="agreements")
