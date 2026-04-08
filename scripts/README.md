# Scripts

这个目录放辅助脚本。

当前主要脚本：

- [fetch_xueqiu_timeline.py](/Users/catcher_agent/Desktop/codex/段永平skill/scripts/fetch_xueqiu_timeline.py)
  - 用浏览器登录态导出的 Cookie 抓取雪球用户时间线
  - 适合先把段永平账号的原始内容归档到本地，再做问答筛选和二次整理
- [chrome_cdp_capture.mjs](/Users/catcher_agent/Desktop/codex/段永平skill/scripts/chrome_cdp_capture.mjs)
  - 连接本机 Chrome 的远程调试端口
  - 可列出标签页、抓截图、抓页面文本快照、导出当前页 cookies
  - 适合用户手动登录后，让 agent 接着做半自动检查和采集
- [ocr_pdf_rapidocr.py](/Users/catcher_agent/Desktop/codex/段永平skill/scripts/ocr_pdf_rapidocr.py)
  - 用 `RapidOCR + pypdfium2` 解析中文扫描版 PDF
  - 适合把《大道》这类图片型 PDF 先转成分页文本和合并文本
- [ocr_pdf_vision.swift](/Users/catcher_agent/Desktop/codex/段永平skill/scripts/ocr_pdf_vision.swift)
  - 基于 macOS `Vision + PDFKit` 的备选 OCR 方案
  - 当前环境里已实测失败，先保留作备用尝试

说明：

- 不要把浏览器 Cookie 或抓取产物直接提交到公开仓库
- 本地输出目录默认在 `source-materials/notes/xueqiu-archive/`
- 浏览器调试抓图和 cookies 默认写到 `source-materials/notes/xueqiu-debug/`
- PDF OCR 文本默认写到 `source-materials/notes/pdf-ocr-rapidocr/`
