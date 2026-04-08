import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const CASE_BLOCKS_FILE = join(ROOT, "data", "case-blocks.json");
const PORT = Number(process.env.PORT || 3033);

await loadDotEnv(join(ROOT, ".env"));
const CASE_BLOCKS = await loadJsonFile(CASE_BLOCKS_FILE, []);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || "";
const BRAVE_SEARCH_API_URL = (process.env.BRAVE_SEARCH_API_URL || "https://api.search.brave.com/res/v1/web/search").replace(/\/$/, "");
const BRAVE_SEARCH_COUNTRY = process.env.BRAVE_SEARCH_COUNTRY || "cn";
const BRAVE_SEARCH_LANG = process.env.BRAVE_SEARCH_LANG || "zh-hans";
const BRAVE_TIMEOUT_MS = Number(process.env.BRAVE_TIMEOUT_MS || 12000);
const MODE = OPENAI_API_KEY ? "openai" : "mock";
const IS_MINIMAX = /api\.minimax\.io/i.test(OPENAI_BASE_URL) || /^MiniMax-/i.test(OPENAI_MODEL);
const RESEARCH_PROMPTS = ["对泡泡玛特这家公司你怎么看？", "对贵州茅台这家公司你怎么看？"];
const DEFAULT_PROMPTS = [
  "这家公司跌了 40%，现在能不能买？",
  "能不能开融资加杠杆长期拿好公司？",
  "合作伙伴多次失信，还要不要继续？",
  "订单很大，但回款不稳，要不要接？",
  "现在 AI 创业很热，我要不要辞职？",
  "孩子对投资有兴趣，要不要很早教？",
];
const COMPANY_ANALYSIS_ASPECTS = [
  {
    id: "business",
    title: "先看它到底怎么赚钱",
    query: (companyName) => `${companyName} 商业模式 收入 利润 毛利 赚钱`,
  },
  {
    id: "user",
    title: "再看用户为什么会持续买",
    query: (companyName) => `${companyName} 用户 品牌 复购 社区 IP 门店 海外`,
  },
  {
    id: "management",
    title: "再看管理层和文化靠不靠谱",
    query: (companyName) => `${companyName} 创始人 管理层 文化 战略 执行 采访`,
  },
  {
    id: "circle",
    title: "最后看它是不是你的能力圈",
    query: (companyName) => `${companyName} 风险 竞争 争议 海外 扩张 关键变量`,
  },
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const SYSTEM_PROMPT = [
  "你是一个“段永平公开表达风格”的演示助手，不代表段永平本人。",
  "回答规则：",
  "1. 第一次进入角色时，短句提醒一次这不是个性化投资建议。",
  "2. 先给结论，再说为什么。",
  "3. 优先回到本分、能力圈、长期主义、买股票就是买公司、少犯错。",
  "4. 不做短线预测，不做仓位建议，不鼓励杠杆、做空和题材投机。",
  "5. 语气平静、直接、简洁，像一个长期主义者在说人话。",
  "6. 信息不足时，先问 2 到 4 个高信号问题。",
].join("\n");

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

    if (req.method === "GET" && url.pathname === "/api/status") {
      return sendJson(res, 200, {
        mode: MODE,
        model: MODE === "openai" ? OPENAI_MODEL : "local-mock",
        baseUrl: MODE === "openai" ? OPENAI_BASE_URL : null,
        retrieval: BRAVE_API_KEY ? "brave-web-search" : null,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/prompts") {
      const promptPool = [...RESEARCH_PROMPTS, ...CASE_BLOCKS.map((item) => item.prompt).filter(Boolean), ...DEFAULT_PROMPTS];

      return sendJson(res, 200, {
        prompts: Array.from(new Set(promptPool)).slice(0, 8),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/plan") {
      const message = String(url.searchParams.get("message") || "").trim();
      const routing = analyzeMessageRouting(message);

      return sendJson(res, 200, {
        message,
        retrievalEnabled: Boolean(BRAVE_API_KEY),
        retrievalEligible: routing.retrievalEligible,
        planType: routing.planType,
        reason: routing.reason,
        subject: routing.subject,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(req, res);
    }

    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }

    return sendText(res, 405, "Method Not Allowed");
  } catch (error) {
    console.error("[server-error]", error);
    return sendText(res, 500, "Server Error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Duan demo site running at http://127.0.0.1:${PORT}`);
  console.log(`Mode: ${MODE}${MODE === "openai" ? ` (${OPENAI_MODEL})` : ""}`);
});

async function handleChat(req, res) {
  const payload = await readJsonBody(req);
  const message = String(payload?.message || "").trim();
  const history = Array.isArray(payload?.history)
    ? payload.history
        .filter((item) => item && typeof item.role === "string" && typeof item.content === "string")
        .slice(-8)
    : [];

  if (!message) {
    return sendJson(res, 400, { error: "message is required" });
  }

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const replyPlan = await buildReplyPlan(message);

  if (MODE === "openai") {
    try {
      await streamOpenAI(req, res, history, message, replyPlan);
      return;
    } catch (error) {
      console.error("[openai-stream-error]", error);
      await streamText(res, `\n[已退回本地 mock 演示]\n\n${replyPlan.localReply}`);
      return;
    }
  }

  await streamText(res, replyPlan.localReply);
}

async function streamOpenAI(req, res, history, message, replyPlan) {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      stream: true,
      ...(IS_MINIMAX ? { reasoning_split: true } : {}),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(replyPlan?.modelContext ? [{ role: "system", content: replyPlan.modelContext }] : []),
        ...history,
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(`upstream ${response.status}: ${errorText}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let contentBuffer = "";

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });

    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line || !line.startsWith("data:")) {
        continue;
      }

      const data = line.slice(5).trim();

      if (data === "[DONE]") {
        res.end();
        return;
      }

      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;

        if (typeof delta === "string" && delta) {
          const nextChunk = contentBuffer && delta.startsWith(contentBuffer) ? delta.slice(contentBuffer.length) : delta;

          if (nextChunk) {
            res.write(nextChunk);
          }

          contentBuffer = contentBuffer && delta.startsWith(contentBuffer) ? delta : `${contentBuffer}${delta}`;
        }
      } catch {
        // Ignore malformed SSE fragments from upstream.
      }
    }
  }

  res.end();
}

async function buildReplyPlan(message) {
  const routing = analyzeMessageRouting(message);
  const companyName = routing.subject;
  const researchPlan = buildResearchPlan(message, companyName);

  if (researchPlan) {
    const research = await maybeRunResearchPlan(researchPlan);

    if (research?.some((aspect) => aspect.items.length > 0)) {
      return {
        localReply: buildRetrievedResearchReply(researchPlan, research),
        modelContext: buildRetrievedResearchContext(researchPlan, research),
      };
    }
  }

  return {
    localReply: companyName ? buildCompanyFrameworkReply(companyName) : buildMockReply(message),
    modelContext: "",
  };
}

function buildMockReply(message) {
  const matchedCase = matchCaseBlock(message);

  if (matchedCase) {
    const sections = [matchedCase.conclusion, "", matchedCase.principle];
    const boundaryNote = buildBoundaryNote(message);

    if (boundaryNote) {
      sections.push("", boundaryNote);
    }

    sections.push("", matchedCase.action);

    const questionBlock = buildQuestionBlock(matchedCase.questions);

    if (questionBlock) {
      sections.push("", questionBlock);
    }

    return sections.join("\n");
  }

  return [
    "我先说结论，这类问题别先盯着价格和热度，先把它还原成生意。",
    "",
    "股票不是代码，是公司未来现金流的一部分。真懂的生意，跌的时候先看生意有没有变；不懂的生意，涨得再热也不该重下注。",
    "",
    "我会先看四件事：它到底怎么赚钱，用户为什么会持续买，管理层和文化靠不靠谱，以及这是不是你的能力圈。",
    "",
    "如果这四件事你还讲不清，现在最好的动作通常不是立刻做决定，而是先继续看。",
  ].join("\n");
}

function buildCompanyFrameworkReply(companyName) {
  return [
    `我先说结论，${companyName}这类问题别先按热度下判断，还是要把它拆回到生意本身。`,
    "",
    `一，先看 ${companyName} 到底怎么赚钱。不是先看股价，而是先看它的收入从哪里来，毛利和现金流靠什么支撑，五年后有没有重复赚钱的能力。`,
    "",
    `二，再看用户为什么会持续买。你要搞清楚用户买的是功能、品牌、情绪价值，还是稀缺性；如果用户只是阶段性热情，那这门生意就要谨慎看。`,
    "",
    `三，再看管理层和文化靠不靠谱。真正重要的不是讲了多少故事，而是关键决策是不是长期一致，遇到诱惑时会不会为了短期数字把事情做歪。`,
    "",
    `四，最后看它是不是你的能力圈。你至少得能长期跟住这家公司最核心的几个变量，不然就算它是好公司，也未必是你的机会。`,
    "",
    `总的说，我不会急着给 ${companyName} 贴“好”或者“不好”的标签。我会先把这四件事一件件看清楚；如果其中两三件你现在还讲不清，那先继续看，比急着下结论更重要。`,
  ].join("\n");
}

function matchCaseBlock(message) {
  const matches = CASE_BLOCKS.map((caseBlock) => ({
    caseBlock,
    score: scoreCaseBlock(caseBlock, message),
  }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (right.caseBlock.priority || 0) - (left.caseBlock.priority || 0);
    });

  return matches[0]?.caseBlock || null;
}

function scoreCaseBlock(caseBlock, message) {
  const lowerMessage = message.toLowerCase();
  let score = 0;

  for (const keyword of caseBlock.triggers || []) {
    if (lowerMessage.includes(String(keyword).toLowerCase())) {
      score += String(keyword).length >= 3 ? 3 : 2;
    }
  }

  for (const pattern of caseBlock.patterns || []) {
    if (new RegExp(pattern, "i").test(message)) {
      score += 4;
    }
  }

  return score;
}

function buildQuestionBlock(questions) {
  const picked = Array.isArray(questions) ? questions.filter(Boolean).slice(0, 2) : [];

  if (!picked.length) {
    return "";
  }

  return ["你可以先想两个问题：", ...picked.map((question, index) => `${index + 1}. ${question}`)].join("\n");
}

function buildResearchPlan(message, companyName) {
  if (!companyName) {
    return null;
  }

  return {
    kind: "company-analysis",
    subject: companyName,
    conclusion: `我先说结论，${companyName}不能只按热度和价格下判断，还是要拆回到生意本身。`,
    summary: `总的说，我会把 ${companyName} 看成一门需要长期跟踪验证的生意，而不是一个只看热度就能下结论的标的。真正要紧的，不是别人这段时间赚没赚钱，而是你能不能持续跟住上面这四件事；如果其中两三件你现在还讲不清，那先继续看，比急着下结论更重要。`,
    fallbackReply: buildCompanyFrameworkReply(companyName),
    aspects: COMPANY_ANALYSIS_ASPECTS.map((aspect) => ({
      ...aspect,
      takeaway:
        aspect.id === "business"
          ? "所以这一段真正要看的，不是故事讲得多热闹，而是它的赚钱路径能不能重复。"
          : aspect.id === "user"
            ? "所以这里要盯的是，用户买的是一阵热闹，还是可持续的品牌和复购。"
            : aspect.id === "management"
              ? "所以关键不是创始人会不会讲故事，而是关键决策是不是长期一致。"
              : "所以最后还是回到能力圈，你能不能长期跟住这些关键变量。",
    })),
  };
}

async function maybeRunResearchPlan(researchPlan) {
  if (!BRAVE_API_KEY) {
    return null;
  }

  try {
    const aspects = await Promise.all(
      researchPlan.aspects.map(async (aspect) => {
        const query = typeof aspect.query === "function" ? aspect.query(researchPlan.subject) : String(aspect.query || "");
        const results = await searchBrave(query);
        return {
          ...aspect,
          query,
          items: pickEvidenceItems(results),
        };
      }),
    );

    return aspects;
  } catch (error) {
    console.error("[brave-retrieval-error]", error?.message || error);
    return null;
  }
}

async function searchBrave(query) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BRAVE_TIMEOUT_MS);

  try {
    const url = new URL(BRAVE_SEARCH_API_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("count", "5");
    url.searchParams.set("country", BRAVE_SEARCH_COUNTRY);
    url.searchParams.set("search_lang", BRAVE_SEARCH_LANG);
    url.searchParams.set("extra_snippets", "true");

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`brave ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    return (json.web?.results || []).map((result) => normalizeBraveResult(result));
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeBraveResult(result) {
  const snippets = [result?.description, ...(Array.isArray(result?.extra_snippets) ? result.extra_snippets : [])]
    .map((item) => cleanSnippet(item))
    .filter(Boolean);

  return {
    title: cleanSnippet(result?.title) || "未命名来源",
    url: String(result?.url || "").trim(),
    source: safeHostLabel(result?.url),
    snippet: snippets[0] || "",
  };
}

function pickEvidenceItems(results) {
  const seen = new Set();
  const items = [];

  for (const result of results) {
    if (!result.snippet || !result.url) {
      continue;
    }

    const key = `${result.source}-${result.title}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push({
      note: result.snippet,
      source: result.source,
      title: result.title,
      url: result.url,
    });

    if (items.length >= 3) {
      break;
    }
  }

  return items;
}

function buildRetrievedResearchReply(researchPlan, aspects) {
  const lines = [
    researchPlan.conclusion,
  ];

  for (const [index, aspect] of aspects.entries()) {
    lines.push("", `${toChineseIndex(index + 1)}，${aspect.title}`);

    if (!aspect.items.length) {
      lines.push("这块我这次没有拿到足够稳定的公开信息，所以先不急着替你下结论。");
      continue;
    }

    lines.push("我先检索到几个值得盯住的点：");
    lines.push(...aspect.items.map((item) => `- ${item.note}（来源：${item.source}）`));

    if (aspect.takeaway) {
      lines.push(aspect.takeaway);
    }
  }

  lines.push("", researchPlan.summary);

  return lines.join("\n");
}

function buildRetrievedResearchContext(researchPlan, aspects) {
  const lines = [
    `用户正在问一个需要分点检索的问题，主题是：${researchPlan.subject}。`,
    "请优先用总分总结构回答。",
    "第一段先给结论。",
    "中间几段按给定的检索主题顺序回答，每段都先说关键信息，再落回判断。",
    "最后再用一段收束，强调先看懂生意，不做短线预测，不给仓位建议。",
    "只能使用下面的公开检索信息，不要编造没有检索到的事实。",
  ];

  for (const aspect of aspects) {
    lines.push("", `【${aspect.title}】`);

    if (!aspect.items.length) {
      lines.push("- 暂无足够稳定的公开结果");
      continue;
    }

    lines.push(...aspect.items.map((item) => `- ${item.note}（来源：${item.source}，${item.title}）`));
  }

  return lines.join("\n");
}

function analyzeMessageRouting(message) {
  const subject = extractCompanyAnalysisTarget(message);

  return {
    retrievalEligible: Boolean(subject),
    planType: subject ? "company-analysis" : "none",
    reason: subject ? "concrete-company-or-stock" : "broad-question-or-no-concrete-company",
    subject,
  };
}

function extractCompanyAnalysisTarget(message) {
  const trimmed = message.trim();
  const patterns = [
    /^对\s*([^，。？\s]{2,24}?)(?:这家公司|这个公司|公司|企业)\s*(?:你怎么看|怎么看|怎么看待|怎么样|值不值得(?:长期)?看|是不是好公司|值不值得买|能不能买)/,
    /^([^，。？\s]{2,24}?)(?:这家公司|这个公司|公司|企业)\s*(?:你怎么看|怎么看|怎么看待|怎么样|值不值得(?:长期)?看|是不是好公司|值不值得买|能不能买)/,
    /^(?:聊聊|分析一下|说说)\s*([^，。？\s]{2,24}?)(?:这家公司|这个公司|公司|企业|股票)?[？?]?$/,
    /^对\s*([^，。？\s]{2,24}?)(?:你怎么看|怎么看|怎么样|值不值得(?:长期)?看|是不是好公司|值不值得买|能不能买)/,
    /^([^，。？\s]{2,24}?)(?:怎么样|怎么看|值不值得(?:长期)?看|是不是好公司|值不值得买|能不能买)[？?]?$/,
    /^([^，。？\s]{2,24}?)\s*(?:PE|市盈率|估值|股价|跌了?|大跌).*(?:能买吗|贵不贵|怎么看|值不值得)/i,
    /^([A-Za-z][A-Za-z0-9.\-]{1,12}|\d{4,6}(?:\.(?:HK|US|SZ|SH))?)\s*(?:现在)?\s*(?:怎么看|怎么样|值不值得(?:长期)?看|值不值得买|能买吗|还能拿吗|还能不能长期拿)[？?]?$/i,
  ];

  for (const pattern of patterns) {
    const matched = trimmed.match(pattern);

    if (!matched?.[1]) {
      continue;
    }

    const companyName = matched[1]
      .replace(/^(对|把|看)\s*/g, "")
      .replace(/(的股票|股票|港股|美股|A股)$/g, "")
      .trim();

    if (isConcreteCompanyOrStock(companyName)) {
      return companyName;
    }
  }

  return null;
}

function isConcreteCompanyOrStock(candidate) {
  const value = String(candidate || "").trim();

  if (!value) {
    return false;
  }

  if (/^(这|这个|这家|公司|企业|股票|生意|行业|赛道|方法论|观点|教育|人生|孩子|能力圈|创业|投资|好公司)$/i.test(value)) {
    return false;
  }

  if (/^\d{4,6}(?:\.(?:HK|US|SZ|SH))?$/i.test(value)) {
    return true;
  }

  if (/^[A-Za-z][A-Za-z0-9.\-]{1,12}$/i.test(value)) {
    return true;
  }

  return /[\u4e00-\u9fa5]{2,}/.test(value);
}

function cleanSnippet(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[•▪◦]/g, "")
    .replace(/<\/?[^>]+>/g, "")
    .trim();
}

function safeHostLabel(value) {
  try {
    return new URL(String(value)).hostname.replace(/^www\./, "");
  } catch {
    return "公开资料";
  }
}

function toChineseIndex(number) {
  return ["一", "二", "三", "四", "五", "六"][number - 1] || String(number);
}

function buildBoundaryNote(message) {
  const notes = [];

  if (/(明天|下周|短线|目标价|止损|仓位|点位|翻倍|涨停)/.test(message)) {
    notes.push("短期涨跌、点位和仓位我不会替你猜，那不是我关心的重点。");
  }

  if (/(融资|杠杆|做空|融券)/i.test(message)) {
    notes.push("少犯大错通常比多做几个激进动作更重要。");
  }

  return notes.join("\n");
}

async function streamText(res, text) {
  const chunks = chunkText(text, 16);

  for (const chunk of chunks) {
    res.write(chunk);
    await sleep(28);
  }

  res.end();
}

function chunkText(text, size) {
  const chunks = [];

  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }

  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function serveStatic(pathname, res) {
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(PUBLIC_DIR, relativePath));

  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    return sendText(res, 404, "Not Found");
  }

  const data = await readFile(filePath);
  const mimeType = MIME_TYPES[extname(filePath)] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": mimeType,
    "Cache-Control": "no-cache",
  });
  res.end(data);
}

async function readJsonBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;
  }

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function sendJson(res, status, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(text);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(text);
}

async function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = await readFile(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function loadJsonFile(filePath, fallback) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("[json-load-error]", filePath, error?.message || error);
    return fallback;
  }
}
