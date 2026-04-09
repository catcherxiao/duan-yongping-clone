# Demo Site

这是项目自带的本地演示站点，用来展示“段永平视角”在网页里的流式输出效果。

## 特点

- 零依赖，直接用 Node 运行
- 默认支持本地 `mock` 流式输出
- 也支持 OpenAI 官方 API，默认推荐 `gpt-5.4`
- 具体公司题会触发 Brave Search 检索增强，方法论和教育类问题不会
- 支持多轮追问承接，比如：
  - `对泡泡玛特这家公司你怎么看？`
  - `那它最大的风险是什么？`
  - `那护城河呢？`
- 检索选材会优先最近 `12-18` 个月的财报、业绩会、管理层表述和风险变化
- 回答默认不在正文展示来源名，而是把论据整合成更像聊天的表达

## 运行方式

```bash
node demo/server.mjs
```

默认地址：

```text
http://127.0.0.1:3033
```

## 配置真实模型

### OpenAI `gpt-5.4`

```bash
export OPENAI_API_KEY=your_key
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_MODEL=gpt-5.4
node demo/server.mjs
```

也可以参考 [`.env.example`](./.env.example)，在本地创建 `demo/.env`：

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.4
BRAVE_API_KEY=your_brave_search_key
BRAVE_SEARCH_COUNTRY=cn
BRAVE_SEARCH_LANG=zh-hans
```

如果没有这些配置，站点会自动退回本地 `mock` 模式。

如果你后面想换成别的 OpenAI 风格接口，比如 MiniMax，也只要覆盖 `OPENAI_BASE_URL` 和 `OPENAI_MODEL`。

### 只开检索增强

```bash
BRAVE_API_KEY=your_brave_search_key
BRAVE_SEARCH_COUNTRY=cn
BRAVE_SEARCH_LANG=zh-hans
node demo/server.mjs
```

## 推荐测试问题

```text
对泡泡玛特这家公司你怎么看？
那它最大的风险是什么？
那护城河呢？
估值呢？
孩子对投资有兴趣，要不要很早教？
```

## 文件结构

- [server.mjs](./server.mjs)
- [data/case-blocks.json](./data/case-blocks.json)
- [evals/investment-cases.json](./evals/investment-cases.json)
- [evals/retrieval-routing-cases.json](./evals/retrieval-routing-cases.json)
- [run-regression.mjs](./run-regression.mjs)
- [run-investment-style-check.mjs](./run-investment-style-check.mjs)
- [run-retrieval-routing-check.mjs](./run-retrieval-routing-check.mjs)
- [run-multiturn-smoke.mjs](./run-multiturn-smoke.mjs)
- [public/index.html](./public/index.html)
- [public/app.js](./public/app.js)
- [public/styles.css](./public/styles.css)
- [public/duan-yongping-avatar.jpg](./public/duan-yongping-avatar.jpg)

## 检查脚本

- 回归验证：`node demo/run-regression.mjs`
- 投资风格检查：`node demo/run-investment-style-check.mjs`
- 检索路由检查：`node demo/run-retrieval-routing-check.mjs`
- 多轮追问冒烟：`node demo/run-multiturn-smoke.mjs`

## 补充说明

- `mock` 模式不再只是硬编码分支，而是按 [`data/case-blocks.json`](./data/case-blocks.json) 做匹配式回答
- 网页里的 prompt chips 来自 `/api/prompts`
- 真实 API 模式下，如果有 Brave 检索结果，会把检索到的公开资料一起喂给模型做整合
- 某些本地网络环境下如果 Node 自带 `fetch` 直连 OpenAI 超时，服务端会自动回退到 `curl` 调官方接口，避免整条回答退回 mock
- 这套案例数据本身来自 [大道-高价值问答案例块.md](../source-materials/notes/大道-高价值问答案例块.md)，建议优先维护语料，再同步到 demo 数据

## 参考

- [OpenAI API Docs](https://developers.openai.com/api/docs)
- [OpenAI All models](https://developers.openai.com/api/docs/models/all)
- [Brave Search API](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started)
