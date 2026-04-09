const BASE_URL = process.env.DEMO_BASE_URL || "http://127.0.0.1:3033";

const status = await fetchJson(`${BASE_URL}/api/status`);
const conversation = [];
const reportLines = [];

reportLines.push("# 多轮对话冒烟报告");
reportLines.push("");
reportLines.push(`- base_url: ${BASE_URL}`);
reportLines.push(`- mode: ${status.mode}`);
reportLines.push(`- model: ${status.model}`);
reportLines.push("");

const openingQuestion = "对泡泡玛特这家公司你怎么看？";
const openingReply = await fetchStreamText(`${BASE_URL}/api/chat`, { message: openingQuestion, history: conversation });
conversation.push({ role: "user", content: openingQuestion });
conversation.push({ role: "assistant", content: openingReply });

reportLines.push("## 首轮总览");
reportLines.push(`prompt: ${openingQuestion}`);
reportLines.push(`checks: no_source=${openingReply.includes("来源：") ? "N" : "Y"}, no_markdown=${openingReply.includes("**") ? "N" : "Y"}`);
reportLines.push("response:");
reportLines.push(openingReply.trim());
reportLines.push("");

const followUpCases = [
  {
    name: "风险追问",
    prompt: "那它最大的风险是什么？",
    expectedPlanType: "company-followup",
    expectedSubject: "泡泡玛特",
    expectedFocusTopicId: "risk",
    mustHit: ["风险", "海外", "IP"],
  },
  {
    name: "护城河追问",
    prompt: "那护城河呢？",
    expectedPlanType: "company-followup",
    expectedSubject: "泡泡玛特",
    expectedFocusTopicId: "moat",
    mustHit: ["护城河", "IP", "复购"],
  },
  {
    name: "估值追问",
    prompt: "估值呢？",
    expectedPlanType: "company-followup",
    expectedSubject: "泡泡玛特",
    expectedFocusTopicId: "valuation",
    mustHit: ["估值", "增长"],
  },
];

for (const testCase of followUpCases) {
  const plan = await fetchJson(`${BASE_URL}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: testCase.prompt, history: conversation }),
  });
  const reply = await fetchStreamText(`${BASE_URL}/api/chat`, { message: testCase.prompt, history: conversation });
  conversation.push({ role: "user", content: testCase.prompt });
  conversation.push({ role: "assistant", content: reply });

  const mustHits = testCase.mustHit.filter((keyword) => reply.includes(keyword));
  const checks = {
    planType: plan.planType === testCase.expectedPlanType,
    subject: plan.subject === testCase.expectedSubject,
    focusTopicId: plan.focusTopicId === testCase.expectedFocusTopicId,
    noSource: !reply.includes("来源："),
    noMarkdown: !reply.includes("**"),
    content: mustHits.length >= Math.min(2, testCase.mustHit.length),
  };

  reportLines.push(`## ${testCase.name}`);
  reportLines.push(`prompt: ${testCase.prompt}`);
  reportLines.push(
    `checks: planType=${checks.planType ? "Y" : "N"}, subject=${checks.subject ? "Y" : "N"}, focusTopicId=${checks.focusTopicId ? "Y" : "N"}, noSource=${checks.noSource ? "Y" : "N"}, noMarkdown=${checks.noMarkdown ? "Y" : "N"}, content=${checks.content ? "Y" : "N"}`,
  );
  reportLines.push(`must_hit: ${mustHits.join(", ") || "(none)"}`);
  reportLines.push("response:");
  reportLines.push(reply.trim());
  reportLines.push("");
}

const broadPlan = await fetchJson(`${BASE_URL}/api/plan`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "孩子对投资有兴趣，要不要很早教？", history: conversation }),
});
const broadReply = await fetchStreamText(`${BASE_URL}/api/chat`, {
  message: "孩子对投资有兴趣，要不要很早教？",
  history: conversation,
});

reportLines.push("## 换题检查");
reportLines.push("prompt: 孩子对投资有兴趣，要不要很早教？");
reportLines.push(
  `checks: plan_none=${broadPlan.planType === "none" ? "Y" : "N"}, no_popmart=${broadReply.includes("泡泡玛特") ? "N" : "Y"}`,
);
reportLines.push("response:");
reportLines.push(broadReply.trim());
reportLines.push("");

console.log(reportLines.join("\n"));

async function fetchJson(url, init) {
  const response = await fetch(url, init);

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
