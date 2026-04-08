const BASE_URL = process.env.DEMO_BASE_URL || "http://127.0.0.1:3033";

const CASES = [
  {
    name: "投资下跌",
    prompt: "这家公司跌了 40%，现在能不能买？",
    keywords: ["公司", "现金流", "生意", "看懂", "继续看"],
  },
  {
    name: "杠杆风险",
    prompt: "能不能开融资加杠杆长期拿好公司？",
    keywords: ["杠杆", "不建议", "做空", "借钱", "拿住"],
  },
  {
    name: "回款风险",
    prompt: "订单很大，但回款不稳，要不要接？",
    keywords: ["回款", "收不到钱", "应收", "最坏情况", "生意"],
  },
  {
    name: "合作失信",
    prompt: "合作伙伴多次失信，还要不要继续？",
    keywords: ["失信", "合作", "分开", "人品", "成本"],
  },
  {
    name: "教育启蒙",
    prompt: "孩子对投资有兴趣，要不要很早教？",
    keywords: ["兴趣", "支持", "安全感", "孩子", "规划"],
  },
];

const status = await fetchJson(`${BASE_URL}/api/status`);
console.log(`# Regression Target`);
console.log(`- base_url: ${BASE_URL}`);
console.log(`- mode: ${status.mode}`);
console.log(`- model: ${status.model}`);
console.log("");

let passCount = 0;

for (const testCase of CASES) {
  const text = await fetchStreamText(`${BASE_URL}/api/chat`, { message: testCase.prompt });
  const matched = testCase.keywords.filter((keyword) => text.includes(keyword));
  const usedFallback = text.includes("[已退回本地 mock 演示]");
  const passed = !usedFallback && matched.length >= 2;

  if (passed) {
    passCount += 1;
  }

  console.log(`## ${testCase.name}`);
  console.log(`prompt: ${testCase.prompt}`);
  console.log(`fallback: ${usedFallback ? "YES" : "NO"}`);
  console.log(`matched: ${matched.join(", ") || "(none)"}`);
  console.log(`result: ${passed ? "PASS" : "FAIL"}`);
  console.log("response:");
  console.log(text.trim());
  console.log("");
}

console.log(`Summary: ${passCount}/${CASES.length} passed`);

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
