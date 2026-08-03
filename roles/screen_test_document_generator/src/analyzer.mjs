import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".html",
  ".py", ".java", ".kt", ".kts", ".go", ".rb", ".php", ".cs",
]);

const DEFAULT_IGNORES = new Set([
  ".git", ".idea", ".vscode", "node_modules", "dist", "build", "coverage",
  ".next", ".nuxt", ".svelte-kit", "target", "vendor", "venv", ".venv",
  "__pycache__", ".pytest_cache", ".mypy_cache", "generated", "outputs",
]);

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

function normalizePath(value) {
  if (!value) return "/";
  let result = String(value)
    .replace(/\\/g, "/")
    .replace(/\$\{[^}]+\}/g, ":param")
    .replace(/\{[^}]+\}/g, ":param")
    .replace(/<[^>]+>/g, ":param")
    .replace(/:[A-Za-z_][\w-]*/g, ":param")
    .replace(/\/+/g, "/");
  if (!result.startsWith("/")) result = `/${result}`;
  if (result.length > 1) result = result.replace(/\/$/, "");
  return result || "/";
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function cleanQuotedPath(value) {
  return normalizePath(value.replace(/^['"`]|['"`]$/g, ""));
}

function addUnique(items, item, keyFn) {
  const key = keyFn(item);
  if (!items.some((current) => keyFn(current) === key)) items.push(item);
}

async function collectSourceFiles(root) {
  const resolvedRoot = path.resolve(root);
  const stat = await fs.stat(resolvedRoot).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`소스 경로가 디렉터리가 아니거나 존재하지 않습니다: ${resolvedRoot}`);
  }

  const files = [];
  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!DEFAULT_IGNORES.has(entry.name)) await walk(fullPath);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }
  await walk(resolvedRoot);
  return { root: resolvedRoot, files };
}

function sourceRef(root, file, line) {
  return `${path.relative(root, file).replace(/\\/g, "/")}:${line}`;
}

function importSpecifiers(content) {
  const specs = new Set();
  const patterns = [
    /(?:import|export)\s+(?:[^"'`;]*?\s+from\s*)?["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) specs.add(match[1]);
  }
  return [...specs];
}

function importBindings(content) {
  const bindings = new Map();
  const pattern = /import\s+([^;]+?)\s+from\s+["']([^"']+)["']/g;
  for (const match of content.matchAll(pattern)) {
    const clause = match[1].trim();
    const spec = match[2];
    const defaultName = clause.match(/^([A-Za-z_$][\w$]*)/)?.[1];
    if (defaultName) bindings.set(defaultName, spec);
    const namespaceName = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)?.[1];
    if (namespaceName) bindings.set(namespaceName, spec);
    const named = clause.match(/\{([^}]+)\}/)?.[1] || "";
    for (const part of named.split(",")) {
      const names = part.trim().split(/\s+as\s+/);
      const localName = names[1] || names[0];
      if (localName) bindings.set(localName.trim(), spec);
    }
  }
  return bindings;
}

function resolveLocalImport(root, importer, spec, fileLookup) {
  const bases = [];
  if (spec.startsWith(".")) bases.push(path.resolve(path.dirname(importer), spec));
  else if (spec.startsWith("@/")) {
    bases.push(path.resolve(root, "src", spec.slice(2)));
    bases.push(path.resolve(root, spec.slice(2)));
  } else if (spec.startsWith("~/")) {
    bases.push(path.resolve(root, "src", spec.slice(2)));
    bases.push(path.resolve(root, spec.slice(2)));
  } else if (spec.startsWith("/")) bases.push(path.resolve(root, spec.slice(1)));
  else return null;

  for (const base of bases) {
    const candidates = [base];
    for (const extension of SOURCE_EXTENSIONS) candidates.push(`${base}${extension}`);
    for (const extension of SOURCE_EXTENSIONS) candidates.push(path.join(base, `index${extension}`));
    for (const candidate of candidates) {
      const resolved = fileLookup.get(path.resolve(candidate).toLowerCase());
      if (resolved) return resolved;
    }
  }
  return null;
}

function routeTargetSeeds(root, file, content, query, fileLookup) {
  let index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) index = 0;
  const window = content.slice(Math.max(0, index - 300), index + query.length + 600);
  const resolved = new Set();
  for (const spec of importSpecifiers(window)) {
    const target = resolveLocalImport(root, file, spec, fileLookup);
    if (target) resolved.add(target);
  }
  const bindings = importBindings(content);
  for (const identifier of window.match(/[A-Z][A-Za-z0-9_$]*/g) || []) {
    const spec = bindings.get(identifier);
    if (!spec) continue;
    const target = resolveLocalImport(root, file, spec, fileLookup);
    if (target) resolved.add(target);
  }
  return [...resolved];
}

function selectRelatedFrontendFiles(frontend, contents, screenQuery) {
  if (!screenQuery?.trim()) return frontend.files;
  const query = screenQuery.trim();
  const queryLower = query.replace(/\\/g, "/").toLowerCase();
  const queryWithoutExt = queryLower.replace(/\.[^.\/]+$/, "");
  const isRoute = query.startsWith("/");
  const fileLookup = new Map(frontend.files.map((file) => [path.resolve(file).toLowerCase(), file]));
  const exactSeeds = new Set();
  const routeMatches = [];
  const fuzzySeeds = new Set();
  const candidateNames = new Set();

  for (const file of frontend.files) {
    const content = contents.get(file) || "";
    const relative = path.relative(frontend.root, file).replace(/\\/g, "/");
    const relativeLower = relative.toLowerCase();
    const relativeWithoutExt = relativeLower.replace(/\.[^.\/]+$/, "");
    const stem = path.basename(file, path.extname(file));
    candidateNames.add(stem);
    const detected = detectFrontendFile(frontend.root, file, content);
    detected.screens.forEach((item) => candidateNames.add(item.name));

    const exactFile = relativeLower === queryLower
      || relativeWithoutExt === queryWithoutExt
      || path.basename(file).toLowerCase() === queryLower
      || stem.toLowerCase() === queryWithoutExt;
    const exactComponent = detected.screens.some((item) => item.name.toLowerCase() === queryLower);
    if (exactFile || exactComponent) exactSeeds.add(file);

    if (isRoute && detected.screens.some((item) => item.route && item.route === normalizePath(query))) {
      routeMatches.push({ file, detected });
    }
    if (relativeLower.includes(queryLower)
      || detected.screens.some((item) => item.name.toLowerCase().includes(queryLower))) {
      fuzzySeeds.add(file);
    }
  }

  let seeds = [...exactSeeds];
  if (!seeds.length && routeMatches.length) {
    const routeSeeds = new Set();
    for (const { file, detected } of routeMatches) {
      const targets = routeTargetSeeds(frontend.root, file, contents.get(file) || "", query, fileLookup);
      const hasPageComponent = detected.screens.some((item) => item.type === "Component" && !/^(App|Router|Routes|Root|Main)$/i.test(item.name));
      if (hasPageComponent || !targets.length) routeSeeds.add(file);
      targets.forEach((target) => routeSeeds.add(target));
    }
    seeds = [...routeSeeds];
  }
  if (!seeds.length) seeds = [...fuzzySeeds];
  if (!seeds.length) {
    const suggestions = [...candidateNames].sort().slice(0, 15).join(", ");
    throw new Error(`선택한 화면을 찾을 수 없습니다: ${query}${suggestions ? `\n사용 가능한 화면/파일 예시: ${suggestions}` : ""}`);
  }

  const selected = new Set();
  const queue = [...seeds];
  while (queue.length) {
    const file = queue.shift();
    if (selected.has(file)) continue;
    selected.add(file);
    for (const spec of importSpecifiers(contents.get(file) || "")) {
      const target = resolveLocalImport(frontend.root, file, spec, fileLookup);
      if (target && !selected.has(target)) queue.push(target);
    }
  }
  return [...selected].sort((a, b) => a.localeCompare(b));
}

function detectFrontendFile(root, file, content) {
  const screens = [];
  const apiCalls = [];
  const forms = [];
  const relativeFile = path.relative(root, file).replace(/\\/g, "/");
  const extension = path.extname(file).toLowerCase();

  const componentPatterns = [
    /(?:export\s+default\s+)?function\s+([A-Z][\w$]*)\s*\(/g,
    /(?:export\s+)?const\s+([A-Z][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g,
    /(?:export\s+default\s+)?class\s+([A-Z][\w$]*)\s+extends\s+(?:React\.)?Component/g,
    /(?:name\s*:\s*['"])([A-Z][\w$]*)['"]/g,
  ];
  for (const pattern of componentPatterns) {
    for (const match of content.matchAll(pattern)) {
      addUnique(screens, {
        name: match[1], type: "Component", route: "", source: sourceRef(root, file, lineNumberAt(content, match.index)),
      }, (item) => `${item.name}|${item.source}`);
    }
  }

  const routePatterns = [
    /(?:path|route)\s*=\s*["']([^"']+)["']/g,
    /(?:path|route)\s*:\s*["']([^"']+)["']/g,
    /<Route\b[^>]*\bpath\s*=\s*["']([^"']+)["'][^>]*>/g,
  ];
  for (const pattern of routePatterns) {
    for (const match of content.matchAll(pattern)) {
      addUnique(screens, {
        name: path.basename(cleanQuotedPath(match[1])) || "Root", type: "Route",
        route: cleanQuotedPath(match[1]), source: sourceRef(root, file, lineNumberAt(content, match.index)),
      }, (item) => `${item.route}|${item.source}`);
    }
  }

  const fetchPattern = /\bfetch\s*\(\s*(["'`][^"'`]+["'`])(?:\s*,\s*\{([\s\S]{0,500}?)\})?/g;
  for (const match of content.matchAll(fetchPattern)) {
    const options = match[2] || "";
    const method = options.match(/method\s*:\s*["'](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)["']/i)?.[1]?.toUpperCase() || "GET";
    addUnique(apiCalls, {
      method, path: cleanQuotedPath(match[1]), client: "fetch",
      source: sourceRef(root, file, lineNumberAt(content, match.index)),
    }, (item) => `${item.method}|${item.path}|${item.source}`);
  }

  const axiosMethodPattern = /\b(?:axios|api|client|http)\s*\.\s*(get|post|put|patch|delete|options|head)\s*\(\s*(["'`][^"'`]+["'`])/gi;
  for (const match of content.matchAll(axiosMethodPattern)) {
    addUnique(apiCalls, {
      method: match[1].toUpperCase(), path: cleanQuotedPath(match[2]), client: "HTTP client",
      source: sourceRef(root, file, lineNumberAt(content, match.index)),
    }, (item) => `${item.method}|${item.path}|${item.source}`);
  }

  const axiosConfigPattern = /\b(?:axios|api|client|http)\s*\(\s*\{([\s\S]{0,700}?)\}\s*\)/gi;
  for (const match of content.matchAll(axiosConfigPattern)) {
    const method = match[1].match(/method\s*:\s*["'](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)["']/i)?.[1]?.toUpperCase() || "GET";
    const url = match[1].match(/(?:url|path)\s*:\s*(["'`][^"'`]+["'`])/i)?.[1];
    if (url) addUnique(apiCalls, {
      method, path: cleanQuotedPath(url), client: "HTTP client config",
      source: sourceRef(root, file, lineNumberAt(content, match.index)),
    }, (item) => `${item.method}|${item.path}|${item.source}`);
  }

  const formPattern = /<(form|input|select|textarea)\b/gi;
  for (const match of content.matchAll(formPattern)) {
    addUnique(forms, {
      kind: match[1].toLowerCase(), name: `${path.basename(relativeFile, extension)} ${match[1].toLowerCase()}`,
      source: sourceRef(root, file, lineNumberAt(content, match.index)),
    }, (item) => `${item.kind}|${item.source}`);
  }

  return { screens, apiCalls, forms };
}

function parseExpressLike(root, file, content, endpoints) {
  const pattern = /\b(?:app|router|server)\s*\.\s*(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  for (const match of content.matchAll(pattern)) {
    addUnique(endpoints, {
      method: match[1].toUpperCase(), path: normalizePath(match[2]), framework: "Express-like",
      auth: nearbyAuth(content, match.index), validation: nearbyValidation(content, match.index),
      source: sourceRef(root, file, lineNumberAt(content, match.index)),
    }, endpointKey);
  }
}

function parsePythonRoutes(root, file, content, endpoints) {
  const decoratorPattern = /@(?:app|router|blueprint|bp)\s*\.\s*(get|post|put|patch|delete|route)\s*\(\s*["']([^"']+)["']([^\n]*)/gi;
  for (const match of content.matchAll(decoratorPattern)) {
    let methods = [match[1].toUpperCase()];
    if (methods[0] === "ROUTE") {
      const methodList = match[3].match(/methods\s*=\s*\[([^\]]+)\]/i)?.[1] || "GET";
      methods = HTTP_METHODS.filter((method) => new RegExp(`["']${method}["']`, "i").test(methodList));
      if (!methods.length) methods = ["GET"];
    }
    for (const method of methods) addUnique(endpoints, {
      method, path: normalizePath(match[2]), framework: "Python web",
      auth: nearbyAuth(content, match.index), validation: nearbyValidation(content, match.index),
      source: sourceRef(root, file, lineNumberAt(content, match.index)),
    }, endpointKey);
  }
}

function parseJavaRoutes(root, file, content, endpoints) {
  const pattern = /@(Get|Post|Put|Patch|Delete|Request)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']*)["']([^)]*)\)/gi;
  for (const match of content.matchAll(pattern)) {
    let methods = [match[1].toUpperCase()];
    if (methods[0] === "REQUEST") {
      const detected = HTTP_METHODS.filter((method) => new RegExp(`RequestMethod\\.${method}`, "i").test(match[3]));
      methods = detected.length ? detected : ["GET"];
    }
    for (const method of methods) addUnique(endpoints, {
      method, path: normalizePath(match[2]), framework: "Spring",
      auth: nearbyAuth(content, match.index), validation: nearbyValidation(content, match.index),
      source: sourceRef(root, file, lineNumberAt(content, match.index)),
    }, endpointKey);
  }
}

function parseGoRoutes(root, file, content, endpoints) {
  const pattern = /\b(?:r|router|engine|group|e)\s*\.\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(\s*["'`]([^"'`]+)["'`]/g;
  for (const match of content.matchAll(pattern)) {
    addUnique(endpoints, {
      method: match[1], path: normalizePath(match[2]), framework: "Go web",
      auth: nearbyAuth(content, match.index), validation: nearbyValidation(content, match.index),
      source: sourceRef(root, file, lineNumberAt(content, match.index)),
    }, endpointKey);
  }
}

function nearbyAuth(content, index) {
  const text = content.slice(Math.max(0, index - 250), index + 350);
  return /auth|jwt|bearer|session|permission|authorize|login_required|secured|principal/i.test(text) ? "Y" : "N/Unknown";
}

function nearbyValidation(content, index) {
  const text = content.slice(index, index + 650);
  return /validat|schema|zod|joi|yup|pydantic|serializer|@Valid|binding|required/i.test(text) ? "Y" : "N/Unknown";
}

function endpointKey(item) {
  return `${item.method}|${item.path}|${item.source}`;
}

function detectBackendFile(root, file, content) {
  const endpoints = [];
  parseExpressLike(root, file, content, endpoints);
  parsePythonRoutes(root, file, content, endpoints);
  parseJavaRoutes(root, file, content, endpoints);
  parseGoRoutes(root, file, content, endpoints);
  return { endpoints };
}

function matchScore(frontPath, backendPath) {
  const front = normalizePath(frontPath).split("/").filter(Boolean);
  const back = normalizePath(backendPath).split("/").filter(Boolean);
  if (front.length !== back.length) return 0;
  let score = 0;
  for (let i = 0; i < front.length; i += 1) {
    if (front[i] === back[i]) score += 2;
    else if (front[i] === ":param" || back[i] === ":param") score += 1;
    else return 0;
  }
  return score + 1;
}

function buildTraceability(apiCalls, endpoints) {
  const traces = [];
  const usedEndpointIndexes = new Set();
  for (const call of apiCalls) {
    let bestIndex = -1;
    let bestScore = 0;
    endpoints.forEach((endpoint, index) => {
      if (endpoint.method !== call.method) return;
      const score = matchScore(call.path, endpoint.path);
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
    const endpoint = bestIndex >= 0 ? endpoints[bestIndex] : null;
    if (endpoint) usedEndpointIndexes.add(bestIndex);
    traces.push({
      method: call.method, frontendPath: call.path, backendPath: endpoint?.path || "",
      status: endpoint ? "Matched" : "Frontend only", frontendSource: call.source,
      backendSource: endpoint?.source || "", auth: endpoint?.auth || "N/A", validation: endpoint?.validation || "N/A",
    });
  }
  endpoints.forEach((endpoint, index) => {
    if (!usedEndpointIndexes.has(index)) traces.push({
      method: endpoint.method, frontendPath: "", backendPath: endpoint.path, status: "Backend only",
      frontendSource: "", backendSource: endpoint.source, auth: endpoint.auth, validation: endpoint.validation,
    });
  });
  return traces;
}

function caseId(index) {
  return `TC-${String(index + 1).padStart(4, "0")}`;
}

function generateTestCases({ screens, forms, endpoints, traces }) {
  const cases = [];
  const push = (testCase) => cases.push({ id: caseId(cases.length), status: "Not Run", owner: "", ...testCase });

  for (const screen of screens) {
    push({ area: "Frontend", type: "UI", priority: "Medium", title: `${screen.name} 기본 렌더링 확인`,
      precondition: "애플리케이션 실행 및 접근 가능한 사용자 준비", steps: `${screen.route || screen.name} 화면에 접근한다.\n주요 UI 요소와 초기 상태를 확인한다.`,
      expected: "화면이 오류 없이 표시되고 주요 요소가 사용 가능하다.", source: screen.source, api: "" });
  }
  for (const form of forms) {
    push({ area: "Frontend", type: "Validation", priority: "High", title: `${form.name} 필수값/형식 검증`,
      precondition: "대상 화면에 접근한다.", steps: "필수값을 비우거나 잘못된 형식으로 제출한다.\n오류 메시지와 제출 차단 여부를 확인한다.",
      expected: "유효하지 않은 입력이 차단되고 사용자가 이해할 수 있는 오류가 표시된다.", source: form.source, api: "" });
  }
  for (const endpoint of endpoints) {
    const apiLabel = `${endpoint.method} ${endpoint.path}`;
    push({ area: "Backend", type: "API", priority: "High", title: `${apiLabel} 정상 처리`,
      precondition: endpoint.auth === "Y" ? "유효한 인증 정보와 정상 요청 데이터 준비" : "정상 요청 데이터 준비",
      steps: `${apiLabel}에 유효한 요청을 전송한다.\n응답 상태와 스키마를 확인한다.`,
      expected: "성공 상태 코드와 계약에 맞는 응답이 반환된다.", source: endpoint.source, api: apiLabel });
    if (["POST", "PUT", "PATCH"].includes(endpoint.method) || endpoint.validation === "Y") {
      push({ area: "Backend", type: "Negative", priority: "High", title: `${apiLabel} 잘못된 입력 거부`,
        precondition: endpoint.auth === "Y" ? "유효한 인증 정보 준비" : "없음",
        steps: `${apiLabel}에 누락/경계값/잘못된 형식의 요청을 전송한다.`,
        expected: "4xx 오류와 일관된 오류 응답이 반환되며 데이터가 변경되지 않는다.", source: endpoint.source, api: apiLabel });
    }
    if (endpoint.auth === "Y") {
      push({ area: "Security", type: "Authorization", priority: "Critical", title: `${apiLabel} 미인증 접근 차단`,
        precondition: "인증 정보가 없거나 만료된 상태", steps: `${apiLabel}을 인증 없이 호출한다.\n권한이 부족한 사용자로 다시 호출한다.`,
        expected: "401 또는 403으로 차단되고 민감 정보가 노출되지 않는다.", source: endpoint.source, api: apiLabel });
    }
  }
  for (const trace of traces.filter((item) => item.status === "Matched")) {
    push({ area: "Integration", type: "E2E", priority: "High", title: `${trace.method} ${trace.frontendPath} 연동 확인`,
      precondition: "프론트엔드와 백엔드 실행 및 테스트 데이터 준비",
      steps: `${trace.frontendSource}에서 해당 사용자 동작을 수행한다.\n${trace.method} ${trace.backendPath} 요청과 화면 반영을 확인한다.`,
      expected: "요청/응답 계약이 일치하고 성공·실패 결과가 화면에 올바르게 반영된다.",
      source: `${trace.frontendSource} ↔ ${trace.backendSource}`, api: `${trace.method} ${trace.backendPath}` });
  }
  for (const trace of traces.filter((item) => item.status !== "Matched")) {
    push({ area: "Contract", type: "Gap", priority: "High", title: `${trace.method} ${trace.frontendPath || trace.backendPath} 연결 누락 검토`,
      precondition: "API 계약/요구사항 확인 가능", steps: "프론트 호출과 백엔드 라우트의 의도된 연결을 확인한다.\n경로, 메서드, 프록시/베이스 URL 설정을 검토한다.",
      expected: "의도된 미사용 API이거나 대응 구현이 식별되고 추적 가능하게 기록된다.",
      source: trace.frontendSource || trace.backendSource, api: `${trace.method} ${trace.frontendPath || trace.backendPath}` });
  }
  return cases;
}

export async function analyzeProjects(frontendPath, backendPath, { screen } = {}) {
  const [frontend, backend] = await Promise.all([collectSourceFiles(frontendPath), collectSourceFiles(backendPath)]);
  const frontendContents = new Map(await Promise.all(frontend.files.map(async (file) => [
    file, await fs.readFile(file, "utf8").catch(() => ""),
  ])));
  const selectedFrontendFiles = selectRelatedFrontendFiles(frontend, frontendContents, screen);
  const screens = [];
  const apiCalls = [];
  const forms = [];
  for (const file of selectedFrontendFiles) {
    const content = frontendContents.get(file) || "";
    const detected = detectFrontendFile(frontend.root, file, content);
    screens.push(...detected.screens);
    apiCalls.push(...detected.apiCalls);
    forms.push(...detected.forms);
  }
  const allEndpoints = [];
  for (const file of backend.files) {
    const content = await fs.readFile(file, "utf8").catch(() => "");
    allEndpoints.push(...detectBackendFile(backend.root, file, content).endpoints);
  }
  const endpoints = screen
    ? allEndpoints.filter((endpoint) => apiCalls.some((call) => call.method === endpoint.method && matchScore(call.path, endpoint.path) > 0))
    : allEndpoints;
  const traces = buildTraceability(apiCalls, endpoints);
  const testCases = generateTestCases({ screens, forms, endpoints, traces });
  return {
    generatedAt: new Date().toISOString(),
    roots: { frontend: frontend.root, backend: backend.root },
    fileCounts: { frontend: selectedFrontendFiles.length, backend: new Set(endpoints.map((item) => item.source.split(":")[0])).size },
    selection: {
      screen: screen || "전체",
      frontendFiles: selectedFrontendFiles.map((file) => path.relative(frontend.root, file).replace(/\\/g, "/")),
    },
    screens, apiCalls, forms, endpoints, traces, testCases,
  };
}

export const internals = { normalizePath, matchScore, buildTraceability, generateTestCases, importSpecifiers };
