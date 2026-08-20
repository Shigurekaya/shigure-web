#!/usr/bin/env python3
"""Local static server: HTML no-store + clean URL aliases (Vercel-like)."""
from __future__ import annotations

import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent

# Map clean paths → files on disk (mirrors Vercel cleanUrls + trailingSlash).
CLEAN_MAP = {
    "/": "index.html",
    "/works": "works.html",
    "/works/": "works.html",
    "/links": "links.html",
    "/links/": "links.html",
    "/storm": "storm.html",
    "/storm/": "storm.html",
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
    "/kaya/storm": "kaya/storm.html",
    "/kaya/storm/": "kaya/storm.html",
}


class NoCacheHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        split = urlsplit(path)
        clean = unquote(split.path)
        mapped = CLEAN_MAP.get(clean)
        if mapped:
            return str(ROOT / mapped)
        return super().translate_path(path)

    def end_headers(self) -> None:
        path = (self.path or "").split("?", 1)[0]
        if path.endswith("/") or path.endswith(".html") or path in ("", "/") or path in CLEAN_MAP:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=3000)
    args = parser.parse_args()
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("0.0.0.0", args.port), handler)
    print(f"Serving {ROOT} on http://127.0.0.1:{args.port}/ (HTML no-store + clean URLs)")
    server.serve_forever()


if __name__ == "__main__":
    main()
