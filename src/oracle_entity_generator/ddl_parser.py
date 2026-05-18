from __future__ import annotations

import re

from .models import ColumnMetadata, TableMetadata


def parse_create_table(ddl: str) -> TableMetadata:
    match = re.search(r"CREATE\s+TABLE\s+(?:(?P<owner>\w+)\.)?(?P<table>\w+)\s*\((?P<body>.*)\)", ddl, re.IGNORECASE | re.DOTALL)
    if not match:
        raise ValueError("Only basic Oracle CREATE TABLE DDL is supported.")

    table_name = match.group("table").upper()
    parts = _split_top_level(match.group("body"))
    primary_keys = _primary_keys(parts)
    columns = []

    for part in parts:
        stripped = part.strip()
        if not stripped or _is_table_constraint(stripped):
            continue
        column = _parse_column(stripped, primary_keys)
        if column is not None:
            columns.append(column)

    table_comment = _table_comment(ddl, table_name)
    column_comments = _column_comments(ddl, table_name)
    columns = [
        ColumnMetadata(
            name=column.name,
            data_type=column.data_type,
            data_length=column.data_length,
            data_precision=column.data_precision,
            data_scale=column.data_scale,
            nullable=column.nullable,
            comment=column_comments.get(column.name),
            is_primary_key=column.is_primary_key,
        )
        for column in columns
    ]

    return TableMetadata(name=table_name, columns=columns, owner=match.group("owner"), comment=table_comment)


def _split_top_level(body: str) -> list[str]:
    parts = []
    current = []
    depth = 0
    for char in body:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    if current:
        parts.append("".join(current))
    return parts


def _primary_keys(parts: list[str]) -> set[str]:
    keys: set[str] = set()
    for part in parts:
        match = re.search(r"PRIMARY\s+KEY\s*\((?P<columns>[^)]+)\)", part, re.IGNORECASE)
        if match:
            keys.update(column.strip().strip('"').upper() for column in match.group("columns").split(","))
    return keys


def _is_table_constraint(part: str) -> bool:
    return bool(re.match(r"(CONSTRAINT\s+\w+\s+)?(PRIMARY|FOREIGN|UNIQUE|CHECK)\b", part, re.IGNORECASE))


def _parse_column(part: str, primary_keys: set[str]) -> ColumnMetadata | None:
    match = re.match(r'"?(?P<name>\w+)"?\s+(?P<type>\w+)(?:\((?P<args>[^)]+)\))?(?P<rest>.*)', part, re.IGNORECASE | re.DOTALL)
    if not match:
        return None

    name = match.group("name").upper()
    data_type = match.group("type").upper()
    args = match.group("args")
    rest = match.group("rest").upper()
    precision = None
    scale = None
    length = None

    if args:
        numbers = [int(value.strip()) for value in args.split(",") if value.strip().isdigit()]
        if data_type == "NUMBER":
            precision = numbers[0] if numbers else None
            scale = numbers[1] if len(numbers) > 1 else 0
        elif numbers:
            length = numbers[0]

    inline_primary = "PRIMARY KEY" in rest
    return ColumnMetadata(
        name=name,
        data_type=data_type,
        data_length=length,
        data_precision=precision,
        data_scale=scale,
        nullable="NOT NULL" not in rest and not inline_primary,
        is_primary_key=name in primary_keys or inline_primary,
    )


def _table_comment(ddl: str, table_name: str) -> str | None:
    pattern = rf"COMMENT\s+ON\s+TABLE\s+(?:(?:\"?\w+\"?)\.)?\"?{re.escape(table_name)}\"?\s+IS\s+'(?P<comment>(?:''|[^'])*)'"
    match = re.search(pattern, ddl, re.IGNORECASE)
    return _unescape_comment(match.group("comment")) if match else None


def _column_comments(ddl: str, table_name: str) -> dict[str, str]:
    pattern = rf"COMMENT\s+ON\s+COLUMN\s+(?:(?:\"?\w+\"?)\.)?\"?{re.escape(table_name)}\"?\.(?P<column>\"?\w+\"?)\s+IS\s+'(?P<comment>(?:''|[^'])*)'"
    return {
        match.group("column").strip('"').upper(): _unescape_comment(match.group("comment"))
        for match in re.finditer(pattern, ddl, re.IGNORECASE)
    }


def _unescape_comment(value: str) -> str:
    return value.replace("''", "'")
