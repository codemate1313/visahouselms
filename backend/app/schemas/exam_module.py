from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.exam_module import MODULE_STATUSES, MODULE_TYPES
from app.schemas.assessment import QuestionCreate


def _optional_text(value: Optional[str]) -> Optional[str]:
    return value.strip() or None if value is not None else None


class ModuleCreate(BaseModel):
    module_type: str
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    instructions: Optional[str] = Field(default=None, max_length=20000)

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


class ModuleUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    instructions: Optional[str] = Field(default=None, max_length=20000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value is not None else None

    @field_validator("description", "instructions")
    @classmethod
    def clean_optional(cls, value: Optional[str]) -> Optional[str]:
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


class ModuleQuestionBatchCreate(BaseModel):
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


class TTSCreate(BaseModel):
    title: str = Field(default="Generated conversation", min_length=1, max_length=200)
    conversation: str = Field(min_length=1, max_length=20000)
    voice: str = Field(default="en-GB-SoniaNeural", min_length=1, max_length=120)
    rate: str = Field(default="+0%", pattern=r"^[+-](?:[0-9]|[1-9][0-9]|100)%$")

    @field_validator("title", "conversation", "voice")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()
