from app.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    try:
        res = conn.execute(text("SELECT is_retake FROM test_attempts LIMIT 1"))
        print("Column is_retake EXISTS")
    except Exception as e:
        print("Column is_retake MISSING")
