import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { createWorkbook } from "../src/workbook.mjs";

function sampleAnalysis() {
  return {
    selection: { screen: "UserPage", frontendFiles: ["UserPage.tsx"] },
    testCases: [
      {
        area: "Frontend",
        type: "UI",
        title: "UserPage 기본 렌더링 확인",
        steps: "/users/:id 화면에 접근한다.\n주요 UI 요소를 확인한다.",
        expected: "화면이 오류 없이 표시된다.",
        api: "",
      },
      {
        area: "Backend",
        type: "API",
        title: "POST /api/users/:id 정상 처리",
        steps: "유효한 요청을 전송한다.",
        expected: "성공 응답을 반환한다.",
        api: "POST /api/users/:id",
      },
      {
        area: "Backend",
        type: "Negative",
        title: "문서에 포함되지 않는 상세 케이스",
        steps: "잘못된 요청을 전송한다.",
        expected: "오류 응답을 반환한다.",
        api: "POST /api/users/:id",
      },
    ],
  };
}

test("creates a portable XLSX workbook with table, validation, and formatting", async (t) => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "testdoc-xlsx-"));
  t.after(() => fs.rm(temporaryDirectory, { recursive: true, force: true }));
  const output = path.join(temporaryDirectory, "test-document.xlsx");

  const result = await createWorkbook(sampleAnalysis(), output, { verify: true });
  assert.equal(result.caseCount, 2);
  assert.ok(result.inspection.includes('"statusValidation":"list"'));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(output);
  const sheet = workbook.getWorksheet("테스트 케이스");

  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, "테스트 케이스 실행 문서");
  assert.equal(sheet.getCell("A3").value, "선택 화면: UserPage  |  관련 프론트 파일: 1개");
  assert.equal(sheet.getCell("A5").value, "TC-001");
  assert.equal(sheet.getCell("D6").value, "경로.id = <입력값>\n요청 본문 = <JSON 입력>");
  assert.equal(sheet.getCell("G5").value, null);
  assert.equal(sheet.getCell("I5").value, "미실행");
  assert.equal(sheet.getCell("I5").dataValidation.type, "list");
  assert.deepEqual(sheet.getCell("I5").dataValidation.formulae, ['"미실행,성공,실패,확인 필요"']);
  assert.equal(sheet.getTable("ExecutionCasesTable").name, "ExecutionCasesTable");
  assert.equal(sheet.views[0].state, "frozen");
  assert.equal(sheet.views[0].xSplit, 2);
  assert.equal(sheet.views[0].ySplit, 4);
  assert.equal(sheet.conditionalFormattings.length, 1);
});
