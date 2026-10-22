"""Baseline for the existing Supabase schema (created manually in the SQL Editor).

Intentionally empty: run `alembic stamp 0001` once to mark the existing database as the baseline.
Future schema changes should be added as new revisions after this one.
"""

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
