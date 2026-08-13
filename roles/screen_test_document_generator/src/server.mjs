import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { analyzeProjects } from "./analyzer.mjs";
import { createWorkbook } from "./workbook.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const webRoot = path.join(projectRoot, "web");
const outputRoot = path.join(projectRoot, "outputs", "local");
const downloads = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, { "Cache-Control": "no-store", ...headers });
  response.end(body);
}

function sendJson(response, status, data) {
  send(response, status, JSON.stringify(data), { "Content-Type": contentTypes[".json"] });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("요청 데이터가 너무 큽니다.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new Error("요청 형식이 올바르지 않습니다.");
  }
}

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}을(를) 입력하세요.`);
  return value.trim();
}

function safeName(value) {
  const result = value.replace(/[^A-Za-z0-9가-힣_-]+/g, "-").replace(/^-+|-+$/g, "");
  return result.slice(0, 50) || "screen";
}

async function generateDocument(request, response) {
  const body = await readJson(request);
  const frontendPath = requiredText(body.frontendPath, "프론트엔드 경로");
  const backendPath = requiredText(body.backendPath, "백엔드 경로");
  const screen = requiredText(body.screen, "대상 화면");

  const analysis = await analyzeProjects(frontendPath, backendPath, { screen });
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const filename = `${safeName(screen)}-test-cases.xlsx`;
  const outputPath = path.join(outputRoot, token, filename);
  const result = await createWorkbook(analysis, outputPath);
  downloads.set(token, { path: result.output, filename, createdAt: Date.now() });

  sendJson(response, 200, {
    ok: true,
    screen: analysis.selection.screen,
    relatedFiles: analysis.selection.frontendFiles,
    endpointCount: analysis.endpoints.length,
    caseCount: result.caseCount,
    downloadUrl: `/api/download/${token}`,
  });
}

async function downloadDocument(token, response) {
  const item = downloads.get(token);
  if (!item) return sendJson(response, 404, { ok: false, error: "다운로드 파일을 찾을 수 없습니다. 다시 생성해 주세요." });
  const data = await fs.readFile(item.path);
  const encodedName = encodeURIComponent(item.filename);
  send(response, 200, data, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
    "Content-Length": String(data.length),
  });
}

async function serveStatic(pathname, response) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(webRoot, relative);
  if (!filePath.toLowerCase().startsWith(`${webRoot.toLowerCase()}${path.sep}`)) {
    return send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
  }
  const data = await fs.readFile(filePath).catch(() => null);
  if (!data) return send(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  send(response, 200, data, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
}

export function createLocalServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (request.method === "POST" && url.pathname === "/api/generate") {
        await generateDocument(request, response);
        return;
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/download/")) {
        await downloadDocument(url.pathname.slice("/api/download/".length), response);
        return;
      }
      if (request.method !== "GET") {
        sendJson(response, 405, { ok: false, error: "지원하지 않는 요청입니다." });
        return;
      }
      await serveStatic(url.pathname, response);
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message || "처리 중 오류가 발생했습니다." });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const server = createLocalServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`화면 테스트 케이스 생성기: http://127.0.0.1:${port}`);
  });
}
