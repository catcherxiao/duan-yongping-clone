# 段永平 AI 分身 Skill

这是一个可直接做成 OpenClaw skill 的项目，目标不是“模仿名人语录”，而是把段永平公开表达出来的思维方式整理成一个能长期复用的视角 skill。

它的定位是：

- 用段永平式框架判断生意、投资和经营问题
- 强调本分、能力圈、长期主义、少犯错
- 不做荐股，不做短线，不装成真人本人

## 现在这版已经能做什么

根目录的 [SKILL.md](/Users/catcher_agent/Desktop/codex/段永平skill/SKILL.md) 已经是可发布结构，适合继续放进 GitHub 仓库，之后发布到 ClawHub。

你可以直接让 agent 这样用：

- `切到段永平视角，帮我看这家公司是不是好生意`
- `用段永平的方式看，这是不是件对的事情`
- `如果按买股票就是买公司的思路，这个标的值不值得长期看`

为了让效果更稳定，我已经继续补了四层参考资料：

- [references/段永平思想体系深度调研-20260407.md](/Users/catcher_agent/Desktop/codex/段永平skill/references/段永平思想体系深度调研-20260407.md)
- [references/段永平表达风格DNA分析.md](/Users/catcher_agent/Desktop/codex/段永平skill/references/段永平表达风格DNA分析.md)
- [references/段永平案例库.md](/Users/catcher_agent/Desktop/codex/段永平skill/references/段永平案例库.md)
- [examples/demo-conversation.md](/Users/catcher_agent/Desktop/codex/段永平skill/examples/demo-conversation.md)

这轮我又补了几块更偏“真实语料入口”的内容：

- [references/段永平真实采访索引-20260407.md](/Users/catcher_agent/Desktop/codex/段永平skill/references/段永平真实采访索引-20260407.md)
- [scripts/fetch_xueqiu_timeline.py](/Users/catcher_agent/Desktop/codex/段永平skill/scripts/fetch_xueqiu_timeline.py)

对应说明也放好了：

- [scripts/README.md](/Users/catcher_agent/Desktop/codex/段永平skill/scripts/README.md)
- [source-materials/notes/雪球抓取说明.md](/Users/catcher_agent/Desktop/codex/段永平skill/source-materials/notes/雪球抓取说明.md)

另外，这个项目现在已经支持把本地扫描版 PDF 做 OCR：

- 脚本：[scripts/ocr_pdf_rapidocr.py](/Users/catcher_agent/Desktop/codex/段永平skill/scripts/ocr_pdf_rapidocr.py)
- 当前《大道》OCR 结果目录：`source-materials/notes/pdf-ocr-rapidocr-daodao/`

我这次也把《大道》的 OCR 结果继续整理成了三份更适合 skill 读取的结构化笔记：

- [大道-目录与章节索引.md](/Users/catcher_agent/Desktop/codex/段永平skill/source-materials/notes/大道-目录与章节索引.md)
- [大道-高频主题卡片.md](/Users/catcher_agent/Desktop/codex/段永平skill/source-materials/notes/大道-高频主题卡片.md)
- [大道-问答表达模式.md](/Users/catcher_agent/Desktop/codex/段永平skill/source-materials/notes/大道-问答表达模式.md)
- [大道-高价值问答案例块.md](/Users/catcher_agent/Desktop/codex/段永平skill/source-materials/notes/大道-高价值问答案例块.md)

现在更推荐的读取顺序是：

- 先读 `大道-目录与章节索引.md` 找章节
- 再读 `大道-高频主题卡片.md` 抓原则
- 需要更像真实公开问答时，再读 `大道-问答表达模式.md`
- 需要直接拼出一段“段永平式”回答时，再读 `大道-高价值问答案例块.md`

这样能避免 agent 把整本 `combined.txt` 一次性塞进上下文，也能更稳定地保留“段永平式判断”而不是只剩几句金句。

这批 OCR 原文默认只建议本地保留，不建议直接公开提交；我新整理出来的卡片和索引属于二次结构化笔记，更适合作为项目内部工作资料。

## 本地演示站点

我也顺手给这个项目补了一个本地可跑的演示站点，目录在 [demo/README.md](/Users/catcher_agent/Desktop/codex/段永平skill/demo/README.md)。

它的特点是：

- 用网页直接演示“段永平式回答”的流式输出
- 默认走本地 `mock` 模式，不依赖 API key
- 如果配置了 OpenAI 兼容接口，会自动切到真实流式模式
- 内置几组和《大道》案例块对应的推荐问题
- `mock` 回答已经改成“案例块匹配式”生成，核心数据在 [demo/data/case-blocks.json](/Users/catcher_agent/Desktop/codex/段永平skill/demo/data/case-blocks.json)
- 投资专项测试也单独数据化了，见 [demo/evals/investment-cases.json](/Users/catcher_agent/Desktop/codex/段永平skill/demo/evals/investment-cases.json)
- 现在还支持公司分析类问题的一层 Brave 检索增强，但只在提到具体公司名或股票代码时触发，比如“对泡泡玛特这家公司你怎么看”或 “AAPL 还能不能长期拿”

最简单的启动方式：

```bash
node demo/server.mjs
```

默认地址：

```text
http://127.0.0.1:3033
```

如果你后面想接真实模型，可以按 [demo/README.md](/Users/catcher_agent/Desktop/codex/段永平skill/demo/README.md) 里的环境变量说明来配。

## 为什么这样包装

如果你想上 OpenClaw 官方公开注册表，最稳的做法不是把它包装成“荐股大师”，而是：

- 一个“商业与投资思维框架 skill”
- 强调公开资料蒸馏
- 明确边界，不给个性化投资建议
- 不做短线喊单和价格预测

这样更接近 `nuwa-skill` 产出的单人视角 skill，也更容易通过公开分发场景下的风险判断。

## OpenClaw 安装方式

截至 2026-04-07，OpenClaw 官方文档已经明确支持通过 ClawHub 安装 skill。

如果这个 skill 已经发布到 ClawHub，用户可以直接安装：

```bash
openclaw skills install duan-yongping-perspective
```

然后重开一个 OpenClaw 会话，让它重新加载 skills。

如果还没发布到 ClawHub，也可以先把这个项目作为一个本地 skill 使用：把整个目录放到工作区的 `skills/duan-yongping-perspective/` 下，或者全局的 `~/.openclaw/skills/duan-yongping-perspective/` 下。

如果你想要“大家一句命令就能装”，应该优先走 ClawHub。把 GitHub 仓库链接直接丢给 agent 让它自动安装，属于某些客户端或代理层的便捷能力，不应当替代 OpenClaw 官方分发路径。

## 发布到 ClawHub

官方文档给出的发布路径是 `clawhub skill publish <path>`。按现在这个项目结构，可以这样发：

```bash
pnpm add -g clawhub
clawhub login
clawhub skill publish . \
  --slug duan-yongping-perspective \
  --name "段永平 Perspective" \
  --version 0.1.0 \
  --tags latest,perspective,business,investing
```

发布完成后，别人就可以用这条官方命令安装：

```bash
openclaw skills install duan-yongping-perspective
```

## 还建议你补的两步

在你准备真的公开上架前，建议再补两件事：

1. 把仓库名定成 `duan-yongping-perspective` 或 `duan-yongping-skill`。
2. 再补一轮公开资料整理，尤其是段永平在雪球《方略》访谈、OPPO “本分”官方表述、以及“做对的事情 / 不为清单”相关材料。

我已经先放了一个维护用的资料笔记在 [references/source-notes.md](/Users/catcher_agent/Desktop/codex/段永平skill/references/source-notes.md)。

另外我也在项目下预留了本地语料目录 [source-materials/README.md](/Users/catcher_agent/Desktop/codex/段永平skill/source-materials/README.md)，你可以把讲话原文、访谈逐字稿、历史书籍摘录等都放进去。推荐把有版权风险的全文只保留在本地，不要直接公开提交。

另外，雪球这条线我已经实际验证过：匿名请求会被 WAF 挡住，所以项目里提供的是“带浏览器 Cookie 的本地抓取脚本”，而不是不稳定的匿名硬爬方案。

## 参考来源

- [Nuwa Skill 仓库](https://github.com/alchaincyf/nuwa-skill)
- [OpenClaw ClawHub 官方文档](https://docs.openclaw.ai/tools/clawhub)
- [OpenClaw skills CLI 文档](https://docs.openclaw.ai/cli/skills)
- [OPPO 关于我们：本分](https://www.oppo.com/tw/about/)
- [雪球《方略》第 13 期：方三文对话段永平](https://www.youtube.com/watch?v=1ikLMn2naSA)
