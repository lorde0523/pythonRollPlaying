# Oracle Entity Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python CLI that asks for Oracle username, password, and table name, then supports DDL fetch, metadata-based Java Entity generation, and hybrid output.

**Architecture:** Runtime defaults live in a config file so users do not repeatedly pass host, port, service name, or output directory. Oracle-specific calls are isolated behind a client interface, while type mapping, DDL parsing, and Java rendering remain pure and testable.

**Tech Stack:** Python 3.11+, pytest, Jinja2, optional python-oracledb.

---

### Task 1: Package Skeleton

**Files:**
- Create: `pyproject.toml`
- Create: `README.md`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/oracle_entity_generator/__init__.py`

- [x] Create a minimal installable Python package with pytest configured.

### Task 2: Pure Domain Models And Type Mapping

**Files:**
- Create: `src/oracle_entity_generator/models.py`
- Create: `src/oracle_entity_generator/naming.py`
- Create: `src/oracle_entity_generator/type_mapper.py`
- Test: `tests/test_type_mapper.py`
- Test: `tests/test_naming.py`

- [x] Add dataclasses for table and column metadata.
- [x] Add Oracle-to-Java type mapping.
- [x] Add snake/upper case database name to Java class/field conversion.

### Task 3: Java Entity Rendering

**Files:**
- Create: `src/oracle_entity_generator/entity_generator.py`
- Create: `src/oracle_entity_generator/templates/entity.java.j2`
- Test: `tests/test_entity_generator.py`

- [x] Render JPA Entity Java source from metadata.

### Task 4: DDL Fetch And Metadata Inspection Interfaces

**Files:**
- Create: `src/oracle_entity_generator/config.py`
- Create: `src/oracle_entity_generator/oracle_client.py`
- Create: `src/oracle_entity_generator/metadata_inspector.py`
- Create: `src/oracle_entity_generator/ddl_fetcher.py`
- Test: `tests/test_metadata_sql.py`

- [x] Keep Oracle connection settings in defaults/config.
- [x] Build SQL for DDL and metadata lookup.
- [x] Import Oracle driver lazily so tests run without Oracle installed.

### Task 5: DDL File Parsing Mode

**Files:**
- Create: `src/oracle_entity_generator/ddl_parser.py`
- Test: `tests/test_ddl_parser.py`

- [x] Parse basic Oracle `CREATE TABLE` DDL into metadata for offline Entity generation.

### Task 6: CLI

**Files:**
- Create: `src/oracle_entity_generator/cli.py`
- Create: `src/oracle_entity_generator/__main__.py`
- Test: `tests/test_cli.py`

- [x] Add `ddl`, `entity`, `hybrid`, and `from-ddl` commands.
- [x] Prompt for username, password, and table if omitted.
- [x] Use config defaults for host, port, service, schema, output, and package.

### Task 7: Verification

**Files:**
- Modify: `README.md`

- [x] Run pytest.
- [x] Document usage and configuration.
