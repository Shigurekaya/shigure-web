#!/usr/bin/env python3
"""Local static server: HTML no-store + clean URL aliases (Vercel-like)."""
from __future__ import annotations

import argparse
import functools
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent

# 本地开发固定地址（文档：docs/local-dev.md）
LOCAL_HOST = "127.0.0.1"
LOCAL_PORT = 3456
LOCAL_BASE_URL = f"http://{LOCAL_HOST}:{LOCAL_PORT}/"

# Map clean paths → files on disk (mirrors Vercel cleanUrls + trailingSlash).
CLEAN_MAP = {
    "/": "index.html",
    "/works": "works.html",
    "/works/": "works.html",
    "/links": "links.html",
    "/links/": "links.html",
    "/mv-materials": "mv-materials.html",
    "/mv-materials/": "mv-materials.html",
    "/gal-quiz": "gal-quiz.html",
    "/gal-quiz/": "gal-quiz.html",
    "/gal-pick": "gal-pick.html",
    "/gal-pick/": "gal-pick.html",
    "/gal-sedai": "gal-sedai.html",
    "/gal-sedai/": "gal-sedai.html",
    "/heavy": "heavy.html",
    "/heavy/": "heavy.html",
    "/light": "light.html",
    "/light/": "light.html",
    "/storm": "storm.html",
    "/storm/": "storm.html",
    "/sunny": "sunny.html",
    "/sunny/": "sunny.html",
    "/rainbow": "rainbow.html",
    "/rainbow/": "rainbow.html",
    "/fuyuu": "fuyuu/index.html",
    "/fuyuu/": "fuyuu/index.html",
    "/fuyuu/work": "fuyuu/work.html",
    "/fuyuu/work/": "fuyuu/work.html",
    "/fuyuu/about": "fuyuu/about.html",
    "/fuyuu/about/": "fuyuu/about.html",
    "/fuyuu/portfolio": "fuyuu/portfolio.html",
    "/fuyuu/portfolio/": "fuyuu/portfolio.html",
    "/kaya": "kaya/index.html",
    "/kaya/": "kaya/index.html",
    "/kaya/works": "kaya/works.html",
    "/kaya/works/": "kaya/works.html",
    "/kaya/links": "kaya/links.html",
    "/kaya/links/": "kaya/links.html",
    "/kaya/heavy": "kaya/heavy.html",
    "/kaya/heavy/": "kaya/heavy.html",
    "/kaya/storm": "kaya/storm.html",
    "/kaya/storm/": "kaya/storm.html",
}

# /gal-quiz/s1-01 → gal-quiz.html（深链直达某题）
GAL_QUIZ_FOCUS_RE = re.compile(r"^/gal-quiz/([^/]+)/?$", re.IGNORECASE)


def resolve_clean_path(clean: str) -> str | None:
    mapped = CLEAN_MAP.get(clean)
    if mapped:
        return mapped
    m = GAL_QUIZ_FOCUS_RE.match(clean)
    if m:
        seg = m.group(1)
        if not re.search(r"\.html?$", seg, re.IGNORECASE):
            return "gal-quiz.html"
    return None


class NoCacheHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        split = urlsplit(path)
        clean = unquote(split.path)
        mapped = resolve_clean_path(clean)
        if mapped:
            return str(ROOT / mapped)
        return super().translate_path(path)

    def end_headers(self) -> None:
        path = (self.path or "").split("?", 1)[0]
        clean = unquote(urlsplit(path).path)
        if (
            path.endswith("/")
            or path.endswith(".html")
            or path in ("", "/")
            or path in CLEAN_MAP
            or resolve_clean_path(clean)
        ):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=LOCAL_PORT)
    parser.add_argument("--host", default=LOCAL_HOST, help=f"bind address (default: {LOCAL_HOST})")
    args = parser.parse_args()
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving {ROOT} on {LOCAL_BASE_URL if args.host == LOCAL_HOST and args.port == LOCAL_PORT else f'http://{args.host}:{args.port}/'} (HTML no-store + clean URLs)")
    server.serve_forever()


if __name__ == "__main__":
    main()
