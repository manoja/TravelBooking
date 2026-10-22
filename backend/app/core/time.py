from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """SQLite (used in tests) returns naive datetimes; PostgreSQL TIMESTAMPTZ returns aware ones."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)
