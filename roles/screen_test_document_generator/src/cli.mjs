#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { analyzeProjects } from "./analyzer.mjs";
import { createWorkbook } from "./workbook.mjs";

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--frontend" || token === "-f") options.frontend = argv[++index];
    else if (token === "--backend" || token === "-b") options.backend = argv[++index];
    else if (token === "--screen" || token === "-s") options.screen = argv[++index];
    else if (token === "--output" || token === "-o") options.output = argv[++index];
    else if (token === "--help" || token === "-h") options.help = true;
    else throw new Error(`알 수 없는 옵션: ${token}`);
  }
  return options;
}

function usage() {
  return `사용법:
  npm run generate -- --frontend <경로> --backend <경로> --screen <화면명|파일|라우트> [--output <xlsx 경로>]

화면에는 UserPage, src/pages/UserPage.tsx, /users/:id 같은 값을 입력할 수 있습니다.
옵션을 생략하면 대화형으로 입력받습니다.`;
}

async function promptMissing(options) {
  if (options.frontend && options.backend && options.screen) return options;
  const rl = readline.createInterface({ input, output });
  try {
    if (!options.frontend) options.frontend = (await rl.question("프론트엔드 경로: ")).trim();
    if (!options.backend) options.backend = (await rl.question("백엔드 경로: ")).trim();
    if (!options.screen) options.screen = (await rl.question("대상 화면명/파일/라우트: ")).trim();
    if (!options.output) {
      const answer = (await rl.question("출력 Excel 경로 [outputs/test-document.xlsx]: ")).trim();
      if (answer) options.output = answer;
    }
  } finally {
    rl.close();
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  await promptMissing(options);
  if (!options.frontend || !options.backend || !options.screen) {
    throw new Error("프론트엔드 경로, 백엔드 경로, 대상 화면이 모두 필요합니다.");
  }
  const outputPath = path.resolve(options.output || "outputs/test-document.xlsx");
  console.log("소스 파일을 분석하고 있습니다...");
  const analysis = await analyzeProjects(options.frontend, options.backend, { screen: options.screen });
  console.log(`선택 화면: ${analysis.selection.screen}`);
  console.log(`관련 파일 ${analysis.selection.frontendFiles.length}개, 화면/컴포넌트 ${analysis.screens.length}개, API ${analysis.endpoints.length}개`);
  console.log("Excel 문서를 생성하고 있습니다...");
  const result = await createWorkbook(analysis, outputPath);
  console.log(`테스트 케이스 ${result.caseCount}건 생성`);
  console.log(`완료: ${result.output}`);
}

main().catch((error) => {
  console.error(`오류: ${error.message}`);
  process.exitCode = 1;
});
