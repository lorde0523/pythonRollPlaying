from __future__ import annotations

from .models import ColumnMetadata


def java_type_for(column: ColumnMetadata) -> str:
    data_type = column.data_type.upper()

    if data_type.startswith(("VARCHAR", "VARCHAR2", "NVARCHAR2", "CHAR", "NCHAR", "CLOB", "NCLOB")):
        return "String"
    if data_type.startswith(("DATE", "TIMESTAMP")):
        return "LocalDateTime"
    if data_type.startswith("BLOB") or data_type.startswith("RAW"):
        return "byte[]"
    if data_type.startswith("FLOAT") or data_type.startswith("BINARY_DOUBLE"):
        return "Double"
    if data_type.startswith("BINARY_FLOAT"):
        return "Float"
    if data_type.startswith("NUMBER"):
        return _number_type(column)
    return "String"


def _number_type(column: ColumnMetadata) -> str:
    precision = column.data_precision
    scale = column.data_scale

    if scale is not None and scale > 0:
        return "BigDecimal"
    if precision is None:
        return "BigDecimal"
    if precision <= 10:
        return "Integer"
    if precision <= 19:
        return "Long"
    return "BigDecimal"
