from oracle_entity_generator.models import ColumnMetadata
from oracle_entity_generator.type_mapper import java_type_for


def column(data_type, precision=None, scale=None):
    return ColumnMetadata(
        name="AMOUNT",
        data_type=data_type,
        data_length=None,
        data_precision=precision,
        data_scale=scale,
        nullable=True,
    )


def test_maps_common_oracle_text_and_datetime_types_to_java_types():
    assert java_type_for(column("VARCHAR2")) == "String"
    assert java_type_for(column("CLOB")) == "String"
    assert java_type_for(column("DATE")) == "LocalDateTime"
    assert java_type_for(column("TIMESTAMP(6)")) == "LocalDateTime"


def test_maps_number_precision_and_scale_to_java_types():
    assert java_type_for(column("NUMBER", precision=10, scale=0)) == "Integer"
    assert java_type_for(column("NUMBER", precision=19, scale=0)) == "Long"
    assert java_type_for(column("NUMBER", precision=12, scale=2)) == "BigDecimal"
