from oracle_entity_generator.ddl_parser import parse_create_table


def test_parse_create_table_extracts_columns_and_primary_key():
    ddl = """
    CREATE TABLE EMPLOYEES (
      EMPLOYEE_ID NUMBER(19,0) NOT NULL,
      FIRST_NAME VARCHAR2(100),
      SALARY NUMBER(12,2),
      CONSTRAINT EMP_PK PRIMARY KEY (EMPLOYEE_ID)
    )
    """

    table = parse_create_table(ddl)

    assert table.name == "EMPLOYEES"
    assert [column.name for column in table.columns] == ["EMPLOYEE_ID", "FIRST_NAME", "SALARY"]
    assert table.columns[0].data_type == "NUMBER"
    assert table.columns[0].data_precision == 19
    assert table.columns[0].data_scale == 0
    assert table.columns[0].nullable is False
    assert table.columns[0].is_primary_key is True
    assert table.columns[2].data_precision == 12
    assert table.columns[2].data_scale == 2


def test_parse_create_table_extracts_table_and_column_comments():
    ddl = """
    CREATE TABLE HR.EMPLOYEES (
      EMPLOYEE_ID NUMBER(19,0) NOT NULL,
      FIRST_NAME VARCHAR2(100),
      CONSTRAINT EMP_PK PRIMARY KEY (EMPLOYEE_ID)
    );

    COMMENT ON TABLE HR.EMPLOYEES IS '직원 테이블';
    COMMENT ON COLUMN HR.EMPLOYEES.EMPLOYEE_ID IS '직원 ID';
    COMMENT ON COLUMN HR.EMPLOYEES.FIRST_NAME IS '이름';
    """

    table = parse_create_table(ddl)

    assert table.comment == "직원 테이블"
    assert table.columns[0].comment == "직원 ID"
    assert table.columns[1].comment == "이름"
