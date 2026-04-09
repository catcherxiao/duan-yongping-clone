<div align="center">

# 段永平 Clone

> *「一般人总觉得做什么最重要，其实最重要的是不做什么。」*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--5.4-black)](https://developers.openai.com/api/docs/models/all)
[![RAG](https://img.shields.io/badge/RAG-Brave_Search-00A86B)](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started)
[![Demo](https://img.shields.io/badge/Demo-Streaming_Chat-blue)](./demo/README.md)
[![Skill](https://img.shields.io/badge/Skill-Duan_Yongping_Perspective-blueviolet)](./SKILL.md)

<br>

**把段永平公开表达里的判断框架，做成一个能安装、能多轮对话、能按近期信息补论据的 skill。**

<br>

不是复读金句。  
是把「本分 / 能力圈 / 买股票就是买公司 / 少犯错」真正做成一个可用的对话系统。

[效果示例](#效果示例) · [快速开始](#快速开始) · [现在能做什么](#现在能做什么) · [它蒸馏了什么](#它蒸馏了什么) · [项目结构](#项目结构) · [诚实边界](#诚实边界)

</div>

---

## 效果示例

```text
用户      ❯ 对泡泡玛特这家公司你怎么看？

段永平    ❯ 结论先说，我会把泡泡玛特看成一家已经证明了自己很会
            “做内容商品化”和“运营用户情绪价值”的公司。生意不差，
            甚至很强，但波动也会很大。

            这家公司真正值得看的，不是短期热度，而是三件事：
            IP 能不能接力，用户为什么持续买，海外扩张能不能稳住。

            看懂的人可以长期跟踪；看不懂 IP 生命周期和海外扩张的人，
            先别急。
```

```text
用户      ❯ 那它最大的风险是什么？

段永平    ❯ 结论先说，最大的风险不是短期股价波动，
            而是“热度生意”能不能持续，也就是 IP 会不会接不上、
            海外扩张会不会慢下来。

            为什么这么说？两个点就够了。
            第一，IP 热度消退是根上的风险。
            第二，海外扩张已经看到边际放缓，这不是一门
            可以简单线性外推的生意。

            所以别把高增长当理所当然。
            先看懂它到底靠什么长期赚钱，再决定要不要继续研究。
```

```text
用户      ❯ 孩子对投资有兴趣，要不要很早教？

段永平    ❯ 要教，但不要太早教“炒股”，要早一点教“生意”和“常识”。

            投资最后比的不是技巧，是判断力。
            先让他知道钱怎么来，好公司为什么好，
            价格和价值为什么不是一回事。

            先学会看生意，再谈股票。
            先学会不懂不做，再谈赚钱。
```

当前版本的规则是：

- 具体公司或股票问题：优先检索最近 `12-18` 个月的财报、业绩会、管理层表述和风险变化
- 多轮追问：像 `那护城河呢？`、`估值呢？`、`那它最大的风险是什么？` 会自动承接上一轮公司
- 宽泛问题：教育、创业、人生、方法论默认不触发检索，直接按段永平式表达回答

更多示例见 [examples/demo-conversation.md](./examples/demo-conversation.md) 和 [demo/multiturn-smoke-20260409.md](./demo/multiturn-smoke-20260409.md)。

---

## 快速开始

### 1. 跑本地 demo

```bash
cp demo/.env.example demo/.env
# 填入 OPENAI_API_KEY 和 BRAVE_API_KEY
node demo/server.mjs
```

默认地址：

```text
http://127.0.0.1:3033
```

完整说明见 [demo/README.md](./demo/README.md)。

### 2. 作为本地 skill 使用

如果你想先本地挂到 OpenClaw：

```bash
mkdir -p ~/.openclaw/skills
git clone https://github.com/catcherxiao/duan-yongping-clone.git ~/.openclaw/skills/duan-yongping-perspective
```

然后在对话里直接触发：

```text
用段永平的方式看
切到段永平视角
从大道角度想想
帮我看这家公司是不是好生意
```

当前仓库还没有正式发到 ClawHub，所以更适合先本地安装。

### 3. 推荐测试问题

```text
对泡泡玛特这家公司你怎么看？
那它最大的风险是什么？
那护城河呢？
估值呢？
孩子对投资有兴趣，要不要很早教？
```

---

## 现在能做什么

- 具体公司分析：按“怎么赚钱 / 用户为什么持续买 / 管理层 / 风险与能力圈”拆问题，再用近期公开信息补论据
- 多轮追问承接：如果上一轮已经聊到具体公司，下一轮会继续围绕同一家公司回答
- 本地流式 demo：支持 OpenAI `gpt-5.4`，并接入 Brave Search 做公司题检索增强
- 近期论据优先：默认优先最近 `12-18` 个月的信息，尽量不用过旧素材
- 本地语料支持：已经整理《大道》OCR、主题卡片、问答案例块，适合继续打磨人物风格
- 评测和冒烟：已提供投资风格检查、检索路由检查、多轮追问冒烟脚本

核心入口：

- [SKILL.md](./SKILL.md)
- [demo/server.mjs](./demo/server.mjs)
- [demo/public/app.js](./demo/public/app.js)
- [demo/data/case-blocks.json](./demo/data/case-blocks.json)
- [examples/demo-conversation.md](./examples/demo-conversation.md)

---

## 它蒸馏了什么

段永平不是学院派，更像长期主义的实战经营者和投资者。这个项目当前重点蒸馏的是他的**判断方式**，不是语录复读。

| 核心框架 | 一句话 |
| --- | --- |
| **本分** | 先问这件事对不对，再问赚不赚钱 |
| **不懂不做** | 看不懂的生意，再热也不要硬上 |
| **买股票就是买公司** | 真正该研究的是公司、用户、现金流和管理层 |
| **能力圈** | 知道自己不懂什么，比装懂更重要 |
| **少犯错** | 长期收益很多时候来自避开大错，而不是追逐神操作 |

当前仓库里已经整理出的资料层包括：

- 思想框架：[references/段永平思想体系深度调研-20260407.md](./references/段永平思想体系深度调研-20260407.md)
- 表达 DNA：[references/段永平表达风格DNA分析.md](./references/段永平表达风格DNA分析.md)
- 案例库：[references/段永平案例库.md](./references/段永平案例库.md)
- 真实采访入口：[references/段永平真实采访索引-20260407.md](./references/段永平真实采访索引-20260407.md)
- 《大道》主题笔记：[source-materials/notes/大道-高频主题卡片.md](./source-materials/notes/大道-高频主题卡片.md)
- 《大道》问答案例块：[source-materials/notes/大道-高价值问答案例块.md](./source-materials/notes/大道-高价值问答案例块.md)

一句话说，这个项目不是在“背段永平说过什么”，而是在训练一个系统：**碰到问题时，先回到生意和本质，再决定该不该做。**

---

## 项目结构

```text
duan-yongping-clone/
├── SKILL.md
├── README.md
├── LICENSE
├── agents/
│   └── openai.yaml
├── demo/
│   ├── README.md
│   ├── server.mjs
│   ├── public/
│   ├── data/
│   ├── evals/
│   └── run-*.mjs
├── examples/
│   └── demo-conversation.md
├── references/
│   ├── 段永平思想体系深度调研-20260407.md
│   ├── 段永平表达风格DNA分析.md
│   ├── 段永平案例库.md
│   └── 段永平真实采访索引-20260407.md
├── scripts/
│   ├── README.md
│   ├── fetch_xueqiu_timeline.py
│   └── ocr_pdf_rapidocr.py
└── source-materials/
    ├── README.md
    └── notes/
```

---

## 诚实边界

这个项目能做的：

- 用段永平式框架分析生意、公司、经营和长期决策
- 模拟更接近他公开表达的节奏和判断方式
- 在具体公司问题上，引入近期公开信息做论据补强

这个项目做不到的：

- 不能替代段永平本人，更不能代表他的实时私下判断
- 不做个性化投资建议，不给具体仓位，不做短线预测
- 不能保证所有公开信息都完整无误，尤其是媒体二手摘要
- 雪球全量问答目前不是内置静态库，仓库里提供的是本地抓取脚本和后续整理路径

**一个不告诉你边界在哪的 skill，不值得信。**

---

## 参考与致谢

- 方法论参考：[alchaincyf/nuwa-skill](https://github.com/alchaincyf/nuwa-skill)
- README 版式灵感参考：[zwbao/duan-yongping-skill](https://github.com/zwbao/duan-yongping-skill)
- OpenAI 文档：[API Docs](https://developers.openai.com/api/docs)
- Brave Search 文档：[Web Search API](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started)

---

<div align="center">

**语录** 只能告诉你他说过什么。  
**段永平 Clone** 试着帮你用他的方式看问题。

<br>

*做对的事情，把事情做对。*

</div>
