from pydantic import BaseModel, field_validator


class AnswerItem(BaseModel):
    question_id: int
    selected_option: str
    explanation: str

    @field_validator("selected_option")
    @classmethod
    def validate_option(cls, v: str) -> str:
        if v not in ("A", "B", "C", "D"):
            raise ValueError("selected_option must be A, B, C, or D")
        return v

    @field_validator("explanation")
    @classmethod
    def validate_explanation(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("explanation must not be empty")
        return v.strip()


class SubmitRequest(BaseModel):
    session_id: str
    answers: list[AnswerItem]
