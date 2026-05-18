from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_PROPERTIES_PATH = Path("configs/oracle_entity_generator/oracle.properties")


@dataclass(frozen=True)
class OracleConfig:
    host: str = "test-db.example.com"
    port: int = 1521
    service_name: str = "ORCL"
    output_dir: Path = Path("generated")
    java_package: str = "com.example.generated"

    @property
    def dsn(self) -> str:
        return f"{self.host}:{self.port}/{self.service_name}"


def load_config(properties_file: Path = DEFAULT_PROPERTIES_PATH) -> OracleConfig:
    properties = _load_properties(properties_file)
    return OracleConfig(
        host=os.getenv("ORACLE_HOST", properties.get("ORACLE_HOST", "test-db.example.com")),
        port=int(os.getenv("ORACLE_PORT", properties.get("ORACLE_PORT", "1521"))),
        service_name=os.getenv("ORACLE_SERVICE_NAME", properties.get("ORACLE_SERVICE_NAME", "ORCL")),
        output_dir=Path(os.getenv("ORACLE_OUTPUT_DIR", properties.get("ORACLE_OUTPUT_DIR", "generated"))),
        java_package=os.getenv("ORACLE_JAVA_PACKAGE", properties.get("ORACLE_JAVA_PACKAGE", "com.example.generated")),
    )


def _load_properties(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    properties: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        properties[key.strip()] = value.strip()
    return properties
