from app.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    # We ignore errors to drop as much as possible
    commands = [
        "SET FOREIGN_KEY_CHECKS=0;",
        "DROP TABLE IF EXISTS retake_requests;",
        "ALTER TABLE test_attempts DROP FOREIGN KEY fk_test_attempts_retake_request_id;",
        "ALTER TABLE test_attempts DROP COLUMN retake_request_id;",
        "ALTER TABLE test_attempts DROP COLUMN is_retake;",
        "ALTER TABLE test_attempts DROP COLUMN original_attempt_slot;",
        "ALTER TABLE test_attempts ADD COLUMN final_attempt_slot INT GENERATED ALWAYS AS (CASE WHEN is_final = 1 THEN module_id ELSE NULL END) STORED;",
        "CREATE UNIQUE INDEX uq_test_attempt_final_user_module ON test_attempts (user_id, final_attempt_slot);",
        "SET FOREIGN_KEY_CHECKS=1;"
    ]
    for cmd in commands:
        try:
            conn.execute(text(cmd))
            print(f"Success: {cmd}")
        except Exception as e:
            print(f"Failed: {cmd} - {e}")
            
    conn.commit()
