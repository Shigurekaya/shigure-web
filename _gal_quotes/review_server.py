#!/usr/bin/env python3
"""Gal 名言审阅本地服务：静态页 + approved.json 持久化。

Usage:
  uv run python _gal_quotes/review_server.py
  uv run python _gal_quotes/review_server.py --port 8765
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

DIR = Path(__file__).resolve().parent
DATA = DIR / "data"
OUT = DIR / "out"
QUOTES_JSON = DATA / "quotes.json"
APPROVED_JSON = DATA / "approved.json"
REVIEW_HTML = OUT / "review.html"
APPROVED_HTML = OUT / "approved.html"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path, default):
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def regen_approved_html() -> None:
    from fetch_quotes import render_approved_html

    quotes = load_json(QUOTES_JSON, [])
    approved = load_json(APPROVED_JSON, {})
    OUT.mkdir(parents=True, exist_ok=True)
    APPROVED_HTML.write_text(render_approved_html(quotes, approved), encoding="utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "GalQuotesReview/0.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {self.address_string()} {fmt % args}", flush=True)

    def _json(self, code: int, obj) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/ping":
            self._json(200, {"ok": True})
            return
        if path == "/api/quotes":
            self._json(200, load_json(QUOTES_JSON, []))
            return
        if path == "/api/approved":
            self._json(200, load_json(APPROVED_JSON, {}))
            return
        self._serve_static(path)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/approve":
            try:
                body = self._read_json()
            except json.JSONDecodeError:
                self._json(400, {"error": "invalid json"})
                return
            qid = (body.get("id") or "").strip()
            if not qid:
                self._json(400, {"error": "missing id"})
                return
            approved = load_json(APPROVED_JSON, {})
            approved[qid] = {
                "approved": bool(body.get("approved")),
                "quote_zh": (body.get("quote_zh") or "").strip(),
                "updated_at": _now(),
            }
            if not approved[qid]["approved"] and not approved[qid]["quote_zh"]:
                approved.pop(qid, None)
            save_json(APPROVED_JSON, approved)
            regen_approved_html()
            self._json(200, {"ok": True, "id": qid})
            return
        if path == "/api/regenerate":
            regen_approved_html()
            self._json(200, {"ok": True})
            return
        self.send_error(404)

    def _serve_static(self, path: str) -> None:
        if path in {"", "/"}:
            path = "/review.html"
        rel = unquote(path.lstrip("/"))
        file_path = (OUT / rel).resolve()
        if not str(file_path).startswith(str(OUT.resolve())):
            self.send_error(403)
            return
        if not file_path.is_file():
            self.send_error(404)
            return
        ctype, _ = mimetypes.guess_type(str(file_path))
        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()

    if not QUOTES_JSON.is_file():
        print("quotes.json 不存在，请先运行 fetch_quotes.py", file=sys.stderr)
        return 1
    if not REVIEW_HTML.is_file():
        print("review.html 不存在，请先运行 fetch_quotes.py", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    regen_approved_html()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    url = f"http://{args.host}:{args.port}/review.html"
    print(f"[ok] {url}")
    print("[hint] Ctrl+C 停止")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[bye]")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(DIR))
    raise SystemExit(main())
