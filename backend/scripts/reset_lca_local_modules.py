"""Reset local assessment modules and seed the current LanguageCert schema.

This is intentionally local-dev oriented. It removes existing assessment
modules and module attempt rows from the configured SQLite database, then
recreates the LCA practice modules, composites, and QA account/module access.

Usage:
    python scripts/reset_lca_local_modules.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, text  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.achievement import StudentBadge  # noqa: E402
from app.models.attempt import (  # noqa: E402
    AiEvaluation,
    AttemptAnswer,
    AttemptFlag,
    AttemptPartGrade,
    CourseModule,
    GradingQueueEntry,
    ReevaluationRequest,
    RetakeRequest,
    TestAttempt,
)
from app.models.exam_module import (  # noqa: E402
    ExamModule,
    ExamModuleAsset,
    ExamModulePart,
    ExamModuleQuestion,
    InstituteModule,
)
from app.models.notification import StudentNotification  # noqa: E402
from app.models.plan import plan_modules  # noqa: E402


def _ensure_local_database() -> None:
    database_url = settings.database_url
    if not database_url.startswith("sqlite"):
        raise RuntimeError(
            "Refusing to reset modules because DATABASE_URL is not SQLite. "
            "This script is for local test data only."
        )
    if "visahouselms-dev.db" not in database_url:
        raise RuntimeError(
            f"Refusing to reset modules for unexpected local database URL: {database_url}"
        )


def _reset_modules() -> None:
    db = SessionLocal()
    try:
        module_ids = [row[0] for row in db.query(ExamModule.id).all()]
        if not module_ids:
            print("No existing local modules found.")
            return

        attempt_ids = [
            row[0]
            for row in db.query(TestAttempt.id)
            .filter(TestAttempt.module_id.in_(module_ids))
            .all()
        ]

        if attempt_ids:
            db.query(TestAttempt).filter(TestAttempt.id.in_(attempt_ids)).update(
                {TestAttempt.retake_request_id: None}, synchronize_session=False
            )
            db.query(StudentBadge).filter(StudentBadge.attempt_id.in_(attempt_ids)).update(
                {StudentBadge.attempt_id: None}, synchronize_session=False
            )
            db.execute(delete(StudentNotification).where(StudentNotification.attempt_id.in_(attempt_ids)))
            db.execute(delete(AiEvaluation).where(AiEvaluation.attempt_id.in_(attempt_ids)))
            db.execute(delete(GradingQueueEntry).where(GradingQueueEntry.attempt_id.in_(attempt_ids)))
            db.execute(delete(ReevaluationRequest).where(ReevaluationRequest.attempt_id.in_(attempt_ids)))
            db.execute(delete(RetakeRequest).where(RetakeRequest.attempt_id.in_(attempt_ids)))
            db.execute(delete(AttemptFlag).where(AttemptFlag.attempt_id.in_(attempt_ids)))
            db.execute(delete(AttemptPartGrade).where(AttemptPartGrade.attempt_id.in_(attempt_ids)))
            db.execute(delete(AttemptAnswer).where(AttemptAnswer.attempt_id.in_(attempt_ids)))
            db.execute(delete(TestAttempt).where(TestAttempt.id.in_(attempt_ids)))

        db.execute(plan_modules.delete().where(plan_modules.c.module_id.in_(module_ids)))
        db.execute(delete(CourseModule).where(CourseModule.module_id.in_(module_ids)))
        db.execute(delete(InstituteModule).where(InstituteModule.module_id.in_(module_ids)))
        db.execute(delete(ExamModuleAsset).where(ExamModuleAsset.module_id.in_(module_ids)))
        part_ids = [
            row[0]
            for row in db.query(ExamModulePart.id)
            .filter(ExamModulePart.module_id.in_(module_ids))
            .all()
        ]
        if part_ids:
            db.execute(delete(ExamModuleQuestion).where(ExamModuleQuestion.part_id.in_(part_ids)))
            db.execute(delete(ExamModulePart).where(ExamModulePart.id.in_(part_ids)))
        db.execute(delete(ExamModule).where(ExamModule.id.in_(module_ids)))

        if db.bind and db.bind.dialect.name == "sqlite":
            has_sequence = db.execute(
                text("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'")
            ).first()
            if has_sequence:
                for table in (
                    "test_attempts",
                    "exam_module_assets",
                    "exam_module_questions",
                    "exam_module_parts",
                    "exam_modules",
                ):
                    db.execute(text("DELETE FROM sqlite_sequence WHERE name = :name"), {"name": table})

        db.commit()
        print(f"Removed {len(module_ids)} local module(s) and {len(attempt_ids)} attempt(s).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    _ensure_local_database()
    _reset_modules()

    from scripts import seed_lca_composite_modules, seed_lca_practice_modules, seed_test_credentials

    seed_lca_practice_modules.main()
    seed_lca_composite_modules.main()
    seed_test_credentials.main()


if __name__ == "__main__":
    main()
