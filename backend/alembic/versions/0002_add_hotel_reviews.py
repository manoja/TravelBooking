"""Add hotel_reviews table

Revision ID: 0002_add_hotel_reviews
Revises: 0001_baseline_existing_schema
Create Date: 2026-10-23 11:35:14.944000+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0002_add_hotel_reviews"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hotel_reviews",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("hotel_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reservation_id", sa.BigInteger(), nullable=True),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("title", sa.String(150), nullable=True),
        sa.Column("review_text", sa.Text(), nullable=True),
        sa.Column("cleanliness_rating", sa.SmallInteger(), nullable=True),
        sa.Column("service_rating", sa.SmallInteger(), nullable=True),
        sa.Column("location_rating", sa.SmallInteger(), nullable=True),
        sa.Column("value_rating", sa.SmallInteger(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="published"),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("rating >= 1 AND rating <= 5"),
        sa.CheckConstraint("cleanliness_rating IS NULL OR (cleanliness_rating >= 1 AND cleanliness_rating <= 5)"),
        sa.CheckConstraint("service_rating IS NULL OR (service_rating >= 1 AND service_rating <= 5)"),
        sa.CheckConstraint("location_rating IS NULL OR (location_rating >= 1 AND location_rating <= 5)"),
        sa.CheckConstraint("value_rating IS NULL OR (value_rating >= 1 AND value_rating <= 5)"),
        sa.CheckConstraint("status IN ('pending', 'published', 'rejected')"),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reservation_id"], ["reservations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hotel_id", "user_id", name="uq_hotel_reviews_hotel_user"),
    )

    op.create_index(
        "idx_hotel_reviews_hotel_status",
        "hotel_reviews",
        ["hotel_id", "status"],
    )
    op.create_index(
        "idx_hotel_reviews_user",
        "hotel_reviews",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_hotel_reviews_user", table_name="hotel_reviews")
    op.drop_index("idx_hotel_reviews_hotel_status", table_name="hotel_reviews")
    op.drop_table("hotel_reviews")
