"""Agrega company_id a las reservas de presupuesto."""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "budget_reservation",
        sa.Column("company_id", sa.String(), nullable=True),
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE budget_reservation AS reservation
            SET company_id = invoice.company_id
            FROM invoice
            WHERE reservation.invoice_id = invoice.id
              AND reservation.company_id IS NULL
            """
        )
    )

    unassigned_count = connection.execute(
        sa.text(
            "SELECT COUNT(*) FROM budget_reservation WHERE company_id IS NULL"
        )
    ).scalar_one()
    if unassigned_count:
        company_ids = connection.execute(
            sa.text("SELECT id FROM company_demo")
        ).scalars().all()
        if len(company_ids) != 1:
            raise RuntimeError(
                "Cannot migrate budget reservations without an invoice: "
                "expected exactly one company to assign."
            )
        connection.execute(
            sa.text(
                "UPDATE budget_reservation SET company_id = :company_id "
                "WHERE company_id IS NULL"
            ),
            {"company_id": company_ids[0]},
        )

    op.alter_column(
        "budget_reservation",
        "company_id",
        existing_type=sa.String(),
        nullable=False,
    )
    op.create_foreign_key(
        "fk_budget_reservation_company_id_company_demo",
        "budget_reservation",
        "company_demo",
        ["company_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_budget_reservation_company_id_company_demo",
        "budget_reservation",
        type_="foreignkey",
    )
    op.drop_column("budget_reservation", "company_id")
