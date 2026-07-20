from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.assessment import Assessment, AssessmentQuestion, Question, QuestionBank
from app.models.audit_log import AuditLog
from app.models.course import COURSE_ARCHIVED, Course
from app.models.user import User


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _audit(
    db: Session,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: int,
    ip: Optional[str],
    details: Optional[dict] = None,
) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=ip,
        )
    )


def _course_or_404(db: Session, course_id: int, editable: bool = False) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    if editable and course.status == COURSE_ARCHIVED:
        raise HTTPException(status_code=400, detail="Archived courses cannot receive new assessment content")
    return course


def _require_owner(actor: User, owner_id: int) -> None:
    if actor.id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the instructor who created this content can change it",
        )


def _bank_query(db: Session):
    return db.query(QuestionBank).options(
        joinedload(QuestionBank.course),
        joinedload(QuestionBank.created_by),
        selectinload(QuestionBank.questions),
    )


def _question_out(question: Question, include_answer: bool = True) -> dict:
    result = {
        "id": question.id,
        "bank_id": question.bank_id,
        "question_type": question.question_type,
        "prompt": question.prompt,
        "instructions": question.instructions,
        "passage": question.passage,
        "options": list(question.options or []),
        "explanation": question.explanation,
        "points": str(question.points),
        "difficulty": question.difficulty,
        "source_type": question.source_type,
        "source_filename": question.source_filename,
        "created_by_id": question.created_by_id,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
    }
    if include_answer:
        result["correct_answers"] = list(question.correct_answers or [])
    return result


def serialize_bank(bank: QuestionBank, include_questions: bool = False) -> dict:
    result = {
        "id": bank.id,
        "course_id": bank.course_id,
        "course_title": bank.course.title,
        "title": bank.title,
        "description": bank.description,
        "section": bank.section,
        "created_by_id": bank.created_by_id,
        "created_by_name": f"{bank.created_by.first_name} {bank.created_by.last_name}",
        "question_count": len(bank.questions),
        "created_at": bank.created_at,
        "updated_at": bank.updated_at,
    }
    if include_questions:
        result["questions"] = [_question_out(question) for question in bank.questions]
    return result


def list_banks(
    db: Session,
    search: Optional[str] = None,
    section: Optional[str] = None,
    course_id: Optional[int] = None,
    creator_id: Optional[int] = None,
) -> list[dict]:
    query = _bank_query(db)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(QuestionBank.title.ilike(term), QuestionBank.description.ilike(term)))
    if section:
        query = query.filter(QuestionBank.section == section)
    if course_id:
        query = query.filter(QuestionBank.course_id == course_id)
    if creator_id:
        query = query.filter(QuestionBank.created_by_id == creator_id)
    return [serialize_bank(bank) for bank in query.order_by(QuestionBank.updated_at.desc(), QuestionBank.created_at.desc()).all()]


def get_bank_or_404(db: Session, bank_id: int) -> QuestionBank:
    bank = _bank_query(db).filter(QuestionBank.id == bank_id).first()
    if bank is None:
        raise HTTPException(status_code=404, detail="Question bank not found")
    return bank


def create_bank(db: Session, actor: User, data: dict, ip: Optional[str]) -> dict:
    _course_or_404(db, data["course_id"], editable=True)
    bank = QuestionBank(**data, created_by_id=actor.id)
    db.add(bank)
    db.flush()
    _audit(db, actor, "question_bank.create", "question_bank", bank.id, ip, {"title": bank.title})
    db.commit()
    return serialize_bank(get_bank_or_404(db, bank.id), include_questions=True)


def update_bank(
    db: Session,
    actor: User,
    bank_id: int,
    data: dict,
    fields_set: set[str],
    ip: Optional[str],
) -> dict:
    bank = get_bank_or_404(db, bank_id)
    _require_owner(actor, bank.created_by_id)
    if "course_id" in fields_set and data.get("course_id") != bank.course_id:
        if bank.questions:
            raise HTTPException(status_code=400, detail="A non-empty question bank cannot be moved to another course")
        _course_or_404(db, data["course_id"], editable=True)
    for field in ("course_id", "title", "description", "section"):
        if field in fields_set:
            setattr(bank, field, data.get(field))
    db.add(bank)
    _audit(db, actor, "question_bank.update", "question_bank", bank.id, ip, {"fields": sorted(fields_set)})
    db.commit()
    return serialize_bank(get_bank_or_404(db, bank.id), include_questions=True)


def delete_bank(db: Session, actor: User, bank_id: int, ip: Optional[str]) -> None:
    bank = get_bank_or_404(db, bank_id)
    _require_owner(actor, bank.created_by_id)
    linked = (
        db.query(AssessmentQuestion)
        .join(Question)
        .filter(Question.bank_id == bank.id)
        .first()
    )
    if linked:
        raise HTTPException(status_code=400, detail="Remove this bank's questions from tests before deleting it")
    _audit(db, actor, "question_bank.delete", "question_bank", bank.id, ip, {"title": bank.title})
    db.delete(bank)
    db.commit()


def _create_question_record(
    bank: QuestionBank,
    actor: User,
    data: dict,
    source_type: str,
    source_filename: Optional[str],
) -> Question:
    return Question(
        bank_id=bank.id,
        question_type=data["question_type"],
        prompt=data["prompt"],
        instructions=data.get("instructions"),
        passage=data.get("passage"),
        options=[dict(option) for option in data.get("options", [])],
        correct_answers=list(data.get("correct_answers", [])),
        explanation=data.get("explanation"),
        points=data.get("points", 1),
        difficulty=data.get("difficulty", "medium"),
        source_type=source_type,
        source_filename=source_filename,
        created_by_id=actor.id,
    )


def add_question(db: Session, actor: User, bank_id: int, data: dict, ip: Optional[str]) -> dict:
    bank = get_bank_or_404(db, bank_id)
    _require_owner(actor, bank.created_by_id)
    _course_or_404(db, bank.course_id, editable=True)
    question = _create_question_record(bank, actor, data, "manual", None)
    db.add(question)
    db.flush()
    _audit(db, actor, "question.create", "question", question.id, ip, {"bank_id": bank.id})
    db.commit()
    db.refresh(question)
    return _question_out(question)


def import_questions(
    db: Session,
    actor: User,
    bank_id: int,
    questions: list[dict],
    source_type: str,
    source_filename: Optional[str],
    ip: Optional[str],
) -> list[dict]:
    bank = get_bank_or_404(db, bank_id)
    _require_owner(actor, bank.created_by_id)
    _course_or_404(db, bank.course_id, editable=True)
    records = [
        _create_question_record(bank, actor, question, source_type, source_filename)
        for question in questions
    ]
    db.add_all(records)
    db.flush()
    _audit(
        db,
        actor,
        "question.import",
        "question_bank",
        bank.id,
        ip,
        {"count": len(records), "source_type": source_type, "source_filename": source_filename},
    )
    db.commit()
    for record in records:
        db.refresh(record)
    return [_question_out(record) for record in records]


def _question_or_404(db: Session, bank_id: int, question_id: int) -> Question:
    question = db.query(Question).filter(Question.id == question_id, Question.bank_id == bank_id).first()
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


def _ensure_question_not_live(db: Session, question_id: int) -> None:
    live = (
        db.query(AssessmentQuestion)
        .join(Assessment)
        .filter(AssessmentQuestion.question_id == question_id, Assessment.status == "published")
        .first()
    )
    if live:
        raise HTTPException(status_code=400, detail="Questions in published tests cannot be changed")


def update_question(
    db: Session, actor: User, bank_id: int, question_id: int, data: dict, ip: Optional[str]
) -> dict:
    bank = get_bank_or_404(db, bank_id)
    _require_owner(actor, bank.created_by_id)
    question = _question_or_404(db, bank_id, question_id)
    _ensure_question_not_live(db, question.id)
    for field in (
        "question_type", "prompt", "instructions", "passage", "options",
        "correct_answers", "explanation", "points", "difficulty",
    ):
        value = data.get(field)
        if field == "options":
            value = [dict(option) for option in value]
        setattr(question, field, value)
    db.add(question)
    _audit(db, actor, "question.update", "question", question.id, ip, {"bank_id": bank.id})
    db.commit()
    db.refresh(question)
    return _question_out(question)


def delete_question(db: Session, actor: User, bank_id: int, question_id: int, ip: Optional[str]) -> None:
    bank = get_bank_or_404(db, bank_id)
    _require_owner(actor, bank.created_by_id)
    question = _question_or_404(db, bank_id, question_id)
    if db.query(AssessmentQuestion).filter(AssessmentQuestion.question_id == question.id).first():
        raise HTTPException(status_code=400, detail="Remove this question from all tests before deleting it")
    _audit(db, actor, "question.delete", "question", question.id, ip, {"bank_id": bank.id})
    db.delete(question)
    db.commit()


def list_course_questions(db: Session, course_id: int) -> list[dict]:
    _course_or_404(db, course_id)
    rows = (
        db.query(Question)
        .options(joinedload(Question.bank))
        .join(QuestionBank)
        .filter(QuestionBank.course_id == course_id)
        .order_by(QuestionBank.section, QuestionBank.title, Question.created_at)
        .all()
    )
    result = []
    for question in rows:
        item = _question_out(question)
        item["bank_title"] = question.bank.title
        item["section"] = question.bank.section
        result.append(item)
    return result


def _assessment_query(db: Session):
    return db.query(Assessment).options(
        joinedload(Assessment.course),
        joinedload(Assessment.created_by),
        selectinload(Assessment.question_links).joinedload(AssessmentQuestion.question).joinedload(Question.bank),
    )


def serialize_assessment(assessment: Assessment, include_questions: bool = False) -> dict:
    ordered_links = sorted(assessment.question_links, key=lambda link: link.sort_order)
    result = {
        "id": assessment.id,
        "course_id": assessment.course_id,
        "course_title": assessment.course.title,
        "title": assessment.title,
        "description": assessment.description,
        "assessment_type": assessment.assessment_type,
        "status": assessment.status,
        "duration_minutes": assessment.duration_minutes,
        "instructions": assessment.instructions,
        "created_by_id": assessment.created_by_id,
        "created_by_name": f"{assessment.created_by.first_name} {assessment.created_by.last_name}",
        "question_count": len(ordered_links),
        "total_points": str(sum((link.points_override or link.question.points) for link in ordered_links)),
        "published_at": assessment.published_at,
        "created_at": assessment.created_at,
        "updated_at": assessment.updated_at,
    }
    if include_questions:
        result["questions"] = []
        for link in ordered_links:
            item = _question_out(link.question)
            item.update({
                "link_id": link.id,
                "sort_order": link.sort_order,
                "points_override": str(link.points_override) if link.points_override is not None else None,
                "bank_title": link.question.bank.title,
                "section": link.question.bank.section,
            })
            result["questions"].append(item)
    return result


def list_assessments(
    db: Session,
    search: Optional[str] = None,
    course_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    creator_id: Optional[int] = None,
) -> list[dict]:
    query = _assessment_query(db)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(Assessment.title.ilike(term), Assessment.description.ilike(term)))
    if course_id:
        query = query.filter(Assessment.course_id == course_id)
    if status_filter:
        query = query.filter(Assessment.status == status_filter)
    if creator_id:
        query = query.filter(Assessment.created_by_id == creator_id)
    return [serialize_assessment(item) for item in query.order_by(Assessment.created_at.desc()).all()]


def get_assessment_or_404(db: Session, assessment_id: int) -> Assessment:
    assessment = _assessment_query(db).filter(Assessment.id == assessment_id).first()
    if assessment is None:
        raise HTTPException(status_code=404, detail="Test not found")
    return assessment


def create_assessment(db: Session, actor: User, data: dict, ip: Optional[str]) -> dict:
    _course_or_404(db, data["course_id"], editable=True)
    assessment = Assessment(**data, status="draft", created_by_id=actor.id)
    db.add(assessment)
    db.flush()
    _audit(db, actor, "assessment.create", "assessment", assessment.id, ip, {"title": assessment.title})
    db.commit()
    return serialize_assessment(get_assessment_or_404(db, assessment.id), include_questions=True)


def update_assessment(db: Session, actor: User, assessment_id: int, data: dict, ip: Optional[str]) -> dict:
    assessment = get_assessment_or_404(db, assessment_id)
    _require_owner(actor, assessment.created_by_id)
    if assessment.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft tests can be edited")
    if data["course_id"] != assessment.course_id and assessment.question_links:
        raise HTTPException(status_code=400, detail="Remove all test questions before changing its course")
    _course_or_404(db, data["course_id"], editable=True)
    for field in ("course_id", "title", "description", "assessment_type", "duration_minutes", "instructions"):
        setattr(assessment, field, data.get(field))
    db.add(assessment)
    _audit(db, actor, "assessment.update", "assessment", assessment.id, ip)
    db.commit()
    return serialize_assessment(get_assessment_or_404(db, assessment.id), include_questions=True)


def set_assessment_questions(
    db: Session, actor: User, assessment_id: int, question_ids: list[int], ip: Optional[str]
) -> dict:
    assessment = get_assessment_or_404(db, assessment_id)
    _require_owner(actor, assessment.created_by_id)
    if assessment.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft tests can be assembled")
    questions = []
    if question_ids:
        questions = (
            db.query(Question)
            .join(QuestionBank)
            .filter(Question.id.in_(question_ids), QuestionBank.course_id == assessment.course_id)
            .all()
        )
        by_id = {question.id: question for question in questions}
        missing = [question_id for question_id in question_ids if question_id not in by_id]
        if missing:
            raise HTTPException(status_code=400, detail="Every selected question must belong to the test course")
        questions = [by_id[question_id] for question_id in question_ids]
    db.query(AssessmentQuestion).filter(AssessmentQuestion.assessment_id == assessment.id).delete()
    db.flush()
    db.add_all([
        AssessmentQuestion(assessment_id=assessment.id, question_id=question.id, sort_order=index)
        for index, question in enumerate(questions)
    ])
    _audit(db, actor, "assessment.questions_set", "assessment", assessment.id, ip, {"count": len(questions)})
    db.commit()
    return serialize_assessment(get_assessment_or_404(db, assessment.id), include_questions=True)


def set_assessment_status(
    db: Session, actor: User, assessment_id: int, new_status: str, ip: Optional[str]
) -> dict:
    assessment = get_assessment_or_404(db, assessment_id)
    _require_owner(actor, assessment.created_by_id)
    if new_status == "published":
        if not assessment.question_links:
            raise HTTPException(status_code=400, detail="Add at least one question before publishing")
        assessment.status = "published"
        assessment.published_at = _now()
    elif new_status == "draft":
        assessment.status = "draft"
        assessment.published_at = None
    else:
        assessment.status = "archived"
    db.add(assessment)
    _audit(db, actor, f"assessment.{new_status}", "assessment", assessment.id, ip)
    db.commit()
    return serialize_assessment(get_assessment_or_404(db, assessment.id), include_questions=True)


def delete_assessment(db: Session, actor: User, assessment_id: int, ip: Optional[str]) -> None:
    assessment = get_assessment_or_404(db, assessment_id)
    _require_owner(actor, assessment.created_by_id)
    if assessment.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft tests can be deleted; archive published tests")
    _audit(db, actor, "assessment.delete", "assessment", assessment.id, ip, {"title": assessment.title})
    db.delete(assessment)
    db.commit()
