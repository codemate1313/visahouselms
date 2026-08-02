from app.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    try:
        # Delete duplicate attempt (keep the one with the higher ID)
        conn.execute(text("""
            DELETE t1 FROM test_attempts t1
            INNER JOIN test_attempts t2 
            WHERE t1.id < t2.id AND t1.user_id = t2.user_id AND t1.module_id = t2.module_id
        """))
        print("Duplicates deleted.")
        
        # Drop columns and indices added by failed migration
        conn.execute(text("ALTER TABLE test_attempts DROP FOREIGN KEY fk_test_attempts_retake_request_id"))
    except Exception as e:
        print(f"FK drop error: {e}")
        
    try:
        conn.execute(text("ALTER TABLE test_attempts DROP COLUMN retake_request_id"))
    except Exception as e:
        print(f"Col retake_request_id drop error: {e}")
        
    try:
        conn.execute(text("ALTER TABLE test_attempts DROP COLUMN is_retake"))
    except Exception as e:
        print(f"Col is_retake drop error: {e}")
        
    try:
        conn.execute(text("ALTER TABLE test_attempts DROP COLUMN original_attempt_slot"))
    except Exception as e:
        print(f"Col original_attempt_slot drop error: {e}")
        
    try:
        conn.execute(text("DROP TABLE retake_requests"))
    except Exception as e:
        print(f"Table retake_requests drop error: {e}")
        
    conn.commit()
    print("Cleanup done.")
