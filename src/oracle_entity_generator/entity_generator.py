from __future__ import annotations

from .models import TableMetadata
from .naming import class_name_from_table, field_name_from_column
from .type_mapper import java_type_for


AUDIT_COLUMN_NAMES = {
    "CREATED_BY",
    "CREATED_AT",
    "UPDATED_BY",
    "UPDATED_AT",
    "CREATE_USER",
    "CREATE_DATE",
    "UPDATE_USER",
    "UPDATE_DATE",
    "REG_ID",
    "REG_DT",
    "MOD_ID",
    "MOD_DT",
}


def generate_entity(table: TableMetadata, package_name: str) -> str:
    fields = []
    imports = {
        "jakarta.persistence.Column",
        "jakarta.persistence.Entity",
        "jakarta.persistence.Table",
        "lombok.AccessLevel",
        "lombok.Getter",
        "lombok.NoArgsConstructor",
        "lombok.Setter",
    }
    if table.comment:
        imports.add("org.hibernate.annotations.Comment")

    for column in table.columns:
        if column.name.upper() in AUDIT_COLUMN_NAMES:
            continue

        java_type = java_type_for(column)
        if column.comment:
            imports.add("org.hibernate.annotations.Comment")
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
                "comment": column.comment,
            }
        )

    lines = [f"package {package_name};", ""]
    for import_name in sorted(imports):
        lines.append(f"import {import_name};")
    table_annotation = f'@Table(name = "{table.name}")'
    if table.owner:
        table_annotation = f'@Table(name = "{table.name}", schema = "{table.owner}")'

    lines.extend(
        [
            "",
            "@Getter",
            "@Setter",
            "@NoArgsConstructor(access = AccessLevel.PROTECTED)",
            "@Entity",
            table_annotation,
            *( [f'@Comment("{table.comment}")'] if table.comment else [] ),
            f"public class {class_name_from_table(table.name)} extends BaseAuditEntity {{",
        ]
    )

    for field in fields:
        lines.append("")
        if field["is_primary_key"]:
            lines.append("    @Id")
        nullable_part = "" if field["nullable"] else ", nullable = false"
        lines.append(f'    @Column(name = "{field["column_name"]}"{nullable_part})')
        if field["comment"]:
            lines.append(f'    @Comment("{field["comment"]}")')
        lines.append(f'    private {field["java_type"]} {field["field_name"]};')

    lines.extend(["", "}"])
    return "\n".join(lines) + "\n"
