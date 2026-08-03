from app.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    try:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        conn.execute(text("DROP TABLE IF EXISTS retake_requests"))
        conn.execute(text("ALTER TABLE test_attempts DROP COLUMN IF EXISTS is_retake"))
        conn.execute(text("ALTER TABLE test_attempts DROP COLUMN IF EXISTS retake_request_id"))
        conn.execute(text("ALTER TABLE test_attempts DROP COLUMN IF EXISTS original_attempt_slot"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
        conn.commit()
    except Exception as e:
        print(f"Error: {e}")
