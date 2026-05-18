import json

from oracle_entity_generator.profiles import load_profiles, resolve_profile


def test_load_profiles_reads_numbered_json_profiles(tmp_path):
    profile_file = tmp_path / "oracle_profiles.json"
    profile_file.write_text(
        json.dumps(
            {
                "1": {
                    "name": "Local DB",
                    "username": "HR",
                }
            }
        ),
        encoding="utf-8",
    )

    profiles = load_profiles(profile_file)

    assert profiles["1"].name == "Local DB"
    assert profiles["1"].username == "HR"
    assert profiles["1"].label() == "Local DB (HR)"


def test_resolve_profile_returns_selected_profile():
    profiles = load_profiles(
        {
            "1": {
                "name": "Local DB",
                "username": "HR",
            }
        }
    )

    profile = resolve_profile(profiles, "1")

    assert profile.username == "HR"
