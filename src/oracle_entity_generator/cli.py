from __future__ import annotations

import argparse
import getpass
from dataclasses import replace
from pathlib import Path

from .config import load_config
from .ddl_parser import parse_create_table
from .entity_generator import generate_entity
from .models import TableMetadata
from .naming import class_name_from_table
from .oracle_client import OracleClient
from .profiles import choose_profile, load_profiles


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="oracle-entity-generator")
    subparsers = parser.add_subparsers(dest="command", required=True)

    entity = subparsers.add_parser("entity")
    _add_profile_args(entity)
    entity.add_argument("--password")
    entity.add_argument("--table")
    entity.add_argument("--source", choices=["metadata", "ddl"], default="metadata")
    entity.add_argument("--owner")
    entity.add_argument("--output", type=Path)
    entity.add_argument("--package", dest="package_name")

    from_ddl = subparsers.add_parser("from-ddl")
    from_ddl.add_argument("ddl_file", type=Path)
    _add_profile_args(from_ddl)
    from_ddl.add_argument("--output", type=Path)
    from_ddl.add_argument("--package", dest="package_name")

    from_ddl_dir = subparsers.add_parser("from-ddl-dir")
    from_ddl_dir.add_argument("ddl_dir", type=Path)
    _add_profile_args(from_ddl_dir)
    from_ddl_dir.add_argument("--output", type=Path)
    from_ddl_dir.add_argument("--package", dest="package_name")

    return parser


def _add_profile_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--profile")
    parser.add_argument("--profiles-file", type=Path, default=Path("oracle_profiles.json"))


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    config = load_config()
    profiles = load_profiles(args.profiles_file)
    profile = choose_profile(profiles, args.profile)

    if args.command == "from-ddl":
        ddl = args.ddl_file.read_text(encoding="utf-8")
        table = _with_default_schema(parse_create_table(ddl), profile.username)
        output_dir = args.output or config.output_dir
        package_name = args.package_name or config.java_package
        _write_entity(table, output_dir, package_name)
        return 0

    if args.command == "from-ddl-dir":
        output_dir = args.output or config.output_dir
        package_name = args.package_name or config.java_package
        for ddl_file in sorted(args.ddl_dir.glob("*.sql")):
            table = _with_default_schema(parse_create_table(ddl_file.read_text(encoding="utf-8")), profile.username)
            _write_entity(table, output_dir, package_name)
        return 0

    if args.command == "entity":
        password = args.password or getpass.getpass("Password: ")
        table_name = (args.table or input("Table: ").strip()).upper()
        output_dir = args.output or config.output_dir
        package_name = args.package_name or config.java_package
        client = OracleClient(config, profile.username, password)
        if args.source == "metadata":
            table = client.inspect_table(table_name, owner=args.owner)
        else:
            table = _with_default_schema(parse_create_table(client.fetch_ddl_with_comments(table_name, owner=args.owner)), profile.username)
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


def _with_default_schema(table: TableMetadata, username: str) -> TableMetadata:
    if table.owner:
        return table
    return replace(table, owner=username.upper())
