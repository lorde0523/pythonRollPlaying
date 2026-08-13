import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const SHEET_NAME = "테스트 케이스";
const FIRST_DATA_ROW = 5;
const MAX_EDITABLE_ROW = 500;

const COLORS = {
  navy: "#17365D",
  blue: "#2F75B5",
  lightBlue: "#D9EAF7",
  evidence: "#F2F2F2",
  green: "#E2F0D9",
  amber: "#FFF2CC",
  red: "#FCE4D6",
  border: "#D9E1F2",
  white: "#FFFFFF",
};

function argb(color) {
  return `FF${color.replace("#", "").toUpperCase()}`;
}

function solidFill(color) {
  return { type: "pattern", pattern: "solid", fgColor: { argb: argb(color) } };
}

function thinBorder(color = COLORS.border) {
  const edge = { style: "thin", color: { argb: argb(color) } };
  return { top: edge, right: edge, bottom: edge, left: edge };
}

function styleCells(sheet, startRow, endRow, startColumn, endColumn, style) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = sheet.getCell(row, column);
      if (style.fill) cell.fill = style.fill;
      if (style.font) cell.font = style.font;
      if (style.alignment) cell.alignment = style.alignment;
      if (style.border) cell.border = style.border;
    }
  }
}

function extractParams(api, type) {
  if (!api) {
    if (type === "Validation") return "입력값 = <테스트 값>";
    return "없음";
  }

  const [method = "", route = ""] = api.split(/\s+/, 2);
  const params = [];
  const pathParams = [...route.matchAll(/:([A-Za-z_][\w-]*)/g)].map((match) => match[1]);
  if (pathParams.length) {
    for (const name of pathParams) params.push(`경로.${name} = <입력값>`);
  }
  if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    params.push("요청 본문 = <JSON 입력>");
  }
  if (!params.length && route.includes("?")) params.push("쿼리 = <입력값>");
  return params.length ? params.join("\n") : "없음";
}

function simpleCases(analysis) {
  const allowedTypes = new Set(["UI", "Validation", "API", "E2E"]);
  return analysis.testCases
    .filter((item) => allowedTypes.has(item.type))
    .map((item, index) => {
      const screenRoute = item.type === "UI" ? item.steps.match(/(\/[^\s]+)\s*화면/)?.[1] : "";
      const paramSource = item.api || (screenRoute ? `GET ${screenRoute}` : "");
      return {
        id: `TC-${String(index + 1).padStart(3, "0")}`,
        area: item.area === "Frontend" ? "화면" : item.area === "Backend" ? "API" : "연동",
        title: screenRoute ? `${screenRoute} 화면 표시 확인` : item.title,
        params: extractParams(paramSource, item.type),
        steps: item.steps,
        expected: item.expected,
        actual: null,
        evidence: "화면 캡처 붙여넣기",
        status: "미실행",
      };
    });
}

function createExecutionSheet(workbook, analysis) {
  const sheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ state: "frozen", xSplit: 2, ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const cases = simpleCases(analysis);
  const lastDataRow = FIRST_DATA_ROW + Math.max(cases.length - 1, 0);

  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = "테스트 케이스 실행 문서";
  styleCells(sheet, 1, 1, 1, 9, {
    fill: solidFill(COLORS.navy),
    font: { bold: true, color: { argb: argb(COLORS.white) }, size: 16, name: "맑은 고딕" },
    alignment: { vertical: "middle", horizontal: "left" },
  });
  sheet.getRow(1).height = 32;

  sheet.mergeCells("A2:I2");
  sheet.getCell("A2").value = "입력값(파라미터)을 실제 사용값으로 수정한 뒤 테스트하고, 화면 증빙 칸에 캡처 이미지를 붙여 넣으세요.";
  styleCells(sheet, 2, 2, 1, 9, {
    fill: solidFill(COLORS.lightBlue),
    font: { color: { argb: argb(COLORS.navy) }, name: "맑은 고딕" },
    alignment: { vertical: "middle", horizontal: "left", wrapText: true },
  });
  sheet.getRow(2).height = 28;

  sheet.mergeCells("A3:I3");
  sheet.getCell("A3").value = `선택 화면: ${analysis.selection?.screen || "전체"}  |  관련 프론트 파일: ${analysis.selection?.frontendFiles?.length || 0}개`;
  styleCells(sheet, 3, 3, 1, 9, {
    fill: solidFill(COLORS.evidence),
    font: { bold: true, color: { argb: argb(COLORS.navy) }, name: "맑은 고딕" },
    alignment: { vertical: "middle", horizontal: "left" },
  });
  sheet.getRow(3).height = 24;

  const headers = ["ID", "구분", "테스트 케이스", "입력값(파라미터)", "실행 방법", "기대 결과", "실제 결과", "화면 증빙", "상태"];
  const rows = cases.map((item) => [
    item.id,
    item.area,
    item.title,
    item.params,
    item.steps,
    item.expected,
    item.actual,
    item.evidence,
    item.status,
  ]);

  if (cases.length) {
    sheet.addTable({
      name: "ExecutionCasesTable",
      ref: "A4",
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: headers.map((name) => ({ name, filterButton: true })),
      rows,
    });
  } else {
    sheet.getRow(4).values = headers;
  }

  styleCells(sheet, 4, 4, 1, 9, {
    fill: solidFill(COLORS.blue),
    font: { bold: true, color: { argb: argb(COLORS.white) }, name: "맑은 고딕" },
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    border: thinBorder(),
  });
  sheet.getRow(4).height = 28;

  if (cases.length) {
    styleCells(sheet, FIRST_DATA_ROW, lastDataRow, 1, 9, {
      font: { name: "맑은 고딕", size: 10 },
      alignment: { vertical: "top", horizontal: "left", wrapText: true },
      border: thinBorder(),
    });
    for (let row = FIRST_DATA_ROW; row <= lastDataRow; row += 1) {
      sheet.getRow(row).height = 72;
      sheet.getCell(row, 1).alignment = { vertical: "top", horizontal: "center", wrapText: true };
      sheet.getCell(row, 2).alignment = { vertical: "top", horizontal: "center", wrapText: true };
      sheet.getCell(row, 8).fill = solidFill(COLORS.evidence);
      sheet.getCell(row, 8).font = { italic: true, color: { argb: "FF7F7F7F" }, name: "맑은 고딕" };
      sheet.getCell(row, 8).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }

    sheet.addConditionalFormatting({
      ref: `I${FIRST_DATA_ROW}:I${lastDataRow}`,
      rules: [
        { type: "containsText", operator: "containsText", text: "성공", style: { fill: solidFill(COLORS.green) } },
        { type: "containsText", operator: "containsText", text: "실패", style: { fill: solidFill(COLORS.red) } },
        { type: "containsText", operator: "containsText", text: "확인 필요", style: { fill: solidFill(COLORS.amber) } },
      ],
    });
  }

  for (let row = FIRST_DATA_ROW; row <= MAX_EDITABLE_ROW; row += 1) {
    sheet.getCell(row, 9).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"미실행,성공,실패,확인 필요"'],
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "상태 입력 오류",
      error: "목록에서 상태를 선택하세요.",
    };
  }

  const widths = [11, 11, 34, 28, 42, 38, 30, 36, 14];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.autoFilter = cases.length ? undefined : "A4:I4";
  sheet.pageSetup.printTitlesRow = "1:4";
  sheet.pageSetup.printArea = `A1:I${Math.max(lastDataRow, FIRST_DATA_ROW)}`;

  return { lastDataRow: Math.max(lastDataRow, FIRST_DATA_ROW), caseCount: cases.length };
}

async function verifyWorkbook(output, expectedCaseCount) {
  const checked = new ExcelJS.Workbook();
  await checked.xlsx.readFile(output);
  const sheet = checked.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`생성된 Excel에 '${SHEET_NAME}' 시트가 없습니다.`);
  if (sheet.getCell("A1").value !== "테스트 케이스 실행 문서") {
    throw new Error("생성된 Excel의 제목을 확인할 수 없습니다.");
  }
  if (expectedCaseCount && sheet.getCell("I5").dataValidation?.type !== "list") {
    throw new Error("생성된 Excel의 상태 선택 목록을 확인할 수 없습니다.");
  }

  return JSON.stringify({
    sheetName: sheet.name,
    caseCount: expectedCaseCount,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    tableNames: Object.keys(sheet.tables),
    statusValidation: sheet.getCell("I5").dataValidation?.type || "",
  });
}

export async function createWorkbook(analysis, outputPath, { verify = false } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "source-testdoc-generator";
  workbook.created = new Date();
  workbook.modified = new Date();

  const { caseCount } = createExecutionSheet(workbook, analysis);
  const output = path.resolve(outputPath);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await workbook.xlsx.writeFile(output);

  const inspection = verify ? await verifyWorkbook(output, caseCount) : "";
  return { output, caseCount, inspection, errors: "", previewPaths: [] };
}
