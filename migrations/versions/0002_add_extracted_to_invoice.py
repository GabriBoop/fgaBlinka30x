"""Agrega columna JSON extracted a la tabla invoice."""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoice", sa.Column("extracted", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("invoice", "extracted")
