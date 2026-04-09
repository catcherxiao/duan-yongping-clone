const chatLog = document.querySelector("#chat-log");
const composer = document.querySelector("#composer");
const textarea = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-btn");
const stopButton = document.querySelector("#stop-btn");
const resetButton = document.querySelector("#reset-btn");
const modePill = document.querySelector("#mode-pill");
const chipStrip = document.querySelector("#prompt-chips");

const conversation = [];
let activeController = null;

bootstrap();

async function bootstrap() {
  await Promise.all([loadStatus(), loadPrompts()]);

  chipStrip.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");

    if (chip) {
      textarea.value = chip.textContent.trim();
      textarea.focus();
    }
  });

  resetButton.addEventListener("click", () => {
    conversation.length = 0;
    activeController?.abort();
    activeController = null;
    stopButton.disabled = true;
    sendButton.disabled = false;
    renderWelcomeMessage();
  });

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      composer.requestSubmit();
    }
  });

  stopButton.addEventListener("click", () => {
    activeController?.abort();
  });

  composer.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = textarea.value.trim();
    if (!message || activeController) {
      return;
    }

    textarea.value = "";
    appendMessage("user", message);
    conversation.push({ role: "user", content: message });

    const assistantNode = appendMessage("assistant", "");
    const controller = new AbortController();
    activeController = controller;

    sendButton.disabled = true;
    stopButton.disabled = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history: conversation.slice(0, -1),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        assistantNode.textContent = errorText || "请求失败";
        conversation.push({ role: "assistant", content: assistantNode.textContent });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        assistantNode.textContent = fullText;
        scrollChatToBottom();
      }

      conversation.push({ role: "assistant", content: fullText.trim() });
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      const fallbackText = aborted ? "\n[已停止本次演示]" : "\n[请求失败，请稍后再试]";
      assistantNode.textContent += fallbackText;
      conversation.push({ role: "assistant", content: assistantNode.textContent.trim() });
    } finally {
      activeController = null;
      sendButton.disabled = false;
      stopButton.disabled = true;
      scrollChatToBottom();
    }
  });
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    const retrievalLabel = status.retrieval ? " · Brave 检索已开" : "";

    if (status.mode === "openai") {
      modePill.textContent = `真实流式模式 · ${status.model}${retrievalLabel}`;
    } else {
      modePill.textContent = `本地 mock 流式模式${retrievalLabel}`;
    }
  } catch {
    modePill.textContent = "状态获取失败";
  }
}

async function loadPrompts() {
  try {
    const response = await fetch("/api/prompts");
    const payload = await response.json();

    if (Array.isArray(payload.prompts) && payload.prompts.length) {
      chipStrip.innerHTML = payload.prompts
        .map((prompt) => `<button type="button" class="chip">${escapeHtml(prompt)}</button>`)
        .join("");
    }
  } catch {
    // Keep the inline fallback chips if prompt loading fails.
  }
}

function appendMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const row = document.createElement("div");
  row.className = "message-row";

  if (role === "assistant") {
    const avatar = document.createElement("img");
    avatar.className = "message-avatar";
    avatar.src = "/duan-yongping-avatar.jpg";
    avatar.alt = "段永平头像";
    row.append(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  row.append(bubble);
  article.append(row);
  chatLog.append(article);
  scrollChatToBottom();

  return bubble;
}

function scrollChatToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderWelcomeMessage() {
  chatLog.innerHTML = `
    <article class="message assistant">
      <div class="message-row">
        <img class="message-avatar" src="/duan-yongping-avatar.jpg" alt="段永平头像" />
        <div class="message-bubble">你可以直接把问题丢给我，也可以接着追问，比如“那最大的风险呢？”“那护城河呢？”。我会尽量顺着上一轮继续聊，不每次都从头讲。</div>
      </div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
