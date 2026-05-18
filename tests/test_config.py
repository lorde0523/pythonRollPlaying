from oracle_entity_generator.config import DEFAULT_PROPERTIES_PATH, load_config


def test_load_config_reads_feature_properties_file(tmp_path):
    properties_file = tmp_path / "oracle.properties"
    properties_file.write_text(
        "\n".join(
            [
                "ORACLE_HOST=oracle.example.com",
                "ORACLE_PORT=1522",
                "ORACLE_SERVICE_NAME=APPDB",
                "ORACLE_OUTPUT_DIR=out/entities",
                "ORACLE_JAVA_PACKAGE=com.example.app",
            ]
        ),
        encoding="utf-8",
    )

    config = load_config(properties_file)

    assert config.dsn == "oracle.example.com:1522/APPDB"
    assert config.output_dir.as_posix() == "out/entities"
    assert config.java_package == "com.example.app"


def test_default_properties_path_is_feature_scoped():
    assert DEFAULT_PROPERTIES_PATH.as_posix() == "configs/oracle_entity_generator/oracle.properties"
