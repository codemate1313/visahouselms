from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.core.crypto import decrypt_value, encrypt_value
from app.models.setting import Setting

# Keys whose values are Fernet-encrypted at rest and never returned by the API.
SECRET_KEYS = {"smtp.password", "fcm.service_account_json"}

SECRET_PLACEHOLDER = "********"


def get_setting(db: Session, key: str) -> Optional[str]:
    row = db.query(Setting).filter(Setting.key == key, Setting.institute_id.is_(None)).first()
    if row is None or row.value is None:
        return None
    return decrypt_value(row.value) if row.is_encrypted else row.value


def set_setting(db: Session, key: str, value: Optional[str]) -> None:
    row = db.query(Setting).filter(Setting.key == key, Setting.institute_id.is_(None)).first()
    is_secret = key in SECRET_KEYS
    stored = encrypt_value(value) if (is_secret and value) else value

    if row is None:
        row = Setting(key=key, value=stored, institute_id=None, is_encrypted=is_secret)
    else:
        row.value = stored
        row.is_encrypted = is_secret
    db.add(row)
    db.commit()


def get_settings_group(db: Session, prefix: str, mask_secrets: bool = True) -> Dict[str, Optional[str]]:
    """Return all global settings under `prefix.` keyed without the prefix.
    Secret values come back masked (or omitted-from-decryption) for API display."""
    rows = (
        db.query(Setting)
        .filter(Setting.key.like(f"{prefix}.%"), Setting.institute_id.is_(None))
        .all()
    )
    result: Dict[str, Optional[str]] = {}
    for row in rows:
        short_key = row.key[len(prefix) + 1 :]
        if row.key in SECRET_KEYS and mask_secrets:
            result[short_key] = SECRET_PLACEHOLDER if row.value else None
        elif row.is_encrypted:
            result[short_key] = decrypt_value(row.value) if row.value else None
        else:
            result[short_key] = row.value
    return result


def set_settings_group(db: Session, prefix: str, values: Dict[str, Optional[str]]) -> None:
    """Write a group of settings. Secret fields whose incoming value is the
    mask placeholder (or None) are left untouched so a form round-trip never
    wipes a stored secret."""
    for short_key, value in values.items():
        full_key = f"{prefix}.{short_key}"
        if full_key in SECRET_KEYS and (value is None or value == SECRET_PLACEHOLDER):
            continue
        set_setting(db, full_key, value)
