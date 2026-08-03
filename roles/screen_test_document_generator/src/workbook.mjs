import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

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

function extractParams(api, type) {
  if (!api) {
    if (type === "Validation") return "입력값 = <테스트 값>";
    return "없음";
  }

  const [method = "", route = ""] = api.split(/\s+/, 2);
  const params = [];
  const pathParams = [...route.matchAll(/:([A-Za-z_][\w-]*)/g)].map((match) => match[1]);
  if (pathParams.length) {
    for (const name of pathParams) params.push(`path.${name} = <입력값>`);
  }
  if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    params.push("body = <요청 JSON 입력>");
  }
  if (!params.length && route.includes("?")) params.push("query = <입력값>");
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
        actual: "",
        evidence: "화면 캡처 붙여넣기",
        status: "미실행",
      };
    });
}

function createExecutionSheet(workbook, analysis) {
  const sheet = workbook.worksheets.add("테스트 케이스");
  const cases = simpleCases(analysis);
  const firstDataRow = 5;
  const lastDataRow = firstDataRow + Math.max(cases.length - 1, 0);

  sheet.showGridLines = false;
  sheet.getRange("A1:I1").merge();
  sheet.getRange("A1").values = [["테스트 케이스 실행 문서"]];
  sheet.getRange("A1:I1").format = {
    fill: COLORS.navy,
    font: { bold: true, color: COLORS.white, size: 16 },
    verticalAlignment: "center",
    horizontalAlignment: "left",
  };
  sheet.getRange("A1:I1").format.rowHeight = 32;

  sheet.getRange("A2:I2").merge();
  sheet.getRange("A2").values = [["Params를 실제 사용값으로 수정한 뒤 테스트하고, 화면 Evidence 칸에 캡처 이미지를 붙여 넣으세요."]];
  sheet.getRange("A2:I2").format = {
    fill: COLORS.lightBlue,
    font: { color: COLORS.navy },
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange("A2:I2").format.rowHeight = 28;

  sheet.getRange("A3:I3").merge();
  sheet.getRange("A3").values = [[`선택 화면: ${analysis.selection?.screen || "전체"}  |  관련 프론트 파일: ${analysis.selection?.frontendFiles?.length || 0}개`]];
  sheet.getRange("A3:I3").format = {
    fill: "#F2F2F2",
    font: { bold: true, color: COLORS.navy },
    verticalAlignment: "center",
  };
  sheet.getRange("A3:I3").format.rowHeight = 24;

  const headers = ["ID", "구분", "테스트 케이스", "입력 Params", "실행 방법", "기대 결과", "실제 결과", "화면 Evidence", "상태"];
  sheet.getRange("A4:I4").values = [headers];
  sheet.getRange("A4:I4").format = {
    fill: COLORS.blue,
    font: { bold: true, color: COLORS.white },
    verticalAlignment: "center",
    horizontalAlignment: "center",
    wrapText: true,
    borders: { preset: "inside", style: "thin", color: COLORS.border },
  };
  sheet.getRange("A4:I4").format.rowHeight = 28;

  if (cases.length) {
    const rows = cases.map((item) => [
      item.id, item.area, item.title, item.params, item.steps,
      item.expected, item.actual, item.evidence, item.status,
    ]);
    sheet.getRange(`A${firstDataRow}:I${lastDataRow}`).values = rows;
    sheet.getRange(`A${firstDataRow}:I${lastDataRow}`).format = {
      verticalAlignment: "top",
      wrapText: true,
      borders: {
        insideHorizontal: { style: "thin", color: COLORS.border },
        insideVertical: { style: "thin", color: COLORS.border },
      },
    };
    sheet.getRange(`A${firstDataRow}:I${lastDataRow}`).format.rowHeight = 72;
    sheet.getRange(`A${firstDataRow}:B${lastDataRow}`).format.horizontalAlignment = "center";
    sheet.getRange(`H${firstDataRow}:H${lastDataRow}`).format = {
      fill: COLORS.evidence,
      font: { italic: true, color: "#7F7F7F" },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      wrapText: true,
      borders: { preset: "all", style: "thin", color: COLORS.border },
    };

    const table = sheet.tables.add(`A4:I${lastDataRow}`, true, "ExecutionCasesTable");
    table.style = "TableStyleMedium2";
    table.showBandedRows = true;
    table.showFilterButton = true;

    sheet.getRange(`I${firstDataRow}:I${Math.max(lastDataRow, 500)}`).dataValidation = {
      rule: { type: "list", values: ["미실행", "성공", "실패", "확인 필요"] },
    };
    const statusRange = sheet.getRange(`I${firstDataRow}:I${lastDataRow}`);
    statusRange.conditionalFormats.add("containsText", { text: "성공", format: { fill: COLORS.green } });
    statusRange.conditionalFormats.add("containsText", { text: "실패", format: { fill: COLORS.red } });
    statusRange.conditionalFormats.add("containsText", { text: "확인 필요", format: { fill: COLORS.amber } });
  }

  const widths = [11, 11, 34, 28, 42, 38, 30, 36, 14];
  widths.forEach((width, index) => {
    const column = String.fromCharCode(65 + index);
    sheet.getRange(`${column}:${column}`).format.columnWidth = width;
  });
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(2);
  return { sheet, lastDataRow: Math.max(lastDataRow, firstDataRow), caseCount: cases.length };
}

export async function createWorkbook(analysis, outputPath, { renderDir, verify = false } = {}) {
  const workbook = Workbook.create();
  const { lastDataRow, caseCount } = createExecutionSheet(workbook, analysis);
  const output = path.resolve(outputPath);
  await fs.mkdir(path.dirname(output), { recursive: true });

  let inspection = null;
  let errors = null;
  if (verify) {
    inspection = await workbook.inspect({
      kind: "table",
      sheetId: "테스트 케이스",
      range: `A1:I${lastDataRow}`,
      include: "values,formulas",
      tableMaxRows: 30,
      tableMaxCols: 10,
    });
    errors = await workbook.inspect({
      kind: "match",
      searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
      options: { useRegex: true, maxResults: 100 },
      summary: "final formula error scan",
    });
  }

  const previewPaths = [];
  if (renderDir) {
    await fs.mkdir(renderDir, { recursive: true });
    const preview = await workbook.render({ sheetName: "테스트 케이스", autoCrop: "all", scale: 1, format: "png" });
    const previewPath = path.join(renderDir, "test-cases-simple.png");
    await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
    previewPaths.push(previewPath);
  }

  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(output);
  return { output, caseCount, inspection: inspection?.ndjson || "", errors: errors?.ndjson || "", previewPaths };
}
