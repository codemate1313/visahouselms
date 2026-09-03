from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.exam_module import MODULE_STATUSES, MODULE_TYPES
from app.schemas.assessment import QuestionCreate


def _optional_text(value: Optional[str]) -> Optional[str]:
    return value.strip() or None if value is not None else None


class ModuleCreate(BaseModel):
    module_type: str
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    instructions: Optional[str] = Field(default=None, max_length=20000)
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=600)
    show_onboarding_instructions: bool = Field(default=True)
    onboarding_instructions: Optional[list] = Field(default=None)
    source_module_ids: list[int] = Field(default_factory=list, max_length=4)

    @field_validator("module_type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in MODULE_TYPES:
            raise ValueError(f"module_type must be one of: {', '.join(MODULE_TYPES)}")
        return value

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        return value.strip()

    @field_validator("description", "instructions")
    @classmethod
    def clean_optional(cls, value: Optional[str]) -> Optional[str]:
        return _optional_text(value)

    @field_validator("source_module_ids")
    @classmethod
    def unique_positive_sources(cls, values: list[int]) -> list[int]:
        if any(value <= 0 for value in values):
            raise ValueError("source_module_ids must be positive")
        if len(values) != len(set(values)):
            raise ValueError("Each source module can be selected only once")
        return values

    @model_validator(mode="after")
    def validate_composite_sources(self):
        if self.module_type == "full_mock" and len(self.source_module_ids) != 4:
            raise ValueError(
                "Full Mock requires one completed Listening, Reading, Writing, and Speaking module"
            )
        if self.module_type == "final_test" and self.source_module_ids:
            raise ValueError(
                "Final Test is built from custom Reading, Listening, Writing, and Speaking uploads, not source modules"
            )
        if self.module_type not in {"full_mock", "final_test"} and self.source_module_ids:
            raise ValueError("Source modules are only used by Full Mock")
        return self


class ModuleUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    instructions: Optional[str] = Field(default=None, max_length=20000)
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=600)
    show_onboarding_instructions: Optional[bool] = Field(default=None)
    onboarding_instructions: Optional[list] = Field(default=None)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value is not None else None

    @field_validator("description", "instructions")
    @classmethod
    def clean_optional(cls, value: Optional[str]) -> Optional[str]:
        return _optional_text(value)

    @field_validator("duration_minutes")
    @classmethod
    def duration_cannot_be_null(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            raise ValueError("duration_minutes cannot be null")
        return value


class PartAiEvaluationUpdate(BaseModel):
    ai_evaluation_enabled: bool


class PartInstructionsUpdate(BaseModel):
    instructions: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("instructions")
    @classmethod
    def clean_instructions(cls, value: Optional[str]) -> Optional[str]:
        return _optional_text(value)


class ModuleStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in MODULE_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(MODULE_STATUSES)}")
        return value


class ModuleVisibilityUpdate(BaseModel):
    is_visible: bool


class ModuleDemoUpdate(BaseModel):
    is_demo: bool


class ModuleInstituteAssignment(BaseModel):
    institute_id: int = Field(gt=0)


class ModulePartQuestionBatch(BaseModel):
    part_id: int = Field(gt=0)
    part_heading: Optional[str] = Field(default=None, max_length=1000)
    instructions: Optional[str] = Field(default=None, max_length=1000)
    questions: list[QuestionCreate] = Field(default_factory=list, max_length=500)


class ModuleWideQuestionBatchCreate(BaseModel):
    source_type: str
    source_filename: Optional[str] = Field(default=None, max_length=255)
    parts: list[ModulePartQuestionBatch] = Field(min_length=1, max_length=20)

    @field_validator("source_type")
    @classmethod
    def valid_source(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"pdf", "csv", "xlsx", "xls", "excel"}:
            raise ValueError("source_type must be pdf, csv, or excel")
        return value


class TTSCreate(BaseModel):
    title: str = Field(default="Generated conversation", min_length=1, max_length=2000)
    conversation: str = Field(min_length=1, max_length=20000)
    voice: str = Field(default="en-GB", pattern=r"^en-(?:AU|CA|GB|IN|US)$")
    rate: str = Field(default="+0%", pattern=r"^[+-](?:[0-9]|[1-9][0-9]|100)%$")

    @field_validator("title", "conversation", "voice")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()


class SpeakingAvatarPreview(BaseModel):
    """Authoring-time request to hear a speaking prompt in the examiner voice."""

    prompt: str = Field(min_length=1, max_length=5000)
    examiner_id: Optional[str] = Field(default=None, max_length=50)

    @field_validator("prompt")
    @classmethod
    def clean_prompt(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("prompt must not be empty")
        return value

    @field_validator("examiner_id")
    @classmethod
    def clean_examiner(cls, value: Optional[str]) -> Optional[str]:
        return _optional_text(value)


class PartUpdate(BaseModel):
    # Part titles carry the candidate instructions for the section, so they are
    # capped like a paragraph rather than like a name.
    title: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    instructions: Optional[str] = Field(default=None, max_length=20000)
    audio_mode: Optional[str] = Field(default=None, max_length=50)
    answer_constraints: Optional[dict] = Field(default=None)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value is not None else None

    @field_validator("instructions")
    @classmethod
    def clean_instructions(cls, value: Optional[str]) -> Optional[str]:
        return _optional_text(value)
