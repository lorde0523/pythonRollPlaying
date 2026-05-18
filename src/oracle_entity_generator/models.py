from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ColumnMetadata:
    name: str
    data_type: str
    data_length: int | None
    data_precision: int | None
    data_scale: int | None
    nullable: bool
    comment: str | None = None
    is_primary_key: bool = False


@dataclass(frozen=True)
class TableMetadata:
    name: str
    columns: list[ColumnMetadata] = field(default_factory=list)
    comment: str | None = None
    owner: str | None = None
