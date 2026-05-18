from oracle_entity_generator.naming import class_name_from_table, field_name_from_column


def test_class_name_from_table_converts_database_name_to_pascal_case():
    assert class_name_from_table("TB_EMPLOYEE_INFO") == "TbEmployeeInfo"


def test_field_name_from_column_converts_database_name_to_camel_case():
    assert field_name_from_column("EMPLOYEE_ID") == "employeeId"
