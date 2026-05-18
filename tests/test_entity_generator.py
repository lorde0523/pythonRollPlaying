from oracle_entity_generator.entity_generator import generate_entity
from oracle_entity_generator.models import ColumnMetadata, TableMetadata


def test_generate_entity_renders_jpa_entity_with_id_and_columns():
    table = TableMetadata(
        name="EMPLOYEES",
        columns=[
            ColumnMetadata("EMPLOYEE_ID", "NUMBER", None, 19, 0, False, is_primary_key=True),
            ColumnMetadata("FIRST_NAME", "VARCHAR2", 100, None, None, True),
            ColumnMetadata("CREATED_AT", "DATE", None, None, None, True),
        ],
    )

    source = generate_entity(table, package_name="com.example.generated")

    assert "package com.example.generated;" in source
    assert "@Entity" in source
    assert '@Table(name = "EMPLOYEES")' in source
    assert "public class Employees" in source
    assert "@Id" in source
    assert "private Long employeeId;" in source
    assert "private String firstName;" in source
    assert "private LocalDateTime createdAt;" in source
    assert "import java.time.LocalDateTime;" in source
