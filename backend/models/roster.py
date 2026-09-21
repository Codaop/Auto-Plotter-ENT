from datetime import datetime, timezone
from typing import Literal
import uuid

from pydantic import BaseModel, Field, field_validator, model_validator


DayName = Literal["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
ValidationLevel = Literal["ok", "warning", "error"]


class ClassSlot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    day: DayName
    start_time: str
    end_time: str
    course: str

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time(cls, value: str) -> str:
        try:
            datetime.strptime(value, "%H:%M")
        except ValueError as exc:
            raise ValueError("waktu harus memakai format HH:MM") from exc
        return value

    @model_validator(mode="after")
    def validate_range(self):
        if self.start_time >= self.end_time:
            raise ValueError("jam selesai harus setelah jam mulai")
        return self


class MemberSchedule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    division: str
    generation: str = Field(pattern=r"^[0-9]{2}$")
    source_file: str
    confidence: float = Field(ge=0, le=1)
    notes: list[str] = Field(default_factory=list)
    classes: list[ClassSlot] = Field(default_factory=list)


class ExtractionResponse(BaseModel):
    members: list[MemberSchedule]
    warnings: list[str] = Field(default_factory=list)


class PlotConfig(BaseModel):
    shift_duration_hours: int = Field(default=2, ge=1, le=4)
    operating_start: str = "07:00"
    operating_end: str = "18:00"
    active_days: list[DayName] = Field(
        default_factory=lambda: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
    )

    @field_validator("operating_start", "operating_end")
    @classmethod
    def validate_time(cls, value: str) -> str:
        try:
            datetime.strptime(value, "%H:%M")
        except ValueError as exc:
            raise ValueError("waktu harus memakai format HH:MM") from exc
        return value

    @model_validator(mode="after")
    def validate_range(self):
        if self.operating_start >= self.operating_end:
            raise ValueError("jam operasional selesai harus setelah jam mulai")
        if not self.active_days:
            raise ValueError("minimal satu hari aktif diperlukan")
        return self


class PlotRequest(BaseModel):
    batch_id: str
    schedules: list[MemberSchedule] = Field(min_length=1)
    config: PlotConfig


class PlotAssignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    day: DayName
    start_time: str
    end_time: str
    member_code: str
    division: str
    generation: str


class ValidationItem(BaseModel):
    level: ValidationLevel
    day: DayName | None = None
    message: str


class PlotResponse(BaseModel):
    assignments: list[PlotAssignment]
    validations: list[ValidationItem]
    divisions: list[str]
    required_divisions: list[str]
    missing_divisions: list[str]
    coverage_by_day: dict[str, list[str]]
    complete_days: list[DayName]
    export_ready: bool
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ExportRequest(BaseModel):
    batch_id: str
    plot: PlotResponse