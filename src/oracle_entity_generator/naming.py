from __future__ import annotations


def _words(database_name: str) -> list[str]:
    return [part.lower() for part in database_name.strip('"').split("_") if part]


def class_name_from_table(table_name: str) -> str:
    return "".join(word.capitalize() for word in _words(table_name))


def field_name_from_column(column_name: str) -> str:
    words = _words(column_name)
    if not words:
        return ""
    return words[0] + "".join(word.capitalize() for word in words[1:])
