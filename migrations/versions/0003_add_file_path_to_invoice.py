"""Agrega columna file_path a la tabla invoice (Fase 4)."""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoice", sa.Column("file_path", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("invoice", "file_path")
