from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_PROFILE_PATH = Path("configs/oracle_entity_generator/oracle_profiles.json")


@dataclass(frozen=True)
class OracleProfile:
    key: str
    name: str
    username: str

    def label(self) -> str:
        return f"{self.name} ({self.username})"


def load_profiles(source: Path | dict[str, Any] = DEFAULT_PROFILE_PATH) -> dict[str, OracleProfile]:
    data = _read_profile_data(source)
    return {
        str(key): OracleProfile(
            key=str(key),
            name=str(value["name"]),
            username=str(value["username"]).upper(),
        )
        for key, value in data.items()
    }


def resolve_profile(profiles: dict[str, OracleProfile], selected_key: str) -> OracleProfile:
    try:
        return profiles[selected_key]
    except KeyError as exc:
        available = ", ".join(sorted(profiles))
        raise ValueError(f"Unknown profile '{selected_key}'. Available profiles: {available}") from exc


def choose_profile(profiles: dict[str, OracleProfile], selected_key: str | None = None) -> OracleProfile:
    if selected_key:
        return resolve_profile(profiles, selected_key)

    print("Oracle profile:")
    for key in sorted(profiles, key=_sort_key):
        print(f"{key}. {profiles[key].label()}")

    selected = input("Select profile number: ").strip()
    return resolve_profile(profiles, selected)


def _read_profile_data(source: Path | dict[str, Any]) -> dict[str, Any]:
    if isinstance(source, dict):
        return source

    if not source.exists():
        raise FileNotFoundError(f"Profile file not found: {source}")

    return json.loads(source.read_text(encoding="utf-8"))


def _sort_key(value: str) -> tuple[int, str]:
    return (0, f"{int(value):09d}") if value.isdigit() else (1, value)
