import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProjects, internals } from "../src/analyzer.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

test("normalizes dynamic path parameters", () => {
  assert.equal(internals.normalizePath("api/users/${userId}"), "/api/users/:param");
  assert.equal(internals.normalizePath("/orders/{order_id}/"), "/orders/:param");
});

test("matches paths with different parameter names", () => {
  assert.ok(internals.matchScore("/api/users/${id}", "/api/users/:userId") > 0);
  assert.equal(internals.matchScore("/api/users", "/api/orders"), 0);
});

test("analyzes fixtures and builds traceability/test cases", async () => {
  const analysis = await analyzeProjects(path.join(here, "fixtures/frontend"), path.join(here, "fixtures/backend"));
  assert.ok(analysis.screens.some((item) => item.name === "UserPage"));
  assert.ok(analysis.apiCalls.some((item) => item.method === "GET" && item.path === "/api/users/:param"));
  assert.ok(analysis.endpoints.some((item) => item.method === "GET" && item.path === "/api/users/:param"));
  assert.ok(analysis.traces.some((item) => item.status === "Matched"));
  assert.ok(analysis.testCases.some((item) => item.type === "E2E"));
  assert.ok(analysis.testCases.some((item) => item.type === "Authorization"));
});

test("limits analysis to the selected screen and its imported components", async () => {
  const analysis = await analyzeProjects(
    path.join(here, "fixtures/frontend"),
    path.join(here, "fixtures/backend"),
    { screen: "UserPage" },
  );
  assert.deepEqual(analysis.selection.frontendFiles, ["UserCard.tsx", "UserPage.tsx"]);
  assert.ok(analysis.screens.some((item) => item.name === "UserPage"));
  assert.ok(analysis.screens.some((item) => item.name === "UserCard"));
  assert.ok(!analysis.screens.some((item) => item.name === "AdminPage"));
  assert.ok(analysis.apiCalls.some((item) => item.path === "/api/users/:param/activity"));
  assert.ok(!analysis.apiCalls.some((item) => item.path === "/api/admin/stats"));
  assert.ok(analysis.endpoints.some((item) => item.path === "/api/users/:param/activity"));
  assert.ok(!analysis.endpoints.some((item) => item.path === "/api/admin/stats"));
});

test("reports a useful error when the screen cannot be found", async () => {
  await assert.rejects(
    analyzeProjects(
      path.join(here, "fixtures/frontend"),
      path.join(here, "fixtures/backend"),
      { screen: "MissingPage" },
    ),
    /선택한 화면을 찾을 수 없습니다/,
  );
});

test("accepts a route as the selected screen", async () => {
  const analysis = await analyzeProjects(
    path.join(here, "fixtures/frontend"),
    path.join(here, "fixtures/backend"),
    { screen: "/users/:userId" },
  );
  assert.deepEqual(analysis.selection.frontendFiles, ["UserCard.tsx", "UserPage.tsx"]);
  assert.ok(!analysis.selection.frontendFiles.includes("AdminPage.tsx"));
});
