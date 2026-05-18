# Oracle Entity Generator

Oracle 테이블 정보를 읽어서 Java JPA Entity를 생성하는 Python CLI 도구입니다.

기본 연결 정보와 출력 위치는 설정값으로 고정하고, 실행할 때는 보통 `username`, `password`, `table`만 입력합니다. 생성되는 `@Table`의 `schema`는 입력한 `username`을 기본값으로 사용합니다.

## 설치

```bash
python -m pip install -e .
python -m pip install -e ".[oracle,dev]"
```

`oracledb`는 실제 Oracle 접속이 필요할 때만 필요합니다.

## 기본 설정

환경 변수로 기본값을 바꿀 수 있습니다.

```text
ORACLE_HOST=localhost
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=XE
ORACLE_OUTPUT_DIR=generated
ORACLE_JAVA_PACKAGE=com.example.generated
```

## 사용법

DDL 조회:

```bash
python -m oracle_entity_generator ddl --username HR --table EMPLOYEES
```

메타데이터 기반 Entity 생성:

```bash
python -m oracle_entity_generator entity --username HR --table EMPLOYEES
```

DDL 저장과 Entity 생성을 함께 수행:

```bash
python -m oracle_entity_generator hybrid --username HR --table EMPLOYEES
```

Oracle 접속 없이 DDL 파일에서 Entity 생성:

```bash
python -m oracle_entity_generator from-ddl ./EMPLOYEES.sql --username HR
```

`--password`를 생략하면 실행 중 안전하게 입력받습니다. `--table`을 생략하면 테이블명도 입력받습니다.

## 생성 예시

입력 username이 `HR`이고 테이블명이 `EMPLOYEES`라면 다음 형태로 생성됩니다. `CREATED_BY`, `CREATED_AT`, `UPDATED_BY`, `UPDATED_AT` 같은 감사 컬럼은 `BaseAuditEntity`에서 관리한다고 보고 개별 Entity 필드에서는 제외합니다.

```java
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "EMPLOYEES", schema = "HR")
@Comment("직원 테이블")
public class Employees extends BaseAuditEntity {
    @Id
    @Column(name = "EMPLOYEE_ID", nullable = false)
    private Long employeeId;

    @Column(name = "FIRST_NAME")
    @Comment("이름")
    private String firstName;
}
```
