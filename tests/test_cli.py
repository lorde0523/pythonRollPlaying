from oracle_entity_generator.cli import _with_default_schema, build_parser
from oracle_entity_generator.cli import main
from oracle_entity_generator.models import TableMetadata


def test_entity_command_uses_profile_and_source():
    parser = build_parser()

    args = parser.parse_args(["entity", "--profile", "1", "--source", "ddl", "--table", "EMPLOYEES"])

    assert args.command == "entity"
    assert args.profile == "1"
    assert args.source == "ddl"
    assert args.table == "EMPLOYEES"
    assert args.output is None


def test_from_ddl_accepts_profile_for_default_schema():
    parser = build_parser()

    args = parser.parse_args(["from-ddl", "EMPLOYEES.sql", "--profile", "1"])

    assert args.command == "from-ddl"
    assert args.profile == "1"


def test_from_ddl_dir_accepts_directory_and_profile():
    parser = build_parser()

    args = parser.parse_args(["from-ddl-dir", "ddl", "--profile", "1"])

    assert args.command == "from-ddl-dir"
    assert args.ddl_dir.name == "ddl"
    assert args.profile == "1"


def test_with_default_schema_uses_username_when_table_owner_is_missing():
    table = _with_default_schema(TableMetadata(name="EMPLOYEES"), username="HR")

    assert table.owner == "HR"


def test_from_ddl_dir_generates_entities_for_all_sql_files(tmp_path):
    profiles_file = tmp_path / "oracle_profiles.json"
    profiles_file.write_text(
        """
{
  "1": {
    "name": "Local DB",
    "username": "HR"
  }
}
""".strip(),
        encoding="utf-8",
    )
    ddl_dir = tmp_path / "ddl"
    ddl_dir.mkdir()
    output_dir = tmp_path / "generated"
    (ddl_dir / "EMPLOYEES.sql").write_text(
        "CREATE TABLE EMPLOYEES (EMPLOYEE_ID NUMBER(19,0) NOT NULL, CONSTRAINT EMP_PK PRIMARY KEY (EMPLOYEE_ID))",
        encoding="utf-8",
    )
    (ddl_dir / "DEPARTMENTS.sql").write_text(
        "CREATE TABLE DEPARTMENTS (DEPARTMENT_ID NUMBER(19,0) NOT NULL, CONSTRAINT DEPT_PK PRIMARY KEY (DEPARTMENT_ID))",
        encoding="utf-8",
    )

    exit_code = main(
        [
            "from-ddl-dir",
            str(ddl_dir),
            "--profile",
            "1",
            "--profiles-file",
            str(profiles_file),
            "--output",
            str(output_dir),
        ]
    )

    assert exit_code == 0
    assert (output_dir / "Employees.java").exists()
    assert (output_dir / "Departments.java").exists()
