"""Apply database migrations, adopting the original unversioned schema if present."""
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.database import engine

BASE = Path(__file__).resolve().parents[3]
LEGACY_TABLES = {
    "agreement",
    "beneficiary",
    "budget_reservation",
    "company_demo",
    "decision_record",
    "human_review",
    "invoice",
    "payment_policy",
    "rule_action",
}
LEGACY_INVOICE_COLUMNS = {
    "id",
    "company_id",
    "beneficiary_id",
    "invoice_number",
    "amount",
    "currency",
    "issue_date",
    "due_date",
    "description",
    "source_type",
    "file_name",
    "file_hash",
    "extraction_confidence",
    "raw_text",
    "status",
    "created_at",
}


def main() -> None:
    config = Config(str(BASE / "alembic.ini"))
    config.set_main_option("script_location", str(BASE / "migrations"))
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "alembic_version" not in tables and LEGACY_TABLES.issubset(tables):
        invoice_columns = {
            column["name"] for column in inspector.get_columns("invoice")
        }
        if LEGACY_INVOICE_COLUMNS.issubset(invoice_columns):
            command.stamp(config, "0001")

    command.upgrade(config, "head")


if __name__ == "__main__":
    main()
