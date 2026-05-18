from __future__ import annotations

from .models import ColumnMetadata, TableMetadata


def build_columns_sql() -> str:
    return """
SELECT
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.DATA_LENGTH,
    c.DATA_PRECISION,
    c.DATA_SCALE,
    c.NULLABLE,
    cc.COMMENTS
FROM ALL_TAB_COLUMNS c
LEFT JOIN ALL_COL_COMMENTS cc
    ON cc.OWNER = c.OWNER
   AND cc.TABLE_NAME = c.TABLE_NAME
   AND cc.COLUMN_NAME = c.COLUMN_NAME
WHERE c.OWNER = :owner
  AND c.TABLE_NAME = :table_name
ORDER BY c.COLUMN_ID
""".strip()


def build_primary_keys_sql() -> str:
    return """
SELECT cols.COLUMN_NAME
FROM ALL_CONSTRAINTS cons
JOIN ALL_CONS_COLUMNS cols
  ON cols.OWNER = cons.OWNER
 AND cols.CONSTRAINT_NAME = cons.CONSTRAINT_NAME
 AND cols.TABLE_NAME = cons.TABLE_NAME
WHERE cons.OWNER = :owner
  AND cons.TABLE_NAME = :table_name
  AND cons.CONSTRAINT_TYPE = 'P'
ORDER BY cols.POSITION
""".strip()


def build_table_comment_sql() -> str:
    return """
SELECT COMMENTS
FROM ALL_TAB_COMMENTS
WHERE OWNER = :owner
  AND TABLE_NAME = :table_name
""".strip()


def rows_to_table_metadata(
    table_name: str,
    rows: list[dict],
    primary_keys: set[str],
    owner: str | None = None,
    table_comment: str | None = None,
) -> TableMetadata:
    columns = [
        ColumnMetadata(
            name=row["COLUMN_NAME"],
            data_type=row["DATA_TYPE"],
            data_length=row.get("DATA_LENGTH"),
            data_precision=row.get("DATA_PRECISION"),
            data_scale=row.get("DATA_SCALE"),
            nullable=row.get("NULLABLE") == "Y",
            comment=row.get("COMMENTS"),
            is_primary_key=row["COLUMN_NAME"] in primary_keys,
        )
        for row in rows
    ]
    return TableMetadata(name=table_name, columns=columns, owner=owner, comment=table_comment)
