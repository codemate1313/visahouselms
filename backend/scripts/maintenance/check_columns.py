from app.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    res = conn.execute(text("SHOW COLUMNS FROM test_attempts"))
    for row in res:
        print(row[0])
    
    try:
        conn.execute(text("ALTER TABLE test_attempts DROP COLUMN is_retake"))
        print("Dropped is_retake")
    except Exception as e:
        print(f"Error dropping is_retake: {e}")
        
    try:
        conn.execute(text("ALTER TABLE test_attempts DROP COLUMN retake_request_id"))
        print("Dropped retake_request_id")
    except Exception as e:
        pass
        
    try:
        conn.execute(text("ALTER TABLE test_attempts DROP COLUMN original_attempt_slot"))
        print("Dropped original_attempt_slot")
    except Exception as e:
        pass
        
    conn.commit()
