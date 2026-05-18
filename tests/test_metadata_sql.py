from oracle_entity_generator.ddl_fetcher import build_get_ddl_sql
from oracle_entity_generator.metadata_inspector import (
    build_columns_sql,
    build_primary_keys_sql,
    build_table_comment_sql,
    rows_to_table_metadata,
)


def test_metadata_sql_uses_all_views_and_bind_variables():
    assert "ALL_TAB_COLUMNS" in build_columns_sql()
    assert ":owner" in build_columns_sql()
    assert ":table_name" in build_columns_sql()
    assert "ALL_CONSTRAINTS" in build_primary_keys_sql()
    assert "ALL_CONS_COLUMNS" in build_primary_keys_sql()
    assert "ALL_TAB_COMMENTS" in build_table_comment_sql()


def test_ddl_sql_uses_dbms_metadata_with_bind_variable():
    sql = build_get_ddl_sql()

    assert "DBMS_METADATA.GET_DDL" in sql
    assert "DBMS_METADATA.GET_DEPENDENT_DDL" in sql
    assert ":table_name" in sql
    assert ":owner" in sql


def test_rows_to_table_metadata_includes_table_comment():
    table = rows_to_table_metadata(
        "EMPLOYEES",
        [
            {
                "COLUMN_NAME": "EMPLOYEE_ID",
                "DATA_TYPE": "NUMBER",
                "DATA_LENGTH": None,
                "DATA_PRECISION": 19,
                "DATA_SCALE": 0,
                "NULLABLE": "N",
                "COMMENTS": "직원 ID",
            }
        ],
        {"EMPLOYEE_ID"},
        owner="HR",
        table_comment="직원 테이블",
    )

    assert table.comment == "직원 테이블"
    assert table.columns[0].comment == "직원 ID"
