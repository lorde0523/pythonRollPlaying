from __future__ import annotations

from .models import TableMetadata
from .naming import class_name_from_table, field_name_from_column
from .type_mapper import java_type_for


def generate_entity(table: TableMetadata, package_name: str) -> str:
    fields = []
    imports = {"jakarta.persistence.Column", "jakarta.persistence.Entity", "jakarta.persistence.Table"}

    for column in table.columns:
        java_type = java_type_for(column)
        if column.is_primary_key:
            imports.add("jakarta.persistence.Id")
        if java_type == "LocalDateTime":
            imports.add("java.time.LocalDateTime")
        if java_type == "BigDecimal":
            imports.add("java.math.BigDecimal")

        fields.append(
            {
                "column_name": column.name,
                "field_name": field_name_from_column(column.name),
                "java_type": java_type,
                "is_primary_key": column.is_primary_key,
                "nullable": column.nullable,
            }
        )

    lines = [f"package {package_name};", ""]
    for import_name in sorted(imports):
        lines.append(f"import {import_name};")
    lines.extend(["", "@Entity", f'@Table(name = "{table.name}")', f"public class {class_name_from_table(table.name)} {{"])

    for field in fields:
        lines.append("")
        if field["is_primary_key"]:
            lines.append("    @Id")
        nullable_part = "" if field["nullable"] else ", nullable = false"
        lines.append(f'    @Column(name = "{field["column_name"]}"{nullable_part})')
        lines.append(f'    private {field["java_type"]} {field["field_name"]};')

    lines.extend(["", "}"])
    return "\n".join(lines) + "\n"
