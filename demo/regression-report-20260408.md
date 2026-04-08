# MiniMax 2.7 回归验证报告

日期：2026-04-08  
目标：验证本地 demo 站点在 MiniMax 2.7 真实模型下的流式回答效果

## 验证环境

- 站点入口：`http://127.0.0.1:3033`
- 服务端：`demo/server.mjs`
- 回归脚本：`demo/run-regression.mjs`
- 目标模型：`MiniMax-M2.7`
- 目标接口：`https://api.minimax.io/v1`

## 结果结论

- 真实模型链路没有跑通
- 阻塞原因不是提示词，也不是流式解析，而是上游认证失败
- MiniMax 接口返回：

```text
401 authorized_error: invalid api key (2049)
```

## 已完成的技术侧准备

- demo 已支持 OpenAI 兼容模式
- 已针对 MiniMax 打开 `reasoning_split`
- 已处理 MiniMax 流式内容可能为累计文本的情况，避免重复输出
- 已新增一键回归脚本，对 5 个核心场景做 PASS / FAIL 判定

## 本轮回归用例

- 投资下跌
- 杠杆风险
- 回款风险
- 合作失信
- 教育启蒙

## 回归结果

- `0/5` 通过
- 所有用例都退回到了本地 mock 演示
- 失败原因一致：真实上游认证失败

## 当前处理

- 已确认 demo 代码本身可用
- 已确认本地 mock 模式仍正常工作
- 为避免页面一直显示“退回 mock 演示”，验证完成后建议恢复到本地 mock 模式

## 下一步

- 换一枚有效的 MiniMax API key
- 保持 `OPENAI_BASE_URL=https://api.minimax.io/v1`
- 继续使用 `OPENAI_MODEL=MiniMax-M2.7`
- 重新执行：

```bash
node demo/server.mjs
node demo/run-regression.mjs
```
