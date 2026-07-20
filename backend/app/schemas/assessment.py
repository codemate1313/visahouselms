from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.assessment import (
    ASSESSMENT_STATUSES,
    ASSESSMENT_TYPES,
    IELTS_SECTIONS,
    QUESTION_DIFFICULTIES,
    QUESTION_TYPES,
)


def _optional_text(value: Optional[str]) -> Optional[str]:
    return value.strip() or None if value is not None else None


class QuestionBankCreate(BaseModel):
    course_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    section: str

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: Optional[str]) -> Optional[str]:
        return _optional_text(value)

    @field_validator("section")
    @classmethod
    def valid_section(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in IELTS_SECTIONS:
            raise ValueError(f"section must be one of: {', '.join(IELTS_SECTIONS)}")
        return value


class QuestionBankUpdate(BaseModel):
    course_id: Optional[int] = Field(default=None, gt=0)
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    section: Optional[str] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: Optional[str]) -> Optional[str]:
        return _optional_text(value)

    @field_validator("section")
    @classmethod
    def valid_section(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip().lower()
        if value not in IELTS_SECTIONS:
            raise ValueError(f"section must be one of: {', '.join(IELTS_SECTIONS)}")
        return value


class QuestionOption(BaseModel):
    key: str = Field(min_length=1, max_length=12)
    text: str = Field(min_length=1, max_length=2000)

    @field_validator("key")
    @classmethod
    def clean_key(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()


class QuestionCreate(BaseModel):
    question_type: str
    prompt: str = Field(min_length=1, max_length=20000)
    instructions: Optional[str] = Field(default=None, max_length=10000)
    passage: Optional[str] = Field(default=None, max_length=50000)
    options: list[QuestionOption] = Field(default_factory=list, max_length=26)
    correct_answers: list[str] = Field(default_factory=list, max_length=26)
    explanation: Optional[str] = Field(default=None, max_length=20000)
    points: Decimal = Field(default=Decimal("1"), gt=0, max_digits=6, decimal_places=2)
    difficulty: str = "medium"

    @field_validator("question_type")
    @classmethod
    def valid_question_type(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in QUESTION_TYPES:
            raise ValueError(f"question_type must be one of: {', '.join(QUESTION_TYPES)}")
        return value

    @field_validator("difficulty")
    @classmethod
    def valid_difficulty(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in QUESTION_DIFFICULTIES:
            raise ValueError(f"difficulty must be one of: {', '.join(QUESTION_DIFFICULTIES)}")
        return value

    @field_validator("prompt")
    @classmethod
    def clean_prompt(cls, value: str) -> str:
        return value.strip()

    @field_validator("instructions", "passage", "explanation")
    @classmethod
    def clean_optional_text(cls, value: Optional[str]) -> Optional[str]:
        return _optional_text(value)

    @field_validator("correct_answers")
    @classmethod
    def clean_answers(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(answer.strip().upper() for answer in value if answer.strip()))

    @model_validator(mode="after")
    def validate_answer_shape(self):
        option_types = {
            "mcq_single",
            "mcq_multiple",
            "true_false_not_given",
            "yes_no_not_given",
        }
        if self.question_type in option_types:
            if len(self.options) < 2:
                raise ValueError("Choice questions require at least two options")
            keys = [option.key for option in self.options]
            if len(keys) != len(set(keys)):
                raise ValueError("Option keys must be unique")
            if not self.correct_answers:
                raise ValueError("Choose at least one correct answer")
            if any(answer not in keys for answer in self.correct_answers):
                raise ValueError("Correct answers must match an option key")
            if self.question_type == "mcq_single" and len(self.correct_answers) != 1:
                raise ValueError("Single-choice MCQs require exactly one correct answer")
        if self.question_type in {"short_answer", "fill_blank"} and not self.correct_answers:
            raise ValueError("Auto-graded text questions require at least one accepted answer")
        return self


class QuestionBatchCreate(BaseModel):
    source_type: str
    source_filename: Optional[str] = Field(default=None, max_length=255)
    questions: list[QuestionCreate] = Field(min_length=1, max_length=500)

    @field_validator("source_type")
    @classmethod
    def valid_source(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"pdf", "csv"}:
            raise ValueError("source_type must be pdf or csv")
        return value


class AssessmentCreate(BaseModel):
    course_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    assessment_type: str = "practice"
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=600)
    instructions: Optional[str] = Field(default=None, max_length=10000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        return value.strip()

    @field_validator("description", "instructions")
    @classmethod
    def clean_optional(cls, value: Optional[str]) -> Optional[str]:
        return _optional_text(value)

    @field_validator("assessment_type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ASSESSMENT_TYPES:
            raise ValueError(f"assessment_type must be one of: {', '.join(ASSESSMENT_TYPES)}")
        return value


class AssessmentUpdate(AssessmentCreate):
    pass


class AssessmentStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ASSESSMENT_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(ASSESSMENT_STATUSES)}")
        return value


class AssessmentQuestionsSet(BaseModel):
    question_ids: list[int] = Field(max_length=500)

    @field_validator("question_ids")
    @classmethod
    def unique_ids(cls, value: list[int]) -> list[int]:
        if any(question_id <= 0 for question_id in value):
            raise ValueError("question_ids must be positive")
        if len(value) != len(set(value)):
            raise ValueError("question_ids cannot contain duplicates")
        return value
