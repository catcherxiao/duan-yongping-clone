import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const CASE_BLOCKS_FILE = join(ROOT, "data", "case-blocks.json");
const PORT = Number(process.env.PORT || 3033);
const execFileAsync = promisify(execFile);
const CURRENT_YEAR = new Date().getFullYear();
const RECENT_YEAR_HINTS = [CURRENT_YEAR, CURRENT_YEAR - 1].join(" ");

await loadDotEnv(join(ROOT, ".env"));
const CASE_BLOCKS = await loadJsonFile(CASE_BLOCKS_FILE, []);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4";
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
    query: (companyName) => `${companyName} 最新 财报 年报 收入 毛利 现金流 业绩 ${RECENT_YEAR_HINTS}`,
  },
  {
    id: "user",
    title: "再看用户为什么会持续买",
    query: (companyName) => `${companyName} 最新 用户 品牌 复购 社区 IP 门店 海外 ${RECENT_YEAR_HINTS}`,
  },
  {
    id: "management",
    title: "再看管理层和文化靠不靠谱",
    query: (companyName) => `${companyName} 最新 创始人 管理层 战略 业绩会 采访 ${RECENT_YEAR_HINTS}`,
  },
  {
    id: "circle",
    title: "最后看它是不是你的能力圈",
    query: (companyName) => `${companyName} 最新 风险 竞争 监管 海外 扩张 关键变量 ${RECENT_YEAR_HINTS}`,
  },
];
const ASPECT_KEYWORD_MAP = {
  business: ["商业", "模式", "收入", "利润", "毛利", "现金流", "业绩", "财报", "年报", "品类", "授权", "零售", "出海"],
  user: ["用户", "品牌", "复购", "社群", "社区", "门店", "粉丝", "情绪", "收藏", "海外", "labubu", "molly", "the monsters"],
  management: ["创始人", "管理层", "文化", "战略", "业绩会", "采访", "长期", "组织", "执行", "王宁", "ceo", "董事长"],
  circle: ["风险", "竞争", "监管", "估值", "扩张", "争议", "海外", "挑战", "变量", "依赖", "生命周期", "本土化"],
  risk: ["风险", "竞争", "监管", "扩张", "争议", "海外", "挑战", "变量", "依赖", "生命周期", "本土化", "关税", "汇率"],
  moat: ["护城河", "品牌", "ip", "复购", "用户", "渠道", "门店", "社群", "情绪", "收藏", "认同"],
  valuation: ["估值", "pe", "市盈率", "ps", "市销率", "市值", "预期", "成长", "贵", "便宜"],
};
const PREFERRED_SOURCE_SCORES = {
  "hkexnews.hk": 80,
  "prod-out-res.popmart.com": 80,
  "popmart.com": 75,
  "www.popmart.com": 75,
  "36kr.com": 46,
  "m.36kr.com": 46,
  "cbndata.com": 42,
  "m.cbndata.com": 42,
  "stcn.com": 40,
  "epaper.stcn.com": 40,
  "finance.sina.com.cn": 32,
  "k.sina.com.cn": 20,
  "cls.cn": 32,
  "m.cls.cn": 32,
  "news.cn": 40,
  "thepaper.cn": 28,
  "m.thepaper.cn": 28,
  "time-weekly.com": 28,
  "tfcaijing.com": 28,
  "jiemian.com": 26,
  "www.jiemian.com": 26,
};
const FOCUSED_COMPANY_TOPICS = {
  business: {
    id: "business",
    title: "只看赚钱模式",
    query: (companyName) => `${companyName} 最新 财报 年报 收入 利润 毛利 现金流 品类 ${RECENT_YEAR_HINTS}`,
    introLine: (companyName) => `如果只看${companyName}怎么赚钱，我会先盯财报和品类结构，不会先盯股价。`,
    takeaway: "所以最后还是看，它赚到的钱是不是可重复，别把一时爆款当成永远的生意模式。",
  },
  user: {
    id: "user",
    title: "只看用户和复购",
    query: (companyName) => `${companyName} 最新 用户 复购 品牌 社区 IP 门店 体验 ${RECENT_YEAR_HINTS}`,
    introLine: (companyName) => `如果只看${companyName}的用户和复购，我更在意大家为什么会一买再买。`,
    takeaway: "所以这里看的是用户心智和复购，不是短期热度。",
  },
  management: {
    id: "management",
    title: "只看管理层",
    query: (companyName) => `${companyName} 最新 创始人 管理层 业绩会 战略 采访 长期 ${RECENT_YEAR_HINTS}`,
    introLine: (companyName) => `如果只看${companyName}的管理层，我主要看他们是不是清醒，是不是还在做对的事情。`,
    takeaway: "所以关键不是话说得多漂亮，而是有没有主动克制、有没有长期感。",
  },
  risk: {
    id: "risk",
    title: "只看风险",
    query: (companyName) => `${companyName} 最新 风险 竞争 监管 海外 关税 汇率 依赖 生命周期 ${RECENT_YEAR_HINTS}`,
    introLine: (companyName) => `如果只看${companyName}的风险，我最在意的不是短期波动，而是生意里真正可能变坏的地方。`,
    takeaway: "所以风险不是股价跌多少，而是核心变量会不会变差。",
  },
  moat: {
    id: "moat",
    title: "只看护城河",
    query: (companyName) => `${companyName} 最新 护城河 品牌 IP 复购 渠道 用户 ${RECENT_YEAR_HINTS}`,
    introLine: (companyName) => `如果只看${companyName}的护城河，我会说它有，但没简单到可以一劳永逸。`,
    takeaway: "所以护城河不是某个爆款本身，而是持续做出被喜欢的IP、把用户留住的能力。",
  },
  valuation: {
    id: "valuation",
    title: "只看估值",
    query: (companyName) => `${companyName} 最新 估值 PE 市盈率 PS 市销率 市值 增长 预期 ${RECENT_YEAR_HINTS}`,
    introLine: (companyName) => `如果只看${companyName}的估值，我一般会更保守一点，因为估值从来不是单独看的。`,
    takeaway: "所以估值要和增长质量一起看，别把高增长直接外推。",
  },
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const SYSTEM_PROMPT = [
  "你要用段永平公开表达里常见的思路和语气来回答。",
  "回答规则：",
  "1. 先给结论，再说为什么。",
  "2. 优先回到本分、能力圈、长期主义、买股票就是买公司、少犯错。",
  "3. 不做短线预测，不做仓位建议，不鼓励杠杆、做空和题材投机。",
  "4. 语气平静、直接、简洁，像一个长期主义者在说人话，不像券商研报或媒体评论。",
  "5. 尽量用短句，判断优先，少堆形容词。",
  "6. 不要使用 Markdown 标题、加粗、项目符号样式，直接自然分段。",
  "7. 适度口语化，可以说“我会看得很重”“看不懂就先别碰”，但不要刻意表演。",
  "8. 信息不足时，先问 2 到 4 个高信号问题。",
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

    if (url.pathname === "/api/plan" && (req.method === "GET" || req.method === "POST")) {
      const payload = req.method === "POST" ? await readJsonBody(req) : {};
      const message = req.method === "POST" ? String(payload?.message || "").trim() : String(url.searchParams.get("message") || "").trim();
      const history = normalizeConversationHistory(req.method === "POST" ? payload?.history : []);
      const conversationContext = buildConversationContext(history);
      const routing = analyzeMessageRouting(message, conversationContext);

      return sendJson(res, 200, {
        message,
        retrievalEnabled: Boolean(BRAVE_API_KEY),
        retrievalEligible: routing.retrievalEligible,
        planType: routing.planType,
        reason: routing.reason,
        subject: routing.subject,
        focusTopicId: routing.focusTopicId || null,
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
  const history = normalizeConversationHistory(payload?.history);

  if (!message) {
    return sendJson(res, 400, { error: "message is required" });
  }

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const replyPlan = await buildReplyPlan(message, history);

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

  let response;

  try {
    response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
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
  } catch (error) {
    const fallbackText = await requestOpenAITextViaCurl(history, message, replyPlan).catch(() => null);

    if (fallbackText) {
      await streamText(res, fallbackText);
      return;
    }

    throw error;
  }

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    const fallbackText = await requestOpenAITextViaCurl(history, message, replyPlan).catch(() => null);

    if (fallbackText) {
      await streamText(res, fallbackText);
      return;
    }

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

  if (!res.writableEnded && !contentBuffer) {
    const fallbackText = await requestOpenAITextViaCurl(history, message, replyPlan).catch(() => null);

    if (fallbackText) {
      await streamText(res, fallbackText);
      return;
    }
  }

  res.end();
}

async function requestOpenAITextViaCurl(history, message, replyPlan) {
  const requestBody = JSON.stringify({
    model: OPENAI_MODEL,
    ...(IS_MINIMAX ? { reasoning_split: true } : {}),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...(replyPlan?.modelContext ? [{ role: "system", content: replyPlan.modelContext }] : []),
      ...history,
      { role: "user", content: message },
    ],
  });

  const { stdout } = await execFileAsync(
    "curl",
    [
      "-s",
      "--max-time",
      "120",
      `${OPENAI_BASE_URL}/chat/completions`,
      "-H",
      "Content-Type: application/json",
      "-H",
      `Authorization: Bearer ${OPENAI_API_KEY}`,
      "-d",
      requestBody,
    ],
    { maxBuffer: 12 * 1024 * 1024 },
  );

  const json = JSON.parse(stdout);

  if (json?.error) {
    throw new Error(`openai api error: ${json.error?.message || "unknown error"}`);
  }

  const content = extractAssistantText(json);

  if (!content) {
    throw new Error("openai api error: empty assistant content");
  }

  return content;
}

function extractAssistantText(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (typeof item?.text === "string") {
          return item.text;
        }

        return "";
      })
      .filter(Boolean)
      .join("");
  }

  return "";
}

async function buildReplyPlan(message, history = []) {
  const conversationContext = buildConversationContext(history);
  const routing = analyzeMessageRouting(message, conversationContext);
  const companyName = routing.subject;
  const researchPlan = buildResearchPlan(message, routing, conversationContext);

  if (researchPlan) {
    const research = await maybeRunResearchPlan(researchPlan);

    if (research?.some((aspect) => aspect.items.length > 0)) {
      return {
        localReply: buildRetrievedResearchReply(researchPlan, research),
        modelContext: buildRetrievedResearchContext(researchPlan, research, conversationContext),
      };
    }
  }

  return {
    localReply:
      routing.planType === "company-followup"
        ? buildCompanyFollowUpFallbackReply(companyName, routing.focusTopicId)
        : companyName
          ? buildCompanyFrameworkReply(companyName)
          : buildMockReply(message),
    modelContext: buildConversationCarryContext(routing, conversationContext),
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

function buildCompanyFollowUpFallbackReply(companyName, focusTopicId) {
  const topicId = focusTopicId && FOCUSED_COMPANY_TOPICS[focusTopicId] ? focusTopicId : "risk";

  if (topicId === "moat") {
    return [
      `我先说结论，${companyName}是有护城河的，但不是那种躺着就不会变浅的护城河。`,
      "",
      "它的护城河更多在IP运营、用户心智、渠道触达和复购机制，不在单个爆款本身。",
      "",
      `所以别把${companyName}看成一门简单的玩具生意，要看它能不能持续做出被喜欢的东西。`,
    ].join("\n");
  }

  if (topicId === "valuation") {
    return [
      `我先说结论，只看${companyName}估值的话，我会更保守一点。`,
      "",
      "这种公司估值不能脱离增长质量、IP接力和用户复购单独看。",
      "",
      "所以问题不是静态PE高不高，而是未来两三年的增长和质量值不值这个价。",
    ].join("\n");
  }

  if (topicId === "management") {
    return [
      `我先说结论，${companyName}管理层至少目前看还是在线的。`,
      "",
      "我主要看他们是不是知道自己在做什么，是不是愿意为了长期结果克制短期冲动。",
      "",
      "真正重要的不是嘴上怎么说，而是高增长之后还能不能稳住节奏，不把事情做歪。",
    ].join("\n");
  }

  if (topicId === "user") {
    return [
      `我先说结论，${companyName}的复购逻辑是真有的，但它不是刚需复购。`,
      "",
      "用户买的不是塑料本身，而是情绪价值、收藏感和圈层认同。",
      "",
      "所以要盯的是新IP接力和用户新鲜感，而不是只看某一阵子的热度。",
    ].join("\n");
  }

  if (topicId === "business") {
    return [
      `我先说结论，${companyName}的赚钱模式是成立的。`,
      "",
      "它本质上是在做IP运营平台，把内容、商品和渠道一起变现。",
      "",
      "但这种生意最怕把爆款当常态，所以要看赚钱能力能不能重复。",
    ].join("\n");
  }

  return [
    `我先说结论，${companyName}真正要小心的，不是一天两天的股价，而是生意里会不会有关键变量变坏。`,
    "",
    "我最在意的是头部IP依赖、海外扩张质量、监管变化和用户热度能不能接得住。",
    "",
    "所以风险要从生意里找，不要只从行情里找。",
  ].join("\n");
}

function buildCompanyFollowUpConclusion(companyName, focusTopicId) {
  if (focusTopicId === "moat") {
    return `我先说结论，${companyName}有护城河，但护城河不是单个爆款本身，而是持续做IP、做复购和做渠道触达的能力。`;
  }

  if (focusTopicId === "valuation") {
    return `我先说结论，只看${companyName}估值的话，我会更保守一点，因为这种公司不能只拿静态数字下判断。`;
  }

  if (focusTopicId === "management") {
    return `我先说结论，${companyName}管理层至少目前看还算清醒，知道什么时候该降速，什么时候该守质量。`;
  }

  if (focusTopicId === "user") {
    return `我先说结论，${companyName}用户复购是有基础的，但本质上还是情绪消费，不是刚需。`;
  }

  if (focusTopicId === "business") {
    return `我先说结论，${companyName}赚钱模式已经被验证了，但更重要的是这种赚钱方式能不能持续。`;
  }

  return `我先说结论，${companyName}最大的风险不在短期涨跌，而在关键变量会不会开始变坏。`;
}

function buildCompanyFollowUpSummary(companyName, focusTopicId) {
  if (focusTopicId === "moat") {
    return `总的说，${companyName}的护城河偏动态，不是静态护城河。要持续有东西被用户喜欢，这条河才算在。`;
  }

  if (focusTopicId === "valuation") {
    return `总的说，${companyName}估值要和增长质量一起看。高增长公司最怕把最好的一段时间当成永远。`;
  }

  if (focusTopicId === "management") {
    return `总的说，${companyName}管理层值不值得信，最后看行动，不看口号。长期感比一时激情更重要。`;
  }

  if (focusTopicId === "user") {
    return `总的说，${companyName}复购是有的，但要持续跟踪用户热度、新品接力和线下体验。`;
  }

  if (focusTopicId === "business") {
    return `总的说，${companyName}赚钱模式已经成立，但能不能长期重复，才是更要紧的问题。`;
  }

  return `总的说，${companyName}这类公司最要命的风险，不是市场情绪，而是IP接力、海外扩张和用户热度一旦同时变弱。`;
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

function buildResearchPlan(message, routing, conversationContext) {
  const companyName = routing.subject;

  if (!companyName) {
    return null;
  }

  if (routing.planType === "company-followup") {
    return buildFocusedCompanyResearchPlan(companyName, routing.focusTopicId, conversationContext);
  }

  return {
    kind: "company-analysis",
    subject: companyName,
    conclusion: `我先说结论，${companyName}不能只按热度和价格下判断，还是要拆回到生意本身。`,
    summary: `总的说，我会把 ${companyName} 看成一门需要长期跟踪验证的生意，而不是一个只看热度就能下结论的标的。真正要紧的，不是别人这段时间赚没赚钱，而是你能不能持续跟住上面这四件事；如果其中两三件你现在还讲不清，那先继续看，比急着下结论更重要。`,
    fallbackReply: buildCompanyFrameworkReply(companyName),
    aspects: COMPANY_ANALYSIS_ASPECTS.map((aspect) => ({
      ...aspect,
      introLine: buildCompanyAspectIntro(companyName, aspect.id),
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

function buildFocusedCompanyResearchPlan(companyName, focusTopicId, conversationContext) {
  const focusedTopic = FOCUSED_COMPANY_TOPICS[focusTopicId] || FOCUSED_COMPANY_TOPICS.risk;

  return {
    kind: "company-followup",
    subject: companyName,
    focusTopicId: focusedTopic.id,
    conclusion: buildCompanyFollowUpConclusion(companyName, focusedTopic.id),
    summary: buildCompanyFollowUpSummary(companyName, focusedTopic.id),
    fallbackReply: buildCompanyFollowUpFallbackReply(companyName, focusedTopic.id),
    conversationContext,
    aspects: [
      {
        ...focusedTopic,
        query: typeof focusedTopic.query === "function" ? focusedTopic.query(companyName) : focusedTopic.query,
        introLine: focusedTopic.introLine(companyName),
        maxItems: 2,
      },
    ],
  };
}

async function maybeRunResearchPlan(researchPlan) {
  if (!BRAVE_API_KEY) {
    return null;
  }

  try {
    if (researchPlan.kind === "company-analysis") {
      return await runCompanyAspectQueries(researchPlan);
    }

    const aspects = await Promise.all(
      researchPlan.aspects.map(async (aspect) => {
        const query = typeof aspect.query === "function" ? aspect.query(researchPlan.subject) : String(aspect.query || "");
        const results = await searchBrave(query);
        return {
          ...aspect,
          query,
          items: pickEvidenceItems(results, aspect.id, aspect.maxItems),
        };
      }),
    );

    return aspects;
  } catch (error) {
    console.error("[brave-retrieval-error]", error?.message || error);
    return null;
  }
}

async function runCompanyAspectQueries(researchPlan) {
  const collected = [];

  for (const aspect of researchPlan.aspects) {
    const query = typeof aspect.query === "function" ? aspect.query(researchPlan.subject) : String(aspect.query || "");

    try {
      const results = await searchBrave(query);
      collected.push({
        ...aspect,
        query,
        items: pickEvidenceItems(results, aspect.id, aspect.maxItems),
      });
      await sleep(180);
    } catch (error) {
      if (/RATE_LIMITED/i.test(error?.message || "")) {
        const bundleQuery = buildCompanyBundleQuery(researchPlan.subject);
        const bundleResults = await searchBrave(bundleQuery);
        return distributeCompanyEvidence(researchPlan.aspects, bundleResults, bundleQuery);
      }

      collected.push({
        ...aspect,
        query,
        items: [],
      });
    }
  }

  return collected;
}

function buildCompanyBundleQuery(companyName) {
  return `${companyName} 最新 财报 业绩 用户 品牌 创始人 管理层 风险 竞争 海外 ${RECENT_YEAR_HINTS}`;
}

function distributeCompanyEvidence(aspects, results, bundleQuery) {
  const normalized = results.map((item) => ({
    ...item,
    haystack: `${item.title} ${item.snippet}`.toLowerCase(),
  }));

  const fallbackPool = normalized.slice(0, 6);

  return aspects.map((aspect) => {
    const keywords = ASPECT_KEYWORD_MAP[aspect.id] || [];
    const matched = normalized.filter((item) => keywords.some((keyword) => item.haystack.includes(keyword)));
    const selected = pickEvidenceItems((matched.length ? matched : fallbackPool).map(stripHaystack), aspect.id, aspect.maxItems);

    return {
      ...aspect,
      query: bundleQuery,
      items: selected,
    };
  });
}

function stripHaystack(item) {
  const { haystack, ...rest } = item;
  return rest;
}

async function searchBrave(query) {
  try {
    const url = new URL(BRAVE_SEARCH_API_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("count", "8");
    url.searchParams.set("country", BRAVE_SEARCH_COUNTRY);
    url.searchParams.set("search_lang", BRAVE_SEARCH_LANG);
    url.searchParams.set("extra_snippets", "true");

    const { stdout } = await execFileAsync("curl", [
      "-s",
      "--max-time",
      String(Math.max(3, Math.ceil(BRAVE_TIMEOUT_MS / 1000))),
      "--compressed",
      url.toString(),
      "-H",
      "Accept: application/json",
      "-H",
      `X-Subscription-Token: ${BRAVE_API_KEY}`,
    ]);

    const json = JSON.parse(stdout);

    if (json?.type === "ErrorResponse") {
      throw new Error(`brave api error: ${json.error?.code || "unknown"} ${json.error?.detail || ""}`.trim());
    }

    return (json.web?.results || []).map((result) => normalizeBraveResult(result));
  } catch (error) {
    const directResults = await searchBraveDirect(query).catch((directError) => {
      throw new Error(
        `${error?.message || error}; direct-fetch-fallback failed: ${directError?.message || directError}`,
      );
    });

    return directResults;
  }
}

async function searchBraveDirect(query) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BRAVE_TIMEOUT_MS);

  try {
    const url = new URL(BRAVE_SEARCH_API_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("count", "8");
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
    pageAge: String(result?.page_age || "").trim(),
    age: String(result?.age || "").trim(),
  };
}

function pickEvidenceItems(results, aspectId = "", maxItems = 3) {
  const seen = new Set();
  const items = [];
  const ranked = results
    .filter((result) => isUsableEvidenceResult(result))
    .map((result) => ({
      ...result,
      score: scoreEvidenceResult(result, aspectId),
    }))
    .sort((left, right) => right.score - left.score);

  for (const result of ranked) {
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
      pageAge: result.pageAge,
    });

    if (items.length >= maxItems) {
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
    lines.push("", aspect.introLine || `${toChineseIndex(index + 1)}，${aspect.title}`);

    if (!aspect.items.length) {
      lines.push("这块我这次没有拿到足够稳定的公开信息，所以先不急着替你下结论。");
      continue;
    }

    lines.push("我先检索到几个值得盯住的点：");
    lines.push(...aspect.items.map((item) => `- ${item.note}`));

    if (aspect.takeaway) {
      lines.push(aspect.takeaway);
    }
  }

  lines.push("", researchPlan.summary);

  return lines.join("\n");
}

function buildCompanyAspectIntro(companyName, aspectId) {
  if (aspectId === "business") {
    return `一，先看 ${companyName} 到底怎么赚钱。不是先看股价，而是先看它的收入从哪里来，毛利和现金流靠什么支撑，五年后有没有重复赚钱的能力。`;
  }

  if (aspectId === "user") {
    return "二，再看用户为什么会持续买。你要搞清楚用户买的是功能、品牌、情绪价值，还是稀缺性；如果用户只是阶段性热情，那这门生意就要谨慎看。";
  }

  if (aspectId === "management") {
    return "三，再看管理层和文化靠不靠谱。真正重要的不是讲了多少故事，而是关键决策是不是长期一致，遇到诱惑时会不会为了短期数字把事情做歪。";
  }

  return `四，最后看它是不是你的能力圈。你至少得能长期跟住${companyName}这家公司最核心的几个变量，不然就算它是好公司，也未必是你的机会。`;
}

function buildRetrievedResearchContext(researchPlan, aspects, conversationContext = {}) {
  const lines = [
    `用户正在问一个需要分点检索的问题，主题是：${researchPlan.subject}。`,
    "请优先用总分总结构回答。",
    "第一段先给结论。",
    researchPlan.kind === "company-followup"
      ? "这是多轮追问，只回答当前这一点，不要把完整四段重讲一遍。整段控制在3段以内，别写长文。"
      : "中间几段按给定的检索主题顺序回答，每段先用1到2个最新论据，再给判断。",
    "尽量优先使用最近12到18个月的信息；旧年份信息只在缺少新信息时补充。",
    "不要标注来源，不要写成媒体综述，不要像研报。",
    "不要输出 Markdown 加粗或列表样式，直接像聊天一样分段表达。",
    researchPlan.kind === "company-followup" ? "追问回答里，最多抓2个关键论据和1到2个关键数字就够了。" : "数字只挑最关键的，不要堆。",
    "最后再用一段收束，强调先看懂生意，不做短线预测，不给仓位建议。",
    "只能使用下面的公开检索信息，不要编造没有检索到的事实。",
  ];

  if (conversationContext?.lastCompanySubject && researchPlan.kind === "company-followup") {
    lines.push(`上一轮已经在聊 ${conversationContext.lastCompanySubject}，这一轮属于接着往下聊。`);
  }

  for (const aspect of aspects) {
    lines.push("", `【${aspect.title}】`);

    if (!aspect.items.length) {
      lines.push("- 暂无足够稳定的公开结果");
      continue;
    }

    lines.push(
      ...aspect.items.map((item) => {
        const recencyLabel = formatEvidenceRecency(item.pageAge);
        return recencyLabel ? `- [${recencyLabel}] ${item.note}` : `- ${item.note}`;
      }),
    );
  }

  return lines.join("\n");
}

function buildConversationCarryContext(routing, conversationContext = {}) {
  if (routing.planType !== "company-followup" || !routing.subject) {
    return "";
  }

  const focusTopic = FOCUSED_COMPANY_TOPICS[routing.focusTopicId || "risk"];
  const lines = [
    `这是同一段对话里的追问，继续围绕 ${routing.subject} 回答。`,
    `这次用户重点问的是：${focusTopic?.title || "当前追问"}。`,
    "不要把前一轮完整框架从头再讲，直接答当前这一点。",
    "保持短句、直接、像聊天，不要写成长文。",
  ];

  return lines.join("\n");
}

function buildConversationContext(history) {
  const recentHistory = normalizeConversationHistory(history);
  const recentUserMessages = recentHistory.filter((item) => item.role === "user");
  let lastCompanySubject = null;

  for (const item of recentUserMessages) {
    const subject = extractCompanyAnalysisTarget(item.content);

    if (subject) {
      lastCompanySubject = subject;
    }
  }

  return {
    lastCompanySubject,
    lastUserMessage: recentUserMessages.at(-1)?.content || "",
    lastAssistantMessage: recentHistory.filter((item) => item.role === "assistant").at(-1)?.content || "",
  };
}

function analyzeMessageRouting(message, conversationContext = {}) {
  const subject = extractCompanyAnalysisTarget(message);
  const focusTopicId = detectFocusedCompanyTopic(message);

  if (subject) {
    const focused = isFocusedCompanyQuestion(message, focusTopicId);

    return {
      retrievalEligible: true,
      planType: focused ? "company-followup" : "company-analysis",
      reason: focused ? "concrete-company-focused-question" : "concrete-company-or-stock",
      subject,
      focusTopicId: focused ? focusTopicId || "risk" : null,
    };
  }

  if (conversationContext.lastCompanySubject && isLikelyCarryForwardFollowUp(message, focusTopicId)) {
    return {
      retrievalEligible: true,
      planType: "company-followup",
      reason: "follow-up-from-history",
      subject: conversationContext.lastCompanySubject,
      focusTopicId: focusTopicId || "risk",
    };
  }

  return {
    retrievalEligible: false,
    planType: "none",
    reason: "broad-question-or-no-concrete-company",
    subject: null,
    focusTopicId: null,
  };
}

function extractCompanyAnalysisTarget(message) {
  const trimmed = message.trim();
  const patterns = [
    /^对\s*([^，。？\s]{2,24}?)(?:这家公司|这个公司|公司|企业)\s*(?:你怎么看|怎么看|怎么看待|怎么样|值不值得(?:长期)?看|是不是好公司|值不值得买|能不能买)/,
    /^([^，。？\s]{2,24}?)(?:这家公司|这个公司|公司|企业)\s*(?:你怎么看|怎么看|怎么看待|怎么样|值不值得(?:长期)?看|是不是好公司|值不值得买|能不能买)/,
    /^(?:聊聊|分析一下|说说)\s*([^，。？\s]{2,24}?)(?:这家公司|这个公司|公司|企业|股票)?[？?]?$/,
    /^(?:那|如果是|单说|只看|展开说说|细说|继续说)\s*([^，。？\s]{2,24}?)(?:这家公司|这个公司|公司|企业|股票)?(?:呢|的话|怎么样|怎么看)?[？?]?$/,
    /^对\s*([^，。？\s]{2,24}?)(?:你怎么看|怎么看|怎么样|值不值得(?:长期)?看|是不是好公司|值不值得买|能不能买)/,
    /^([^，。？\s]{2,24}?)(?:怎么样|怎么看|值不值得(?:长期)?看|是不是好公司|值不值得买|能不能买)[？?]?$/,
    /^([^，。？\s]{2,24}?)的(?:护城河|风险|估值|管理层|用户|复购|品牌|海外|出海|生意|商业模式|盈利|赚钱|问题|看法)(?:呢|怎么看|怎么样)?[？?]?$/,
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

function detectFocusedCompanyTopic(message) {
  const trimmed = String(message || "").trim();

  if (!trimmed) {
    return null;
  }

  if (/(估值|PE|市盈率|市销率|PS|贵不贵|便宜|值不值这个价|值不值这个估值)/i.test(trimmed)) {
    return "valuation";
  }

  if (/(护城河|竞争优势|壁垒|品牌力|用户粘性)/i.test(trimmed)) {
    return "moat";
  }

  if (/(管理层|王宁|团队|创始人|文化|组织|执行|战略)/i.test(trimmed)) {
    return "management";
  }

  if (/(用户|复购|粉丝|情绪价值|社区|社群|为什么会买|为什么持续买|人群)/i.test(trimmed)) {
    return "user";
  }

  if (/(怎么赚钱|商业模式|生意模式|收入|利润|毛利|现金流|盈利|赚钱)/i.test(trimmed)) {
    return "business";
  }

  if (/(风险|最大的问题|最大的风险|隐患|竞争|监管|关税|汇率|海外|出海|挑战|依赖|生命周期)/i.test(trimmed)) {
    return "risk";
  }

  return null;
}

function isFocusedCompanyQuestion(message, focusTopicId) {
  if (!focusTopicId) {
    return false;
  }

  return !/(这家公司你怎么看|这个公司你怎么看|公司你怎么看|是不是好公司|值不值得长期看)/.test(message);
}

function isLikelyCarryForwardFollowUp(message, focusTopicId) {
  const trimmed = String(message || "").trim();

  if (!trimmed) {
    return false;
  }

  if (extractCompanyAnalysisTarget(trimmed)) {
    return false;
  }

  const followUpHints = /(那|那它|它|这家公司|这个公司|前面|刚才|继续|展开说说|细说|只看|单看|如果只看|那如果|为什么|怎么看|还有呢)/;

  if (focusTopicId && (followUpHints.test(trimmed) || trimmed.length <= 24)) {
    return true;
  }

  return followUpHints.test(trimmed) && trimmed.length <= 18;
}

function isConcreteCompanyOrStock(candidate) {
  const value = String(candidate || "").trim();

  if (!value) {
    return false;
  }

  if (
    /^(这|这个|这家|它|那|公司|企业|股票|生意|行业|赛道|方法论|观点|教育|人生|孩子|能力圈|创业|投资|好公司|护城河|风险|估值|管理层|用户|复购|品牌|商业模式|生意模式|赚钱|盈利|问题|看法)$/i.test(
      value,
    )
  ) {
    return false;
  }

  if (/(最大的风险|什么风险|护城河|估值|管理层|复购|用户|为什么|是什么|怎么看|怎么样|值不值)/.test(value)) {
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
    .replace(/We cannot provide a description for this page right now/gi, "")
    .replace(/点击.*查看详情.*/gi, "")
    .replace(/查看更多.*/gi, "")
    .trim();
}

function safeHostLabel(value) {
  try {
    return new URL(String(value)).hostname.replace(/^www\./, "");
  } catch {
    return "公开资料";
  }
}

function isUsableEvidenceResult(result) {
  const snippet = String(result?.snippet || "").trim();
  const title = String(result?.title || "").trim();
  const source = String(result?.source || "").trim();

  if (!snippet || !result?.url || snippet.length < 18) {
    return false;
  }

  if (/we cannot provide a description/i.test(snippet)) {
    return false;
  }

  if (/wikipedia\.org/i.test(source)) {
    return false;
  }

  if (/^(知乎|百度|豆瓣|微博|小红书|B站|bilibili)$/i.test(title)) {
    return false;
  }

  return true;
}

function scoreEvidenceResult(result, aspectId) {
  const haystack = `${result.title} ${result.snippet}`.toLowerCase();
  const years = extractYears(`${result.title} ${result.snippet}`);
  let score = 0;

  score += PREFERRED_SOURCE_SCORES[result.source] || 0;
  score += scorePageAge(result.pageAge);

  if (years.includes(CURRENT_YEAR)) {
    score += 45;
  }

  if (years.includes(CURRENT_YEAR - 1)) {
    score += 28;
  }

  if (years.length > 0 && years.every((year) => year <= CURRENT_YEAR - 3)) {
    score -= 45;
  }

  const keywords = ASPECT_KEYWORD_MAP[aspectId] || [];

  for (const keyword of keywords) {
    if (haystack.includes(String(keyword).toLowerCase())) {
      score += 8;
    }
  }

  if (aspectId === "business" && /(财报|年报|业绩|毛利|现金流|收入)/i.test(haystack)) {
    score += 20;
  }

  if (aspectId === "management" && /(采访|业绩会|创始人|管理层|战略)/i.test(haystack)) {
    score += 20;
  }

  if ((aspectId === "circle" || aspectId === "risk") && /(风险|监管|竞争|争议|依赖|估值|关税|汇率)/i.test(haystack)) {
    score += 16;
  }

  if (aspectId === "moat" && /(护城河|品牌|用户|复购|渠道|ip)/i.test(haystack)) {
    score += 18;
  }

  if (aspectId === "valuation" && /(估值|pe|市盈率|市销率|市值|预期|成长)/i.test(haystack)) {
    score += 18;
  }

  return score;
}

function scorePageAge(pageAge) {
  if (!pageAge) {
    return 0;
  }

  const timestamp = Date.parse(pageAge);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const ageDays = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));

  if (ageDays <= 45) {
    return 60;
  }

  if (ageDays <= 120) {
    return 45;
  }

  if (ageDays <= 240) {
    return 30;
  }

  if (ageDays <= 420) {
    return 15;
  }

  return 0;
}

function extractYears(text) {
  const matches = String(text || "").match(/\b20\d{2}\b/g) || [];
  return Array.from(new Set(matches.map((item) => Number(item)).filter((year) => year >= 2018 && year <= CURRENT_YEAR + 1)));
}

function formatEvidenceRecency(pageAge) {
  if (!pageAge) {
    return "";
  }

  const timestamp = Date.parse(pageAge);

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
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

function normalizeConversationHistory(history) {
  return Array.isArray(history)
    ? history
        .filter((item) => item && typeof item.role === "string" && typeof item.content === "string")
        .slice(-10)
    : [];
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
