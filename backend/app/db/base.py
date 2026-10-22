from sqlalchemy import JSON, BigInteger, DateTime, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase

# Match the Supabase column types on PostgreSQL while staying usable on SQLite in tests.
BigInt = BigInteger().with_variant(Integer(), "sqlite")
JsonB = JSON().with_variant(JSONB(), "postgresql")
TimestampTZ = DateTime(timezone=True)


class Base(DeclarativeBase):
    pass
