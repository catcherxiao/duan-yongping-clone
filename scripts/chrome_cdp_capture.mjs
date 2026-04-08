#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function listTargets(port) {
  const url = `http://127.0.0.1:${port}/json/list`;
  const targets = await fetchJson(url);
  return Array.isArray(targets) ? targets : [];
}

function pickTarget(targets, match) {
  const pages = targets.filter((target) => target.type === "page");
  if (!match) {
    return pages[0] ?? null;
  }

  const lower = match.toLowerCase();
  return (
    pages.find((target) =>
      `${target.title ?? ""} ${target.url ?? ""}`.toLowerCase().includes(lower),
    ) ?? null
  );
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;

      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (event) => reject(event.error ?? new Error("WebSocket open failed")));
      ws.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          if (payload.id && this.pending.has(payload.id)) {
            const entry = this.pending.get(payload.id);
            this.pending.delete(payload.id);
            if (payload.error) {
              entry.reject(new Error(payload.error.message ?? JSON.stringify(payload.error)));
            } else {
              entry.resolve(payload.result ?? {});
            }
          }
        } catch (error) {
          // Ignore malformed events from the browser.
        }
      });
      ws.addEventListener("close", () => {
        for (const entry of this.pending.values()) {
          entry.reject(new Error("WebSocket closed"));
        }
        this.pending.clear();
      });
    });
  }

  async send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }

  async close() {
    if (!this.ws) return;
    this.ws.close();
  }
}

async function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function commandList(args) {
  const port = Number(args.port ?? 9222);
  const targets = await listTargets(port);
  const slim = targets
    .filter((target) => target.type === "page")
    .map((target) => ({
      id: target.id,
      title: target.title,
      url: target.url,
    }));
  console.log(JSON.stringify(slim, null, 2));
}

async function withTarget(args, fn) {
  const port = Number(args.port ?? 9222);
  const match = args.match ?? args.urlContains ?? "";
  const targets = await listTargets(port);
  const target = pickTarget(targets, match);

  if (!target) {
    throw new Error(`没有找到匹配 ${JSON.stringify(match)} 的浏览器标签页`);
  }

  if (!target.webSocketDebuggerUrl) {
    throw new Error("目标页没有 webSocketDebuggerUrl，无法连接 CDP");
  }

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();

  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable");
    return await fn(client, target);
  } finally {
    await client.close();
  }
}

async function commandScreenshot(args) {
  const output = args.output ?? "source-materials/notes/xueqiu-debug/xueqiu-page.png";
  await ensureDirFor(output);

  await withTarget(args, async (client, target) => {
    await client.send("Page.bringToFront");
    const result = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
    });
    await fs.writeFile(output, Buffer.from(result.data, "base64"));
    console.log(JSON.stringify({ output, title: target.title, url: target.url }, null, 2));
  });
}

async function commandSnapshot(args) {
  const output = args.output ?? "source-materials/notes/xueqiu-debug/xueqiu-snapshot.json";
  await ensureDirFor(output);

  await withTarget(args, async (client, target) => {
    const expression = `(() => {
      const text = document.body ? document.body.innerText.slice(0, 20000) : "";
      return {
        title: document.title,
        url: location.href,
        text,
        html: document.documentElement ? document.documentElement.outerHTML.slice(0, 50000) : ""
      };
    })()`;
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    const value = result.result?.value ?? {};
    await fs.writeFile(output, `${JSON.stringify(value, null, 2)}\n`);
    console.log(JSON.stringify({ output, title: target.title, url: target.url }, null, 2));
  });
}

async function commandCookies(args) {
  const output = args.output ?? "source-materials/notes/xueqiu-debug/xueqiu-cookies.json";
  await ensureDirFor(output);

  await withTarget(args, async (client, target) => {
    const result = await client.send("Network.getCookies", {
      urls: [target.url],
    });
    await fs.writeFile(output, `${JSON.stringify(result.cookies ?? [], null, 2)}\n`);
    console.log(JSON.stringify({ output, count: (result.cookies ?? []).length, url: target.url }, null, 2));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || args.help) {
    console.log(`Usage:
  node scripts/chrome_cdp_capture.mjs list [--port 9222]
  node scripts/chrome_cdp_capture.mjs screenshot --match xueqiu --output /tmp/xueqiu.png
  node scripts/chrome_cdp_capture.mjs snapshot --match xueqiu --output /tmp/xueqiu.json
  node scripts/chrome_cdp_capture.mjs cookies --match xueqiu --output /tmp/xueqiu-cookies.json
`);
    process.exit(0);
  }

  if (command === "list") {
    await commandList(args);
    return;
  }
  if (command === "screenshot") {
    await commandScreenshot(args);
    return;
  }
  if (command === "snapshot") {
    await commandSnapshot(args);
    return;
  }
  if (command === "cookies") {
    await commandCookies(args);
    return;
  }

  throw new Error(`未知命令: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
