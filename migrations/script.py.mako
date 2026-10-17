"""${message}"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "${rev_id}"
down_revision = ${down_revision}
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
