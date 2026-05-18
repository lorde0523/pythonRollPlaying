from oracle_entity_generator.entity_generator import generate_entity
from oracle_entity_generator.models import ColumnMetadata, TableMetadata


def test_generate_entity_renders_jpa_entity_with_id_and_columns():
    table = TableMetadata(
        name="EMPLOYEES",
        owner="HR",
        comment="직원 테이블",
        columns=[
            ColumnMetadata("EMPLOYEE_ID", "NUMBER", None, 19, 0, False, is_primary_key=True),
            ColumnMetadata("FIRST_NAME", "VARCHAR2", 100, None, None, True, comment="이름"),
            ColumnMetadata("CREATED_AT", "DATE", None, None, None, True),
            ColumnMetadata("UPDATED_AT", "DATE", None, None, None, True),
        ],
    )

    source = generate_entity(table, package_name="com.example.generated")

    assert "package com.example.generated;" in source
    assert "import lombok.AccessLevel;" in source
    assert "import lombok.Getter;" in source
    assert "import lombok.NoArgsConstructor;" in source
    assert "import lombok.Setter;" in source
    assert "import org.hibernate.annotations.Comment;" in source
    assert "@Getter" in source
    assert "@Setter" in source
    assert "@NoArgsConstructor(access = AccessLevel.PROTECTED)" in source
    assert "@Entity" in source
    assert '@Table(name = "EMPLOYEES", schema = "HR")' in source
    assert '@Comment("직원 테이블")' in source
    assert "public class Employees extends BaseAuditEntity" in source
    assert "@Id" in source
    assert "private Long employeeId;" in source
    assert '@Comment("이름")' in source
    assert "private String firstName;" in source
    assert "private LocalDateTime createdAt;" not in source
    assert "private LocalDateTime updatedAt;" not in source
    assert "import java.time.LocalDateTime;" not in source
