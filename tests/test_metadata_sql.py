from oracle_entity_generator.ddl_fetcher import build_get_ddl_sql
from oracle_entity_generator.metadata_inspector import build_columns_sql, build_primary_keys_sql


def test_metadata_sql_uses_all_views_and_bind_variables():
    assert "ALL_TAB_COLUMNS" in build_columns_sql()
    assert ":owner" in build_columns_sql()
    assert ":table_name" in build_columns_sql()
    assert "ALL_CONSTRAINTS" in build_primary_keys_sql()
    assert "ALL_CONS_COLUMNS" in build_primary_keys_sql()


def test_ddl_sql_uses_dbms_metadata_with_bind_variable():
    sql = build_get_ddl_sql()

    assert "DBMS_METADATA.GET_DDL" in sql
    assert ":table_name" in sql
    assert ":owner" in sql
