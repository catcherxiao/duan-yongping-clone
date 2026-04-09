# OpenAI GPT-5.4 接入冒烟记录

日期：2026-04-09

## 目标

- 验证 OpenAI 官方 API key 是否可用
- 验证 `gpt-5.4` 模型名是否可用
- 验证本地 demo 是否已从 MiniMax 基座切到 OpenAI
- 验证普通问题与公司检索问题都能在真实模型模式下返回结果

## 结果

- OpenAI Responses API：通过
- OpenAI Chat Completions API：通过
- 本地 demo 状态：`mode=openai`
- 本地 demo 模型：`gpt-5.4`
- 本地 demo 基座：`https://api.openai.com/v1`
- Brave 检索：已启用

## 关键回执

### 1. Responses API

- 请求模型：`gpt-5.4`
- 测试指令：`Reply with exactly: OPENAI_54_OK`
- 返回结果：`OPENAI_54_OK`

### 2. Chat Completions API

- 请求模型：`gpt-5.4`
- 测试指令：`Reply with exactly: CHAT_OK`
- 返回结果：`CHAT_OK`

### 3. 本地状态接口

```json
{"mode":"openai","model":"gpt-5.4","baseUrl":"https://api.openai.com/v1","retrieval":"brave-web-search"}
```

### 4. 普通问题冒烟

- 提问：`孩子对投资有兴趣，要不要很早教？`
- 结果：返回真实模型回答，未出现旧的前置免责声明句式

### 5. 公司检索问题冒烟

- 提问：`对泡泡玛特这家公司你怎么看？`
- 结果：返回真实模型回答，并按“怎么赚钱 / 用户 / 管理层 / 能力圈”结构整合公开论据

## 备注

- 当前机器上，Node 自带 `fetch` 直连 OpenAI 偶尔会超时
- 服务端已增加自动回退：如果流式直连失败，会改用 `curl` 调 OpenAI 官方接口，再继续给前端做流式输出
- 因此当前 demo 已可稳定运行在 OpenAI `gpt-5.4` 基座上
