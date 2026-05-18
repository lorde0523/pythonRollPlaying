from oracle_entity_generator.cli import build_parser


def test_cli_defaults_to_configured_connection_values():
    parser = build_parser()

    args = parser.parse_args(["entity", "--username", "HR", "--password", "secret", "--table", "EMPLOYEES"])

    assert args.command == "entity"
    assert args.username == "HR"
    assert args.password == "secret"
    assert args.table == "EMPLOYEES"
    assert args.output is None
