"""Esquema inicial: tablas de políticas, beneficiarios, facturas, decisiones, reservas y revisión humana."""

from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_demo",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("currency_base", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "payment_policy",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("company_id", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=True),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("max_invoice_amount", sa.Numeric(asdecimal=False), nullable=False),
        sa.Column("approval_threshold", sa.Numeric(asdecimal=False), nullable=False),
        sa.Column("period_budget", sa.Numeric(asdecimal=False), nullable=False),
        sa.Column("period_type", sa.String(), nullable=False),
        sa.Column("period_basis", sa.String(), nullable=False),
        sa.Column("amount_tolerance_pct", sa.Numeric(asdecimal=False), nullable=True),
        sa.Column("min_extraction_confidence", sa.Float(), nullable=True),
        sa.Column("name_similarity_threshold", sa.Float(), nullable=True),
        sa.Column("possible_duplicate_date_window_days", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["company_demo.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "beneficiary",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("company_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("normalized_name", sa.String(), nullable=False),
        sa.Column("allowed", sa.Boolean(), nullable=True),
        sa.Column("reference_code", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["company_demo.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "agreement",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("company_id", sa.String(), nullable=False),
        sa.Column("beneficiary_id", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("expected_amount", sa.Numeric(asdecimal=False), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["beneficiary_id"], ["beneficiary.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["company_demo.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "invoice",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("company_id", sa.String(), nullable=False),
        sa.Column("beneficiary_id", sa.String(), nullable=True),
        sa.Column("invoice_number", sa.String(), nullable=True),
        sa.Column("amount", sa.Numeric(asdecimal=False), nullable=True),
        sa.Column("currency", sa.String(), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("file_hash", sa.String(), nullable=True),
        sa.Column("extraction_confidence", sa.Float(), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["beneficiary_id"], ["beneficiary.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["company_demo.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "decision_record",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("invoice_id", sa.String(), nullable=False),
        sa.Column("policy_version", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.String(), nullable=False),
        sa.Column("reason_codes", sa.JSON(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("rules_evaluated", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoice.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "human_review",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("invoice_id", sa.String(), nullable=False),
        sa.Column("reviewer_demo_id", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoice.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "budget_reservation",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("invoice_id", sa.String(), nullable=True),
        sa.Column("period_key", sa.String(), nullable=False),
        sa.Column("amount", sa.Numeric(asdecimal=False), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoice.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "rule_action",
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("policy_id", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["policy_id"], ["payment_policy.id"]),
        sa.PrimaryKeyConstraint("code"),
    )


def downgrade() -> None:
    op.drop_table("rule_action")
    op.drop_table("budget_reservation")
    op.drop_table("human_review")
    op.drop_table("decision_record")
    op.drop_table("invoice")
    op.drop_table("agreement")
    op.drop_table("beneficiary")
    op.drop_table("payment_policy")
    op.drop_table("company_demo")
