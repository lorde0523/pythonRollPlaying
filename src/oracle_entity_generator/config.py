from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


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


def load_config() -> OracleConfig:
    return OracleConfig(
        host=os.getenv("ORACLE_HOST", "test-db.example.com"),
        port=int(os.getenv("ORACLE_PORT", "1521")),
        service_name=os.getenv("ORACLE_SERVICE_NAME", "ORCL"),
        output_dir=Path(os.getenv("ORACLE_OUTPUT_DIR", "generated")),
        java_package=os.getenv("ORACLE_JAVA_PACKAGE", "com.example.generated"),
    )
