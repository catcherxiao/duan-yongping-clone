import { readFile } from "node:fs/promises";

const BASE_URL = process.env.DEMO_BASE_URL || "http://127.0.0.1:3033";
const CASES_FILE = new URL("./evals/retrieval-routing-cases.json", import.meta.url);
const CASES = JSON.parse(await readFile(CASES_FILE, "utf8"));

const status = await fetchJson(`${BASE_URL}/api/status`);
const results = [];

for (const testCase of CASES) {
  const query = new URL(`${BASE_URL}/api/plan`);
  query.searchParams.set("message", testCase.message);

  const plan = await fetchJson(query);
  const checks = {
    retrievalEligible: plan.retrievalEligible === testCase.expected.retrievalEligible,
    planType: plan.planType === testCase.expected.planType,
    subject: (plan.subject ?? null) === (testCase.expected.subject ?? null),
  };

  const passed = Object.values(checks).every(Boolean);

  results.push({
    ...testCase,
    plan,
    checks,
    passed,
  });
}

const passCount = results.filter((item) => item.passed).length;
const reportLines = [];

reportLines.push("# 检索路由检查报告");
reportLines.push("");
reportLines.push(`- base_url: ${BASE_URL}`);
reportLines.push(`- mode: ${status.mode}`);
reportLines.push(`- model: ${status.model}`);
reportLines.push(`- retrieval_enabled: ${status.retrieval ? "Y" : "N"}`);
reportLines.push(`- passed: ${passCount}/${results.length}`);
reportLines.push("");

for (const result of results) {
  reportLines.push(`## ${result.name}`);
  reportLines.push(`message: ${result.message}`);
  reportLines.push(`result: ${result.passed ? "PASS" : "FAIL"}`);
  reportLines.push(
    `checks: retrievalEligible=${result.checks.retrievalEligible ? "Y" : "N"}, planType=${result.checks.planType ? "Y" : "N"}, subject=${result.checks.subject ? "Y" : "N"}`,
  );
  reportLines.push(
    `expected: eligible=${String(result.expected.retrievalEligible)}, planType=${result.expected.planType}, subject=${String(result.expected.subject ?? null)}`,
  );
  reportLines.push(
    `actual: eligible=${String(result.plan.retrievalEligible)}, planType=${result.plan.planType}, subject=${String(result.plan.subject ?? null)}`,
  );
  reportLines.push("");
}

console.log(reportLines.join("\n"));

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status} ${text}`);
  }

  return response.json();
}
