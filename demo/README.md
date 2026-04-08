# Demo Site

这是一个本地可跑的简易演示站点，用来展示“段永平视角”在网页里的流式输出效果。

## 特点

- 零依赖，直接用 Node 运行
- 默认支持本地 `mock` 流式输出
- 如果配置了 OpenAI 兼容接口，也可以切到真实流式生成
- 页面是单卡沉浸式对话页，顶部只保留一条 tips
- 助手气泡使用本地头像图，位于 [duan-yongping-avatar.jpg](/Users/catcher_agent/Desktop/codex/段永平skill/demo/public/duan-yongping-avatar.jpg)
- 页面内置几组和《大道》案例块对应的演示问题
- `mock` 回答由 [data/case-blocks.json](/Users/catcher_agent/Desktop/codex/段永平skill/demo/data/case-blocks.json) 驱动，和网页推荐问题共用一套案例数据
- 投资专项测试由 [evals/investment-cases.json](/Users/catcher_agent/Desktop/codex/段永平skill/demo/evals/investment-cases.json) 驱动，后面扩测试可以直接加数据
- 只有提到具体公司名或股票代码的问题才会触发 Brave 检索增强；方法论、教育、人生这类宽泛问题不会走检索
- 公司分析检索会先拆“怎么赚钱 / 用户 / 管理层 / 关键变量”四段，再按总分总结构整合输出

## 运行方式

直接运行：

```bash
node demo/server.mjs
```

默认地址：

```text
http://127.0.0.1:3033
```

## 可选真实模型配置

如果你想直接接 MiniMax 2.7，可以在 shell 里设置：

```bash
export OPENAI_API_KEY=your_key
export OPENAI_BASE_URL=https://api.minimax.io/v1
export OPENAI_MODEL=MiniMax-M2.7
node demo/server.mjs
```

也可以参考 [demo/.env.example](/Users/catcher_agent/Desktop/codex/段永平skill/demo/.env.example)，在本地新建 `demo/.env`：

```bash
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.minimax.io/v1
OPENAI_MODEL=MiniMax-M2.7
BRAVE_API_KEY=your_brave_search_key
BRAVE_SEARCH_COUNTRY=cn
BRAVE_SEARCH_LANG=zh-hans
```

如果没有这些配置，站点会自动退回本地 `mock` 模式。

如果只想打开公司分析检索增强，不接真实大模型，也可以只配 Brave：

```bash
BRAVE_API_KEY=your_brave_search_key
BRAVE_SEARCH_COUNTRY=cn
BRAVE_SEARCH_LANG=zh-hans
node demo/server.mjs
```

MiniMax 官方 OpenAI 兼容文档：

- [Compatible OpenAI API](https://platform.minimax.io/docs/api-reference/text-openai-api)
- [API Overview](https://platform.minimax.io/docs/api-reference/api-overview)

## 文件结构

- [server.mjs](/Users/catcher_agent/Desktop/codex/段永平skill/demo/server.mjs)
- [data/case-blocks.json](/Users/catcher_agent/Desktop/codex/段永平skill/demo/data/case-blocks.json)
- [evals/investment-cases.json](/Users/catcher_agent/Desktop/codex/段永平skill/demo/evals/investment-cases.json)
- [evals/retrieval-routing-cases.json](/Users/catcher_agent/Desktop/codex/段永平skill/demo/evals/retrieval-routing-cases.json)
- [run-regression.mjs](/Users/catcher_agent/Desktop/codex/段永平skill/demo/run-regression.mjs)
- [run-investment-style-check.mjs](/Users/catcher_agent/Desktop/codex/段永平skill/demo/run-investment-style-check.mjs)
- [run-retrieval-routing-check.mjs](/Users/catcher_agent/Desktop/codex/段永平skill/demo/run-retrieval-routing-check.mjs)
- [package.json](/Users/catcher_agent/Desktop/codex/段永平skill/demo/package.json)
- [public/index.html](/Users/catcher_agent/Desktop/codex/段永平skill/demo/public/index.html)
- [public/styles.css](/Users/catcher_agent/Desktop/codex/段永平skill/demo/public/styles.css)
- [public/app.js](/Users/catcher_agent/Desktop/codex/段永平skill/demo/public/app.js)
- [public/duan-yongping-avatar.jpg](/Users/catcher_agent/Desktop/codex/段永平skill/demo/public/duan-yongping-avatar.jpg)

## 说明

- 这个 demo 站点是演示层，不替代正式 skill 发布形态
- `mock` 模式不再只是硬编码分支，而是按《大道》整理出的案例块做匹配式回答
- 网页里的 prompt chips 来自 `/api/prompts`，默认和案例块数据保持同步
- 如果配了 `BRAVE_API_KEY`，只有像“对泡泡玛特这家公司你怎么看”“AAPL 还能不能长期拿”这种明确指向具体公司或股票的问题才会触发检索增强
- 宽泛的观点、方法论、教育、人生问题默认不走检索，直接走本地风格回答
- 检索增强会把问题拆成四段：怎么赚钱、用户为什么持续买、管理层和文化、能力圈与关键变量
- 真实 API 模式会把用户问题发到 OpenAI 兼容接口，并带一段精简的段永平视角系统提示词
- 真实 API 模式下，如果有 Brave 检索结果，会把检索到的公开资料一起喂给模型做整合
- 如果用 MiniMax，服务端会自动打开 `reasoning_split`，避免把思维内容直接吐到用户界面里
- 回归验证可以直接运行：`node demo/run-regression.mjs`
- 投资风格专项检查可以直接运行：`node demo/run-investment-style-check.mjs`
- 检索路由检查可以直接运行：`node demo/run-retrieval-routing-check.mjs`
- 这套案例数据本身来自 [大道-高价值问答案例块.md](/Users/catcher_agent/Desktop/codex/段永平skill/source-materials/notes/大道-高价值问答案例块.md)，建议优先维护语料，再同步到 demo 数据
- 当前头像使用公开新闻配图做本地演示；如果你后面有更合适、可长期使用的老段图片，我再替换成本地正式素材
