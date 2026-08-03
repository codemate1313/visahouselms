from app.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    try:
        conn.execute(text("CREATE UNIQUE INDEX uq_test_attempt_final_user_module ON test_attempts (user_id, module_id)"))
    except Exception as e:
        print(f"Error recreating uq_test_attempt_final_user_module: {e}")
        
    try:
        conn.execute(text("ALTER TABLE test_attempts ADD COLUMN final_attempt_slot INT GENERATED ALWAYS AS (CASE WHEN is_final = 1 THEN module_id ELSE NULL END) STORED"))
    except Exception as e:
        print(f"Error recreating final_attempt_slot: {e}")
        
    try:
        conn.execute(text("CREATE UNIQUE INDEX uq_test_attempt_final_user_module ON test_attempts (user_id, final_attempt_slot)"))
    except Exception as e:
        print(f"Error recreating uq_test_attempt_final_user_module 2: {e}")
        
    conn.commit()
