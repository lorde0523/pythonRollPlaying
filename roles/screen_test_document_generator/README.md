# Source Test Document Generator

프론트엔드와 백엔드 소스 경로를 정적 분석해 Excel 테스트 문서를 생성하는 명령행 도구입니다.

## 생성 내용

- 화면/컴포넌트, 폼 요소, 프론트 API 호출 탐지
- Express 계열, Python 웹 프레임워크, Spring, Go 라우트 탐지
- 화면, 입력 검증, API, 화면-API 연동 테스트 케이스 생성
- 테스트 실행에 사용할 Params 초안 생성
- 실제 결과와 화면 캡처 Evidence를 바로 기록할 수 있는 단일 Excel 시트

정적 분석 결과는 초안입니다. 동적으로 조합한 URL과 비즈니스 요구사항은 생성 후 검토해야 합니다.

## 실행

### 로컬 화면

```powershell
npm run web
```

브라우저에서 `http://127.0.0.1:4173`을 열고 프론트엔드 경로, 백엔드 경로, 대상 화면을 입력합니다. 생성이 끝나면 화면에서 Excel 파일을 바로 다운로드할 수 있습니다.

### 명령행

Node.js 20 이상과 `@oai/artifact-tool` 런타임이 필요합니다.

```powershell
npm run generate -- --frontend C:\path\to\frontend --backend C:\path\to\backend --screen UserPage --output outputs\test-document.xlsx
```

`--screen`에는 컴포넌트명(`UserPage`), 화면 파일(`src/pages/UserPage.tsx`), 라우트(`/users/:id`)를 입력할 수 있습니다. 선택된 화면에서 로컬 import를 재귀적으로 따라가 관련 컴포넌트·훅·API 모듈만 분석하고, 이 파일들이 호출하는 백엔드 라우트만 테스트 케이스에 포함합니다.

인자를 생략하면 경로를 대화형으로 입력받습니다.

```powershell
npm run generate
```

## 결과 시트

- `테스트 케이스`: 테스트 케이스, 입력 Params, 실행 방법, 기대/실제 결과, 화면 Evidence, 상태

## 테스트

```powershell
npm test
```

분석기는 소스를 읽기만 하며 빌드나 실행은 하지 않습니다. 사내 라우터나 API 클라이언트 규칙은 `src/analyzer.mjs`의 탐지 패턴으로 확장할 수 있습니다.
