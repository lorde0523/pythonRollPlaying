from __future__ import annotations

import argparse
import getpass
from pathlib import Path

from .config import load_config
from .ddl_parser import parse_create_table
from .entity_generator import generate_entity
from .naming import class_name_from_table
from .oracle_client import OracleClient


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="oracle-entity-generator")
    subparsers = parser.add_subparsers(dest="command", required=True)

    for command in ("ddl", "entity", "hybrid"):
        subparser = subparsers.add_parser(command)
        _add_connection_args(subparser)

    from_ddl = subparsers.add_parser("from-ddl")
    from_ddl.add_argument("ddl_file", type=Path)
    from_ddl.add_argument("--output", type=Path)
    from_ddl.add_argument("--package", dest="package_name")

    return parser


def _add_connection_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--username")
    parser.add_argument("--password")
    parser.add_argument("--table")
    parser.add_argument("--owner")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--package", dest="package_name")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    config = load_config()

    if args.command == "from-ddl":
        ddl = args.ddl_file.read_text(encoding="utf-8")
        table = parse_create_table(ddl)
        output_dir = args.output or config.output_dir
        package_name = args.package_name or config.java_package
        _write_entity(table, output_dir, package_name)
        return 0

    username = args.username or input("Username: ").strip()
    password = args.password or getpass.getpass("Password: ")
    table_name = (args.table or input("Table: ").strip()).upper()
    output_dir = args.output or config.output_dir
    package_name = args.package_name or config.java_package
    client = OracleClient(config, username, password)

    if args.command == "ddl":
        ddl = client.fetch_ddl(table_name, owner=args.owner)
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / f"{table_name}.sql").write_text(ddl, encoding="utf-8")
        print(ddl)
        return 0

    if args.command == "entity":
        table = client.inspect_table(table_name, owner=args.owner)
        _write_entity(table, output_dir, package_name)
        return 0

    if args.command == "hybrid":
        ddl = client.fetch_ddl(table_name, owner=args.owner)
        table = client.inspect_table(table_name, owner=args.owner)
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / f"{table_name}.sql").write_text(ddl, encoding="utf-8")
        _write_entity(table, output_dir, package_name)
        return 0

    parser.error(f"Unsupported command: {args.command}")
    return 2


def _write_entity(table, output_dir: Path, package_name: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    source = generate_entity(table, package_name)
    path = output_dir / f"{class_name_from_table(table.name)}.java"
    path.write_text(source, encoding="utf-8")
    print(path)
    return path
