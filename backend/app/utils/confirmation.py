import secrets


def new_confirmation_number() -> str:
    return f"TRV-{secrets.token_hex(5).upper()}"
