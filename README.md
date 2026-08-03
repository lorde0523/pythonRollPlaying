# Oracle Entity Generator

Oracle 테이블 DDL 또는 메타데이터를 읽어서 Java JPA Entity 파일을 생성하는 Python CLI 도구입니다.

Oracle 서버 접속 정보는 공통 설정으로 관리하고, `oracle_profiles.json`에는 구분용 `name`과 `username`만 등록합니다. 실행할 때는 프로필 번호와 테이블명만 선택하는 흐름을 기준으로 합니다. 비밀번호는 JSON에 저장하지 않고 실행 중 입력받습니다.

## Roles

- `Oracle Entity Generator` — 저장소 루트의 Python CLI. Oracle 테이블을 Java JPA Entity로 변환합니다.
- [`Screen Test Document Generator`](roles/screen_test_document_generator/README.md) — 프론트엔드·백엔드 경로와 대상 화면을 입력받아 관련 컴포넌트/API만 분석하고 실행용 Excel 테스트 문서를 생성하는 로컬 웹 도구입니다.

## 주요 기능

- Oracle 접속 후 메타데이터 기반 Entity 생성
- Oracle 접속 후 DDL 조회 결과를 파싱해서 Entity 생성
- Oracle 접속 없이 DDL 파일 1개로 Entity 생성
- Oracle 접속 없이 DDL 폴더 안의 모든 `.sql` 파일을 Entity로 일괄 생성
- Lombok `@Getter`, `@Setter`, `@NoArgsConstructor` 자동 추가
- `@Table(name = "...", schema = "...")` 자동 생성
- 테이블/컬럼 코멘트가 있으면 Hibernate `@Comment` 자동 추가
- 공통 감사 컬럼은 `BaseAuditEntity` 상속으로 처리하고 개별 필드 생성에서 제외

## 설치

```bash
python -m pip install -e .
```

실제 Oracle 접속과 테스트 실행까지 필요하면 옵션 의존성을 함께 설치합니다.

```bash
python -m pip install -e ".[oracle,dev]"
```

옵션 의존성:

```text
oracle -> oracledb 설치, 실제 Oracle 접속에 필요
dev    -> pytest 설치, 테스트 실행에 필요
```

## 프로필 설정

기능별 설정 폴더의 예시 파일을 복사해서 실제 설정 파일을 만듭니다.

```bash
copy configs\oracle_entity_generator\oracle.properties.example configs\oracle_entity_generator\oracle.properties
copy configs\oracle_entity_generator\oracle_profiles.json.example configs\oracle_entity_generator\oracle_profiles.json
```

예시:

```json
{
  "1": {
    "name": "Local Development DB",
    "username": "HR"
  },
  "2": {
    "name": "Test DB",
    "username": "APP_USER"
  }
}
```

`username`은 Oracle 접속 사용자명이며, 생성되는 Entity의 `schema` 기본값으로도 사용됩니다. 실제 `oracle_profiles.json`과 `oracle.properties`는 개인 설정이라서 Git 추적에서 제외됩니다.

## 공통 설정

공통 Oracle 서버 설정은 `configs/oracle_entity_generator/oracle.properties`에서 관리합니다.

```text
ORACLE_HOST=test-db.example.com
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=ORCL
ORACLE_OUTPUT_DIR=generated
ORACLE_JAVA_PACKAGE=com.example.generated
```

DSN은 내부적으로 다음 형태로 만들어집니다.

```text
{ORACLE_HOST}:{ORACLE_PORT}/{ORACLE_SERVICE_NAME}
```

예:

```text
test-db.example.com:1521/ORCL
```

## 명령어

### Oracle 메타데이터 기반 Entity 생성

가장 권장하는 방식입니다. Oracle 데이터 딕셔너리에서 컬럼, 타입, nullable, PK, 코멘트를 조회합니다.

```bash
python -m oracle_entity_generator entity --profile 1 --table EMPLOYEES --source metadata
```

`--source` 기본값은 `metadata`라서 생략할 수 있습니다.

```bash
python -m oracle_entity_generator entity --profile 1 --table EMPLOYEES
```

비밀번호는 실행 중 입력합니다.

```text
Password:
```

### Oracle DDL 기반 Entity 생성

Oracle에 접속한 뒤 `DBMS_METADATA.GET_DDL`로 DDL을 조회하고, 그 DDL을 파싱해서 Entity를 생성합니다. DDL 파일은 저장하지 않습니다.

```bash
python -m oracle_entity_generator entity --profile 1 --table EMPLOYEES --source ddl
```

### 단일 DDL 파일 기반 Entity 생성

Oracle 접속이 안 되는 상황에서는 DDL 파일을 직접 넣어서 Entity를 생성할 수 있습니다.

```bash
python -m oracle_entity_generator from-ddl ./ddl/EMPLOYEES.sql --profile 1
```

DDL 안에 schema가 없으면 선택한 profile의 `username`을 schema로 사용합니다.

### DDL 폴더 일괄 생성

폴더 안의 모든 `.sql` 파일을 읽어서 지정된 output 경로에 Entity를 생성합니다.

```bash
python -m oracle_entity_generator from-ddl-dir ./ddl --profile 1 --output ./generated
```

예:

```text
./ddl/EMPLOYEES.sql    -> ./generated/Employees.java
./ddl/DEPARTMENTS.sql  -> ./generated/Departments.java
```

## 입력 옵션

`entity` 명령 옵션:

```text
--profile        oracle_profiles.json의 프로필 번호
--profiles-file  프로필 JSON 경로. 기본값: configs/oracle_entity_generator/oracle_profiles.json
--properties-file 공통 설정 properties 경로. 기본값: configs/oracle_entity_generator/oracle.properties
--password       Oracle 비밀번호. 생략하면 프롬프트로 입력
--table          대상 테이블명. 생략하면 프롬프트로 입력
--source         metadata 또는 ddl. 기본값: metadata
--owner          조회할 테이블 owner. 생략하면 profile username 사용
--output         생성 파일 출력 경로. 생략하면 ORACLE_OUTPUT_DIR 사용
--package        Java package 이름. 생략하면 ORACLE_JAVA_PACKAGE 사용
```

`from-ddl` 명령 옵션:

```text
ddl_file         읽을 DDL 파일 경로
--profile        schema 기본값으로 사용할 프로필 번호
--profiles-file  프로필 JSON 경로
--properties-file 공통 설정 properties 경로
--output         생성 파일 출력 경로
--package        Java package 이름
```

`from-ddl-dir` 명령 옵션:

```text
ddl_dir          .sql 파일들이 있는 폴더
--profile        schema 기본값으로 사용할 프로필 번호
--profiles-file  프로필 JSON 경로
--properties-file 공통 설정 properties 경로
--output         생성 파일 출력 경로
--package        Java package 이름
```

`--profile`을 생략하면 CLI가 프로필 목록을 보여주고 번호를 입력받습니다.

```text
Oracle profile:
1. Local Development DB (HR)
2. Test DB (APP_USER)
Select profile number:
```

## 조회 방식

### 메타데이터 조회

`--source metadata`는 다음 Oracle 데이터 딕셔너리 뷰를 사용합니다.

```text
ALL_TAB_COLUMNS
ALL_TAB_COMMENTS
ALL_COL_COMMENTS
ALL_CONSTRAINTS
ALL_CONS_COLUMNS
```

### DDL 조회

`--source ddl`은 다음 Oracle 기능을 사용합니다.

```sql
DBMS_METADATA.GET_DDL('TABLE', :table_name, :owner)
DBMS_METADATA.GET_DEPENDENT_DDL('COMMENT', :table_name, :owner)
```

조회한 DDL은 파일로 저장하지 않고 바로 파싱해서 Entity 생성에 사용합니다. `COMMENT ON TABLE`, `COMMENT ON COLUMN` 문이 함께 있으면 `@Comment`도 생성합니다.

`--source metadata`와 `--source ddl`은 같은 테이블명, 컬럼 타입, PK, nullable, comment 정보를 얻을 수 있으면 같은 Entity를 생성합니다. 단, DDL 방식은 DDL 문자열 안에 comment 문이 포함되어 있어야 metadata 방식과 comment까지 동일해집니다.

## 생성되는 Entity 규칙

생성되는 Entity는 다음 어노테이션을 기본으로 사용합니다.

```java
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "TABLE_NAME", schema = "USERNAME")
public class TableName extends BaseAuditEntity {
}
```

테이블 코멘트가 있으면 클래스에 `@Comment`를 추가합니다.

```java
@Comment("직원 테이블")
```

컬럼 코멘트가 있으면 필드에 `@Comment`를 추가합니다.

```java
@Column(name = "FIRST_NAME")
@Comment("이름")
private String firstName;
```

PK 컬럼에는 `@Id`를 추가합니다.

```java
@Id
@Column(name = "EMPLOYEE_ID", nullable = false)
private Long employeeId;
```

nullable이 `N`인 컬럼은 `@Column(nullable = false)`로 생성합니다.

## BaseAuditEntity 처리

공통 감사 컬럼은 각 Entity에 필드로 만들지 않습니다. 대신 사용자가 프로젝트에 만들어 둘 `BaseAuditEntity`를 상속합니다.

```java
public class Employees extends BaseAuditEntity {
}
```

현재 제외되는 감사 컬럼명:

```text
CREATED_BY
CREATED_AT
UPDATED_BY
UPDATED_AT
CREATE_USER
CREATE_DATE
UPDATE_USER
UPDATE_DATE
REG_ID
REG_DT
MOD_ID
MOD_DT
```

## 타입 매핑

```text
VARCHAR, VARCHAR2, NVARCHAR2, CHAR, NCHAR, CLOB, NCLOB -> String
DATE, TIMESTAMP                                       -> LocalDateTime
BLOB, RAW                                            -> byte[]
FLOAT, BINARY_DOUBLE                                 -> Double
BINARY_FLOAT                                         -> Float
NUMBER(p, s), s > 0                                  -> BigDecimal
NUMBER, precision 없음                               -> BigDecimal
NUMBER(p, 0), p <= 10                                -> Integer
NUMBER(p, 0), p <= 19                                -> Long
NUMBER(p, 0), p > 19                                 -> BigDecimal
기타 타입                                             -> String
```

`LocalDateTime`과 `BigDecimal`이 사용될 때는 필요한 import를 자동으로 추가합니다.

## 생성 예시

입력 메타데이터:

```text
profile username : HR
table            : EMPLOYEES
comment          : 직원 테이블

EMPLOYEE_ID NUMBER(19,0) NOT NULL PK
FIRST_NAME  VARCHAR2(100) COMMENT '이름'
CREATED_AT  DATE
UPDATED_AT  DATE
```

생성 결과:

```java
package com.example.generated;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Comment;

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

`CREATED_AT`, `UPDATED_AT`은 감사 컬럼으로 판단되어 생성 결과에서 제외됩니다.

## 테스트

```bash
python -m pip install -e ".[dev]"
python -m pytest -q
```

테스트 범위:

```text
CLI 인자 파싱
프로필 JSON 로딩
프로필 기반 schema 기본값
DDL 파일 및 DDL 폴더 기반 생성
DDL 파싱
Oracle 메타데이터 SQL
Oracle 타입 -> Java 타입 매핑
Java Entity 생성 규칙
```

## 현재 제한 사항

- `@GeneratedValue`는 아직 자동 생성하지 않습니다.
- `BaseAuditEntity` 파일 자체는 생성하지 않습니다.
- DDL 파일 파싱은 기본적인 `CREATE TABLE (...)` 형태를 대상으로 합니다.
- FK 기반 연관관계 매핑은 아직 생성하지 않습니다.
- 클래스명 단수화는 하지 않고 테이블명을 PascalCase로 변환합니다. 예: `EMPLOYEES` -> `Employees`, `USER_NAME_DATA` -> `UserNameData`
- 필드명은 컬럼명을 camelCase로 변환합니다. 예: `USER_NAME_DATA` -> `userNameData`
