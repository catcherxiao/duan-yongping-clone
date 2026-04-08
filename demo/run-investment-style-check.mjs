import { readFile } from "node:fs/promises";

const BASE_URL = process.env.DEMO_BASE_URL || "http://127.0.0.1:3033";
const CASES_FILE = new URL("./evals/investment-cases.json", import.meta.url);
const INVESTMENT_CASES = JSON.parse(await readFile(CASES_FILE, "utf8"));

const OPENING_MARKERS = ["我先说结论", "这事先别急", "这类事情我会看得很重"];
const STYLE_MARKERS = [
  "生意",
  "公司",
  "用户",
  "能力圈",
  "长期",
  "现金流",
  "继续看",
  "本质",
  "看懂",
  "不懂不碰",
  "机会成本",
  "最坏情况",
  "成本",
  "分开",
  "杠杆",
  "支持",
  "判断",
  "兴趣",
  "热度",
  "三年",
  "创业",
];

const status = await fetchJson(`${BASE_URL}/api/status`);
const results = [];

for (const testCase of INVESTMENT_CASES) {
  const response = await fetchStreamText(`${BASE_URL}/api/chat`, { message: testCase.prompt });
  const openingPass = OPENING_MARKERS.some((marker) => response.includes(marker));
  const mustHits = testCase.mustHit.filter((keyword) => response.includes(keyword));
  const avoidHits = testCase.mustAvoid.filter((keyword) => response.includes(keyword));
  const styleHits = STYLE_MARKERS.filter((keyword) => response.includes(keyword));

  const checks = {
    opening: openingPass,
    content: mustHits.length >= 2,
    style: styleHits.length >= 2,
    boundary: avoidHits.length === 0,
  };

  const score = Object.values(checks).filter(Boolean).length;
  const passed = score >= 4;

  results.push({
    ...testCase,
    response,
    checks,
    mustHits,
    avoidHits,
    styleHits,
    score,
    passed,
  });
}

const passCount = results.filter((item) => item.passed).length;
const reportLines = [];

reportLines.push("# 投资专项风格检查报告");
reportLines.push("");
reportLines.push(`- base_url: ${BASE_URL}`);
reportLines.push(`- mode: ${status.mode}`);
reportLines.push(`- model: ${status.model}`);
reportLines.push(`- passed: ${passCount}/${results.length}`);
reportLines.push("");

for (const result of results) {
  reportLines.push(`## ${result.name}`);
  reportLines.push(`prompt: ${result.prompt}`);
  reportLines.push(`score: ${result.score}/4`);
  reportLines.push(`result: ${result.passed ? "PASS" : "FAIL"}`);
  reportLines.push(`checks: opening=${result.checks.opening ? "Y" : "N"}, content=${result.checks.content ? "Y" : "N"}, style=${result.checks.style ? "Y" : "N"}, boundary=${result.checks.boundary ? "Y" : "N"}`);
  reportLines.push(`must_hit: ${result.mustHits.join(", ") || "(none)"}`);
  reportLines.push(`avoid_hit: ${result.avoidHits.join(", ") || "(none)"}`);
  reportLines.push(`style_hit: ${result.styleHits.join(", ") || "(none)"}`);
  reportLines.push("response:");
  reportLines.push(result.response.trim());
  reportLines.push("");
}

console.log(reportLines.join("\n"));

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function fetchStreamText(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(`Request failed: ${response.status} ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    fullText += decoder.decode(value, { stream: true });
  }

  return fullText;
}
