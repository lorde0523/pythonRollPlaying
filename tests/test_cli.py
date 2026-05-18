from oracle_entity_generator.cli import _with_default_schema, build_parser
from oracle_entity_generator.models import TableMetadata


def test_cli_defaults_to_configured_connection_values():
    parser = build_parser()

    args = parser.parse_args(["entity", "--username", "HR", "--password", "secret", "--table", "EMPLOYEES"])

    assert args.command == "entity"
    assert args.username == "HR"
    assert args.password == "secret"
    assert args.table == "EMPLOYEES"
    assert args.output is None


def test_from_ddl_accepts_username_for_default_schema():
    parser = build_parser()

    args = parser.parse_args(["from-ddl", "EMPLOYEES.sql", "--username", "HR"])

    assert args.command == "from-ddl"
    assert args.username == "HR"


def test_with_default_schema_uses_username_when_table_owner_is_missing():
    table = _with_default_schema(TableMetadata(name="EMPLOYEES"), username="HR")

    assert table.owner == "HR"
