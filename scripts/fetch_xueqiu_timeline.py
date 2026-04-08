#!/usr/bin/env python3
"""
Archive a Xueqiu user's timeline into local raw JSON and normalized NDJSON.

This script is intentionally dependency-free and uses only the Python standard
library so it can run in a plain local environment.

Typical usage:

    export XUEQIU_COOKIE='xq_a_token=...; xqat=...'
    python3 scripts/fetch_xueqiu_timeline.py \
      --user-id 1247347556 \
      --max-pages 200

Notes:
- Anonymous requests are often blocked by Xueqiu's WAF.
- Use a browser-exported Cookie header from a logged-in session.
- The script archives timeline data first; it also emits "qa candidates"
  based on simple text heuristics, but that file is only a candidate set.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import pathlib
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/135.0.0.0 Safari/537.36"
)

DEFAULT_OUTPUT = "source-materials/notes/xueqiu-archive"
DEFAULT_DEBUG = "source-materials/notes/xueqiu-debug"
TIMELINE_URL = "https://xueqiu.com/v4/statuses/user_timeline.json"


def build_url(user_id: str, page: int) -> str:
    query = urllib.parse.urlencode({"user_id": user_id, "page": page})
    return f"{TIMELINE_URL}?{query}"


def strip_html(raw: str) -> str:
    text = re.sub(r"(?is)<br\s*/?>", "\n", raw)
    text = re.sub(r"(?is)<[^>]+>", "", text)
    text = html.unescape(text)
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def looks_like_waf_or_html(body: bytes) -> bool:
    head = body[:8000].lower()
    return b"<html" in head or b"aliyun_waf" in head or b"renderdata" in head


def request_json(url: str, cookie: str, user_agent: str, timeout: int) -> tuple[dict[str, Any], bytes]:
    headers = {
        "User-Agent": user_agent,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://xueqiu.com/",
        "Origin": "https://xueqiu.com",
        "Connection": "keep-alive",
    }
    if cookie:
        headers["Cookie"] = cookie

    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
        content_type = response.headers.get("Content-Type", "")

    if looks_like_waf_or_html(body):
        raise RuntimeError(
            "雪球返回的是 WAF/HTML 页面，不是 JSON。请用浏览器已登录会话导出的完整 Cookie 头重试。"
        )

    if "json" not in content_type.lower() and not body.strip().startswith((b"{", b"[")):
        raise RuntimeError(
            f"返回内容不像 JSON，Content-Type={content_type!r}。"
        )

    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"返回内容无法解析为 JSON: {exc}") from exc

    return payload, body


def extract_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if not isinstance(payload, dict):
        return []

    candidates: list[Any] = []
    for key in ("statuses", "list", "items", "cards"):
        value = payload.get(key)
        if isinstance(value, list):
            candidates = value
            break
        if isinstance(value, dict):
            for subkey in ("list", "items"):
                subvalue = value.get(subkey)
                if isinstance(subvalue, list):
                    candidates = subvalue
                    break
        if candidates:
            break

    return [item for item in candidates if isinstance(item, dict)]


def choose_text(item: dict[str, Any]) -> str:
    for key in ("description", "text", "title", "content", "status"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return strip_html(value)
    return ""


def normalize_time(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        # Xueqiu usually uses milliseconds.
        timestamp = float(value)
        if timestamp > 1e12:
            timestamp /= 1000.0
        return dt.datetime.fromtimestamp(timestamp, tz=dt.timezone.utc).isoformat()

    if isinstance(value, str) and value.strip():
        return value.strip()

    return None


def normalize_item(item: dict[str, Any], user_id: str, page: int) -> dict[str, Any]:
    text = choose_text(item)
    created_at = normalize_time(
        item.get("created_at")
        or item.get("createdAt")
        or item.get("timeBefore")
        or item.get("updateTime")
    )

    item_id = (
        item.get("id")
        or item.get("status_id")
        or item.get("statusId")
        or item.get("target")
        or item.get("target_id")
    )

    return {
        "user_id": user_id,
        "page": page,
        "id": str(item_id) if item_id is not None else None,
        "created_at": created_at,
        "title": item.get("title"),
        "text": text,
        "text_preview": text[:240],
        "like_count": item.get("like_count") or item.get("likeCount"),
        "comment_count": item.get("comment_count") or item.get("commentCount"),
        "retweet_count": item.get("retweet_count") or item.get("retweetCount"),
        "raw_url": item.get("target"),
        "raw": item,
    }


def looks_like_qa(text: str) -> bool:
    if not text:
        return False
    patterns = [
        r"问[:：]",
        r"答[:：]",
        r"\bQ[:：]",
        r"\bA[:：]",
        r"提问",
        r"回答",
        r"问答",
    ]
    return any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns)


def ensure_dir(path: pathlib.Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_json(path: pathlib.Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def append_ndjson(path: pathlib.Path, items: list[dict[str, Any]]) -> None:
    with path.open("a", encoding="utf-8") as handle:
        for item in items:
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Archive a Xueqiu user's timeline with a logged-in Cookie."
    )
    parser.add_argument("--user-id", default="1247347556", help="Xueqiu user id")
    parser.add_argument("--max-pages", type=int, default=200, help="Maximum pages to fetch")
    parser.add_argument("--sleep", type=float, default=1.25, help="Sleep seconds between page requests")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds")
    parser.add_argument("--cookie", default=os.environ.get("XUEQIU_COOKIE", ""), help="Raw Cookie header")
    parser.add_argument("--cookie-file", help="Read Cookie header from a local file")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT, help="HTTP User-Agent")
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT, help="Directory for archived JSON/NDJSON")
    parser.add_argument("--debug-dir", default=DEFAULT_DEBUG, help="Directory for failed HTML/debug responses")
    return parser.parse_args()


def load_cookie(args: argparse.Namespace) -> str:
    if args.cookie_file:
        return pathlib.Path(args.cookie_file).read_text(encoding="utf-8").strip()
    return args.cookie.strip()


def main() -> int:
    args = parse_args()
    cookie = load_cookie(args)
    output_dir = pathlib.Path(args.output_dir)
    debug_dir = pathlib.Path(args.debug_dir)
    raw_dir = output_dir / "raw"

    ensure_dir(output_dir)
    ensure_dir(raw_dir)
    ensure_dir(debug_dir)

    if not cookie:
        print(
            "缺少 Cookie。请提供 --cookie / --cookie-file，或设置环境变量 XUEQIU_COOKIE。",
            file=sys.stderr,
        )
        return 2

    timeline_path = output_dir / "timeline.ndjson"
    qa_path = output_dir / "qa-candidates.ndjson"
    if timeline_path.exists():
        timeline_path.unlink()
    if qa_path.exists():
        qa_path.unlink()

    total_items = 0
    total_qa_candidates = 0
    fetched_pages = 0

    for page in range(1, args.max_pages + 1):
        url = build_url(args.user_id, page)
        print(f"[page {page}] {url}", file=sys.stderr)

        try:
            payload, raw_body = request_json(url, cookie, args.user_agent, args.timeout)
        except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError) as exc:
            debug_path = debug_dir / f"page-{page:04d}.txt"
            if isinstance(exc, urllib.error.HTTPError):
                body = exc.read()
                debug_path.write_bytes(body)
            print(f"[stop] 第 {page} 页失败: {exc}", file=sys.stderr)
            print(f"[debug] 已写入 {debug_path}", file=sys.stderr)
            break

        raw_path = raw_dir / f"page-{page:04d}.json"
        raw_path.write_bytes(raw_body)

        items = extract_items(payload)
        if not items:
            print(f"[stop] 第 {page} 页没有更多条目。", file=sys.stderr)
            break

        normalized = [normalize_item(item, args.user_id, page) for item in items]
        qa_candidates = [item for item in normalized if looks_like_qa(item["text"])]

        append_ndjson(timeline_path, normalized)
        if qa_candidates:
            append_ndjson(qa_path, qa_candidates)

        fetched_pages += 1
        total_items += len(normalized)
        total_qa_candidates += len(qa_candidates)

        max_page = payload.get("maxPage")
        if isinstance(max_page, int) and page >= max_page:
            print(f"[stop] 已达到接口给出的 maxPage={max_page}", file=sys.stderr)
            break

        time.sleep(args.sleep + random.uniform(0.0, 0.35))

    summary = {
        "user_id": args.user_id,
        "fetched_pages": fetched_pages,
        "total_items": total_items,
        "total_qa_candidates": total_qa_candidates,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "timeline_path": str(timeline_path),
        "qa_candidates_path": str(qa_path),
        "raw_dir": str(raw_dir),
        "notes": [
            "雪球匿名请求通常会被 WAF 拦截，因此需要浏览器登录态 Cookie。",
            "qa-candidates.ndjson 只是问答候选集，不等于完整问答全集。",
            "如果需要更接近“全部问答”，后续可在本地继续扩展评论/回复接口抓取。"
        ],
    }
    write_json(output_dir / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
