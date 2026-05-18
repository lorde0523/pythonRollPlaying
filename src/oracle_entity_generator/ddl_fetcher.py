from __future__ import annotations


def build_get_ddl_sql() -> str:
    return """
SELECT
    DBMS_METADATA.GET_DDL('TABLE', :table_name, :owner)
    || CHR(10)
    || COALESCE(DBMS_METADATA.GET_DEPENDENT_DDL('COMMENT', :table_name, :owner), '') AS DDL
FROM DUAL
""".strip()
