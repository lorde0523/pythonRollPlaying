from __future__ import annotations

from collections.abc import Iterable

from .config import OracleConfig
from .ddl_fetcher import build_get_ddl_sql
from .metadata_inspector import build_columns_sql, build_primary_keys_sql, rows_to_table_metadata
from .models import TableMetadata


class OracleClient:
    def __init__(self, config: OracleConfig, username: str, password: str):
        self.config = config
        self.username = username
        self.password = password

    def _connect(self):
        try:
            import oracledb
        except ImportError as exc:
            raise RuntimeError("Install Oracle support with: python -m pip install -e \".[oracle]\"") from exc
        return oracledb.connect(user=self.username, password=self.password, dsn=self.config.dsn)

    def fetch_ddl(self, table_name: str, owner: str | None = None) -> str:
        bind_owner = (owner or self.username).upper()
        with self._connect() as connection:
            cursor = connection.cursor()
            cursor.execute(build_get_ddl_sql(), {"table_name": table_name.upper(), "owner": bind_owner})
            row = cursor.fetchone()
            if row is None:
                raise ValueError(f"Table not found: {bind_owner}.{table_name.upper()}")
            ddl = row[0]
            return ddl.read() if hasattr(ddl, "read") else str(ddl)

    def inspect_table(self, table_name: str, owner: str | None = None) -> TableMetadata:
        bind_owner = (owner or self.username).upper()
        bind_table = table_name.upper()
        with self._connect() as connection:
            column_rows = _fetch_dicts(connection, build_columns_sql(), {"owner": bind_owner, "table_name": bind_table})
            pk_rows = _fetch_dicts(connection, build_primary_keys_sql(), {"owner": bind_owner, "table_name": bind_table})
        if not column_rows:
            raise ValueError(f"Table not found: {bind_owner}.{bind_table}")
        primary_keys = {row["COLUMN_NAME"] for row in pk_rows}
        return rows_to_table_metadata(bind_table, column_rows, primary_keys, owner=bind_owner)


def _fetch_dicts(connection, sql: str, binds: dict) -> list[dict]:
    cursor = connection.cursor()
    cursor.execute(sql, binds)
    names = [description[0] for description in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]
