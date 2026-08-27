#!/usr/bin/env python3
"""从 VNDB 批量抓取 Gal 名言，生成 JSON + HTML 审阅页。

Usage:
  . ..\\gal-\\ops\\proxy.ps1; Enable-RepoProxy
  uv run python _gal_quotes/fetch_quotes.py
  uv run python _gal_quotes/fetch_quotes.py --limit 1500 --min-score 1
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
DIR = Path(__file__).resolve().parent
DATA = DIR / "data"
OUT = DIR / "out"
ALIASES = ROOT / "_sedai_raw" / "pick_title_aliases.json"
QUOTES_JSON = DATA / "quotes.json"
APPROVED_JSON = DATA / "approved.json"
REVIEW_HTML = OUT / "review.html"
APPROVED_HTML = OUT / "approved.html"

VNDB_QUOTE = "https://api.vndb.org/kana/quote"
# 浏览器伪装（机翻 / 部分 CDN 会拦脚本 UA）
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)
BROWSER_HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
}
TRANSLATE_HEADERS = {
    **BROWSER_HEADERS,
    "Referer": "https://translate.google.com/",
    "Origin": "https://translate.google.com",
}
PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or "http://127.0.0.1:7890"
CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")
HIRAGANA_KATAKANA = re.compile(r"[\u3040-\u30ff]")
PAGE_SIZE = 100

# 常见作品 EN/罗马字 → 中文名（aliases 里没有的补洞）
TITLE_CN_EXTRA: dict[str, str] = {
    "fate/stay night": "Fate/stay night",
    "fate/hollow ataraxia": "Fate/hollow ataraxia",
    "clannad": "CLANNAD",
    "kanon": "Kanon",
    "air": "AIR",
    "ever17 -the out of infinity-": "永远的艾塞莉娅",
    "ever17": "永远的艾塞莉娅",
    "subarashiki hibi ~furenzoku sonzai~": "美好的日常 ～不连续的存在～",
    "soukou akki muramasa": "装甲恶鬼村正",
    "saya no uta": "沙耶之歌",
    "tsukihime": "月姬",
    "umineko no naku koro ni": "海猫鸣泣之时",
    "higurashi no naku koro ni": "寒蝉鸣泣之时",
    "steins;gate": "命运石之门",
    "rewrite": "Rewrite",
    "little busters!": "Little Busters!",
    "planetarian ~chiisana hoshi no yume~": "星球坠落之日",
    "muv-luv alternative": "Muv-Luv Alternative",
    "muv-luv": "Muv-Luv",
}

# 社区公认中文译法（优先于机翻）
KNOWN_QUOTE_ZH: dict[str, str] = {
    "people die when they are killed.": "人被杀就会死。",
    "people die if they are killed.": "人被杀就会死。",
    "just monika.": "Just Monika.",
    "i love you.": "我爱你。",
}


def _log(msg: str) -> None:
    print(msg, flush=True)


def client(*, for_translate: bool = False) -> httpx.Client:
    headers = dict(TRANSLATE_HEADERS if for_translate else BROWSER_HEADERS)
    kw: dict = {
        "timeout": httpx.Timeout(60.0, connect=25.0),
        "follow_redirects": True,
        "headers": headers,
    }
    if PROXY and PROXY.lower() not in {"", "none", "off", "0"}:
        kw["proxy"] = PROXY
    return httpx.Client(**kw)


def looks_japanese(s: str) -> bool:
    return bool(HIRAGANA_KATAKANA.search(s or ""))


def load_alias_map() -> dict[str, str]:
    """JP/EN 标题 → 中文（或站内 canonical）名。"""
    out: dict[str, str] = dict(TITLE_CN_EXTRA)
    if not ALIASES.is_file():
        return out
    raw = json.loads(ALIASES.read_text(encoding="utf-8"))
    for cn, variants in raw.items():
        # 优先带汉字的中文 key；拉丁标题也保留作 canonical
        for v in [cn, *(variants or [])]:
            key = (v or "").strip().lower()
            if not key:
                continue
            prev = out.get(key)
            if prev and CJK_RE.search(prev) and not CJK_RE.search(cn):
                continue
            out[key] = cn
    return out


def pick_zh_title(vn_title: str, alttitle: str | None, alias_map: dict[str, str]) -> str:
    for key in (vn_title, alttitle or ""):
        hit = alias_map.get(key.strip().lower())
        if hit:
            return hit
    # 日文 alt 不当作「汉化名」，仅作兜底展示
    if alttitle and CJK_RE.search(alttitle):
        return alttitle.strip()
    return ""


def quote_zh_from_text(text: str) -> str:
    if not text or not CJK_RE.search(text):
        return ""
    if looks_japanese(text):
        return ""
    cjk = len(CJK_RE.findall(text))
    if cjk >= max(4, len(text.replace(" ", "")) * 0.25):
        return text.strip()
    return ""


def known_quote_zh(text: str) -> str:
    return KNOWN_QUOTE_ZH.get((text or "").strip().lower(), "")


def translate_to_zh(http: httpx.Client, text: str) -> str:
    """优先 Google gtx；429/失败则回退 MyMemory。"""
    text = (text or "").strip()
    if not text:
        return ""
    zh = _translate_google(http, text)
    if zh:
        return zh
    return _translate_mymemory(http, text)


def _translate_google(http: httpx.Client, text: str) -> str:
    for attempt in range(3):
        try:
            r = http.get(
                "https://translate.googleapis.com/translate_a/single",
                params={"client": "gtx", "sl": "auto", "tl": "zh-CN", "dt": "t", "q": text},
            )
            if r.status_code == 429:
                time.sleep(1.2 * (attempt + 1))
                continue
            if r.status_code != 200:
                return ""
            data = r.json()
            parts = []
            for chunk in data[0] or []:
                if chunk and chunk[0]:
                    parts.append(chunk[0])
            return "".join(parts).strip()
        except Exception:  # noqa: BLE001
            time.sleep(0.5 * (attempt + 1))
    return ""


def _translate_mymemory(http: httpx.Client, text: str) -> str:
    try:
        r = http.get(
            "https://api.mymemory.translated.net/get",
            params={"q": text[:450], "langpair": "en|zh-CN"},
            headers={**BROWSER_HEADERS, "Referer": "https://mymemory.translated.net/"},
        )
        if r.status_code != 200:
            return ""
        data = r.json()
        zh = ((data.get("responseData") or {}).get("translatedText") or "").strip()
        # MyMemory 超额时常原样返回英文
        if not zh or zh.lower() == text.lower()[: len(zh)]:
            return ""
        return zh
    except Exception:  # noqa: BLE001
        return ""


def _translate_one(idx: int, text: str) -> tuple[int, str]:
    """线程内自建 client，避免共享连接。"""
    with client(for_translate=True) as http:
        time.sleep(0.05 + (idx % 11) * 0.02)
        return idx, translate_to_zh(http, text)


def enrich_zh(quotes: list[dict], *, do_translate: bool, workers: int = 8) -> list[dict]:
    alias_map = load_alias_map()
    pending: list[int] = []

    for i, q in enumerate(quotes):
        if not q.get("vn_title_zh"):
            q["vn_title_zh"] = pick_zh_title(q.get("vn_title") or "", None, alias_map)
        if q.get("quote_zh"):
            continue
        known = known_quote_zh(q.get("quote") or "")
        if known:
            q["quote_zh"] = known
            q["quote_zh_source"] = "known"
            continue
        native = quote_zh_from_text(q.get("quote") or "")
        if native:
            q["quote_zh"] = native
            q["quote_zh_source"] = "native"
            continue
        if do_translate:
            pending.append(i)

    if not pending:
        return quotes

    workers = max(1, min(workers, 24))
    _log(f"[translate] parallel {len(pending)} quotes, workers={workers}")
    done = 0
    lock = threading.Lock()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {
            pool.submit(_translate_one, i, quotes[i].get("quote") or ""): i
            for i in pending
        }
        for fut in as_completed(futs):
            idx, zh = fut.result()
            if zh:
                quotes[idx]["quote_zh"] = zh
                quotes[idx]["quote_zh_source"] = "mt"
            with lock:
                done += 1
                if done % 50 == 0 or done == len(pending):
                    _log(f"[translate] {done}/{len(pending)}")
    return quotes


def normalize_row(row: dict, alias_map: dict[str, str]) -> dict:
    qid = row.get("id") or ""
    vn = row.get("vn") or {}
    ch = row.get("character") or {}
    quote = (row.get("quote") or "").strip()
    vn_title = (vn.get("title") or "").strip()
    vn_id = vn.get("id") or ""
    quote_zh = known_quote_zh(quote) or quote_zh_from_text(quote)
    return {
        "id": qid,
        "quote": quote,
        "quote_zh": quote_zh,
        "quote_zh_source": ("known" if known_quote_zh(quote) else ("native" if quote_zh else "")),
        "character": (ch.get("name") or "").strip(),
        "vn_id": vn_id,
        "vn_title": vn_title,
        "vn_title_zh": pick_zh_title(vn_title, vn.get("alttitle"), alias_map),
        "score": int(row.get("score") or 0),
        "source": "VNDB",
        "source_url": f"https://vndb.org/{qid}" if qid else "",
        "vn_url": f"https://vndb.org/{vn_id}" if vn_id else "",
    }


def fetch_quotes(limit: int, min_score: int) -> list[dict]:
    alias_map = load_alias_map()
    rows: list[dict] = []
    page = 1
    # VNDB quote API 不支持 score 字段过滤，按 score 排序后客户端截断
    fetch_target = limit * 3 if min_score > 0 else limit

    with client() as http:
        while len(rows) < fetch_target:
            payload = {
                "fields": "id,quote,score,character{id,name},vn{id,title,alttitle}",
                "sort": "score",
                "reverse": True,
                "results": min(PAGE_SIZE, fetch_target - len(rows)),
                "page": page,
            }
            _log(f"[fetch] page={page} have={len(rows)}")
            r = http.post(VNDB_QUOTE, json=payload)
            if r.status_code != 200:
                raise RuntimeError(f"VNDB quote API {r.status_code}: {r.text[:400]}")
            body = r.json()
            batch = body.get("results") or []
            if not batch:
                break
            for item in batch:
                rows.append(normalize_row(item, alias_map))
            if not body.get("more"):
                break
            page += 1
            time.sleep(0.35)

    seen: set[str] = set()
    deduped: list[dict] = []
    for row in rows:
        if row["id"] in seen:
            continue
        if min_score > 0 and row["score"] < min_score:
            continue
        seen.add(row["id"])
        deduped.append(row)
        if len(deduped) >= limit:
            break
    return deduped


def load_approved() -> dict:
    if APPROVED_JSON.is_file():
        try:
            return json.loads(APPROVED_JSON.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {}


def render_approved_html(quotes: list[dict], approved: dict) -> str:
    kept = []
    for q in quotes:
        rec = approved.get(q["id"])
        if rec and rec.get("approved"):
            item = dict(q)
            if rec.get("quote_zh"):
                item["quote_zh"] = rec["quote_zh"]
            kept.append(item)
    parts = [
        "<!DOCTYPE html>",
        '<html lang="zh-CN"><head><meta charset="UTF-8">',
        "<title>Gal 名言 · 已保留</title>",
        "<style>",
        "body{font-family:system-ui,sans-serif;max-width:52rem;margin:2rem auto;padding:0 1rem;line-height:1.65;color:#1a1a1a}",
        "article{border-left:3px solid #5b8def;padding:0 0 1.2rem 1rem;margin-bottom:1.6rem}",
        ".zh{font-size:1.05rem;margin:0 0 .4rem}",
        ".orig{color:#666;font-size:.9rem;margin:0 0 .5rem}",
        ".meta{color:#888;font-size:.85rem}",
        ".meta a{color:#5b8def}",
        "</style></head><body>",
        f"<h1>已保留名言（{len(kept)}）</h1>",
    ]
    for q in kept:
        zh = q.get("quote_zh") or q.get("quote") or ""
        orig = q.get("quote") or ""
        vn = q.get("vn_title_zh") or q.get("vn_title") or "未知作品"
        ch = q.get("character") or ""
        src = q.get("source_url") or "#"
        parts.append("<article>")
        parts.append(f'<p class="zh">{_esc(zh)}</p>')
        if orig and orig != zh:
            parts.append(f'<p class="orig">{_esc(orig)}</p>')
        meta = f'<span class="meta">《{_esc(vn)}》'
        if ch:
            meta += f" · {_esc(ch)}"
        meta += f' · <a href="{_esc(src)}" target="_blank" rel="noopener">VNDB</a></span>'
        parts.append(f"<p>{meta}</p>")
        parts.append("</article>")
    parts.append("</body></html>")
    return "\n".join(parts)


def _esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render_review_html(quotes: list[dict], approved: dict) -> str:
    payload = json.dumps({"quotes": quotes, "approved": approved}, ensure_ascii=False)
    payload = payload.replace("</", "<\\/")
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Gal 名言审阅</title>
  <style>
    :root {{
      --bg: #f4f6fa;
      --panel: #fff;
      --line: #e2e8f0;
      --text: #1e293b;
      --muted: #64748b;
      --accent: #3b82f6;
      --accent-soft: #dbeafe;
      --ok: #16a34a;
      --ok-soft: #dcfce7;
      --shadow: 0 8px 30px rgba(15, 23, 42, .08);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      overflow: hidden;
    }}
    .app {{
      display: grid;
      grid-template-columns: 1fr 340px;
      height: 100vh;
    }}
    .main {{
      display: flex;
      flex-direction: column;
      min-width: 0;
      border-right: 1px solid var(--line);
    }}
    .toolbar {{
      display: flex;
      flex-wrap: wrap;
      gap: .6rem;
      align-items: center;
      padding: .85rem 1rem;
      background: var(--panel);
      border-bottom: 1px solid var(--line);
    }}
    .toolbar input, .toolbar select {{
      padding: .45rem .65rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      font: inherit;
      background: #fff;
    }}
    .toolbar input[type=search] {{ flex: 1; min-width: 12rem; }}
    .stats {{ margin-left: auto; color: var(--muted); font-size: .85rem; }}
    .list {{
      overflow: auto;
      padding: .75rem;
      flex: 1;
    }}
    .item {{
      display: block;
      width: 100%;
      text-align: left;
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 12px;
      padding: .85rem 1rem;
      margin-bottom: .55rem;
      cursor: pointer;
      transition: border-color .15s, box-shadow .15s;
    }}
    .item:hover {{ border-color: #cbd5e1; }}
    .item.is-active {{ border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }}
    .item.is-approved {{ border-left: 4px solid var(--ok); background: linear-gradient(90deg, var(--ok-soft), var(--panel) 40%); }}
    .item__zh {{ font-size: .95rem; line-height: 1.5; margin: 0 0 .35rem; }}
    .item__orig {{ color: var(--muted); font-size: .82rem; margin: 0 0 .4rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }}
    .item__meta {{ font-size: .78rem; color: var(--muted); display: flex; gap: .5rem; flex-wrap: wrap; }}
    .badge {{ background: #f1f5f9; padding: .1rem .45rem; border-radius: 999px; }}
    .side {{
      background: var(--panel);
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow);
    }}
    .side__head {{
      padding: 1rem 1.1rem .6rem;
      border-bottom: 1px solid var(--line);
      font-weight: 600;
    }}
    .side__body {{
      padding: 1rem 1.1rem;
      overflow: auto;
      flex: 1;
    }}
    .side__empty {{ color: var(--muted); font-size: .9rem; line-height: 1.6; }}
    label {{ display: block; font-size: .8rem; color: var(--muted); margin: .75rem 0 .35rem; }}
    textarea {{
      width: 100%;
      min-height: 5.5rem;
      resize: vertical;
      font: inherit;
      line-height: 1.55;
      padding: .65rem .75rem;
      border: 1px solid var(--line);
      border-radius: 10px;
    }}
    .orig-box {{
      background: #f8fafc;
      border-radius: 10px;
      padding: .75rem;
      font-size: .88rem;
      line-height: 1.55;
      color: #334155;
      white-space: pre-wrap;
    }}
    .meta-links {{ font-size: .82rem; margin-top: .75rem; }}
    .meta-links a {{ color: var(--accent); }}
    .approve {{
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid var(--line);
    }}
    .approve label.approve-row {{
      display: flex;
      align-items: center;
      gap: .65rem;
      font-size: 1rem;
      color: var(--text);
      cursor: pointer;
      user-select: none;
      margin: 0;
    }}
    .approve input[type=checkbox] {{
      width: 1.35rem;
      height: 1.35rem;
      accent-color: var(--ok);
      cursor: pointer;
    }}
    .side__foot {{
      padding: .75rem 1.1rem 1rem;
      border-top: 1px solid var(--line);
      display: flex;
      gap: .5rem;
      flex-wrap: wrap;
    }}
    .btn {{
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 8px;
      padding: .45rem .75rem;
      font: inherit;
      cursor: pointer;
    }}
    .btn:hover {{ background: #f8fafc; }}
    .btn--primary {{ background: var(--accent); color: #fff; border-color: var(--accent); }}
    .btn--primary:hover {{ filter: brightness(1.05); }}
    .toast {{
      position: fixed;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #fff;
      padding: .5rem 1rem;
      border-radius: 999px;
      font-size: .85rem;
      opacity: 0;
      pointer-events: none;
      transition: opacity .2s;
    }}
    .toast.is-on {{ opacity: 1; }}
    @media (max-width: 860px) {{
      .app {{ grid-template-columns: 1fr; grid-template-rows: 1fr auto; }}
      .side {{ max-height: 45vh; }}
    }}
  </style>
</head>
<body>
  <div class="app">
    <section class="main">
      <div class="toolbar">
        <input type="search" id="q" placeholder="搜索台词 / 作品 / 角色…" autocomplete="off">
        <select id="filter">
          <option value="all">全部</option>
          <option value="pending">未审</option>
          <option value="approved">已保留</option>
          <option value="no-zh">缺中文</option>
        </select>
        <span class="stats" id="stats"></span>
      </div>
      <div class="list" id="list"></div>
    </section>
    <aside class="side">
      <div class="side__head">审阅</div>
      <div class="side__body" id="panel">
        <p class="side__empty">点击左侧一条名言，在右侧勾选 ✓ 保留。<br>可编辑中文译文；勾选会通过本地服务写回 <code>approved.json</code>。<br>来源默认标注 VNDB；机翻句需人工校对。</p>
      </div>
      <div class="side__foot">
        <button type="button" class="btn" id="export-json">导出 approved.json</button>
        <button type="button" class="btn btn--primary" id="open-approved">打开 approved.html</button>
      </div>
    </aside>
  </div>
  <div class="toast" id="toast"></div>
  <script id="bootstrap" type="application/json">{payload}</script>
  <script>
(() => {{
  const LS_KEY = "gal-quotes-approved-v1";
  const boot = JSON.parse(document.getElementById("bootstrap").textContent);
  let quotes = boot.quotes || [];
  let approved = {{ ...(boot.approved || {{}}) }};
  let activeId = null;
  let apiOk = false;

  const $ = (s) => document.querySelector(s);
  const listEl = $("#list");
  const panelEl = $("#panel");
  const statsEl = $("#stats");
  const toastEl = $("#toast");

  function toast(msg) {{
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove("is-on"), 1800);
  }}

  function displayZh(q) {{
    const rec = approved[q.id];
    if (rec && rec.quote_zh) return rec.quote_zh;
    return q.quote_zh || q.quote || "";
  }}

  function isApproved(id) {{
    return !!(approved[id] && approved[id].approved);
  }}

  function filtered() {{
    const q = ($("#q").value || "").trim().toLowerCase();
    const f = $("#filter").value;
    return quotes.filter((row) => {{
      if (f === "approved" && !isApproved(row.id)) return false;
      if (f === "pending" && isApproved(row.id)) return false;
      if (f === "no-zh") {{
        const zh = (approved[row.id] && approved[row.id].quote_zh) || row.quote_zh;
        if (zh) return false;
      }}
      if (!q) return true;
      const hay = [
        row.quote, row.quote_zh, row.vn_title, row.vn_title_zh,
        row.character, row.id,
      ].join(" ").toLowerCase();
      return hay.includes(q);
    }});
  }}

  function renderList() {{
    const rows = filtered();
    const kept = quotes.filter((q) => isApproved(q.id)).length;
    statsEl.textContent = `显示 ${{rows.length}} / ${{quotes.length}} · 已保留 ${{kept}}`;
    listEl.innerHTML = rows.map((row) => {{
      const zh = displayZh(row);
      const cls = ["item"];
      if (row.id === activeId) cls.push("is-active");
      if (isApproved(row.id)) cls.push("is-approved");
      return `<button type="button" class="${{cls.join(" ")}}" data-id="${{row.id}}">
        <p class="item__zh">${{esc(zh)}}</p>
        <p class="item__orig">${{esc(row.quote)}}</p>
        <div class="item__meta">
          <span>${{esc(row.vn_title_zh || row.vn_title)}}</span>
          ${{row.character ? `<span>${{esc(row.character)}}</span>` : ""}}
          <span class="badge">score ${{row.score}}</span>
        </div>
      </button>`;
    }}).join("");
  }}

  function renderPanel(id) {{
    const row = quotes.find((q) => q.id === id);
    if (!row) {{
      panelEl.innerHTML = '<p class="side__empty">未选中</p>';
      return;
    }}
    const rec = approved[id] || {{}};
    const zhVal = rec.quote_zh ?? row.quote_zh ?? "";
    const zhSrc = row.quote_zh_source === "mt" ? "机翻（待校对）"
      : row.quote_zh_source === "known" ? "公认译法"
      : row.quote_zh_source === "native" ? "原文已是中文"
      : "未汉化";
    panelEl.innerHTML = `
      <label>中文（汉化） · ${{zhSrc}}</label>
      <textarea id="zh-edit">${{esc(zhVal)}}</textarea>
      <label>原文</label>
      <div class="orig-box">${{esc(row.quote)}}</div>
      <label>来源</label>
      <div class="meta-links">
        《${{esc(row.vn_title_zh || row.vn_title)}}》
        ${{row.vn_title_zh ? `<br><span style="color:var(--muted)">${{esc(row.vn_title)}}</span>` : ""}}
        ${{row.character ? `<br>角色：${{esc(row.character)}}` : ""}}
        <br>数据来源：${{esc(row.source)}}（社区投稿台词库）
        <br><a href="${{esc(row.source_url)}}" target="_blank" rel="noopener">${{esc(row.source_url)}}</a>
        ${{row.vn_url ? `<br><a href="${{esc(row.vn_url)}}" target="_blank" rel="noopener">作品页</a>` : ""}}
      </div>
      <div class="approve">
        <label class="approve-row">
          <input type="checkbox" id="approve-cb" ${{rec.approved ? "checked" : ""}}>
          <span>✓ 保留这条名言</span>
        </label>
      </div>`;
    $("#zh-edit").addEventListener("input", debounce(saveCurrent, 400));
    $("#approve-cb").addEventListener("change", () => saveCurrent(true));
  }}

  async function saveCurrent(fromApprove) {{
    if (!activeId) return;
    const row = quotes.find((q) => q.id === activeId);
    if (!row) return;
    const zh = ($("#zh-edit") && $("#zh-edit").value.trim()) || "";
    const ok = $("#approve-cb") && $("#approve-cb").checked;
    approved[activeId] = {{
      approved: !!ok,
      quote_zh: zh,
      updated_at: new Date().toISOString(),
    }};
    localStorage.setItem(LS_KEY, JSON.stringify(approved));
    if (apiOk) {{
      try {{
        await fetch("/api/approve", {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify({{ id: activeId, approved: !!ok, quote_zh: zh }}),
        }});
        if (fromApprove) toast(ok ? "已保留" : "已取消保留");
      }} catch (e) {{
        toast("保存失败（仅 localStorage）");
      }}
    }} else if (fromApprove) {{
      toast(ok ? "已保留（仅浏览器缓存）" : "已取消保留");
    }}
    renderList();
  }}

  function esc(s) {{
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }}

  function debounce(fn, ms) {{
    let t;
    return (...a) => {{ clearTimeout(t); t = setTimeout(() => fn(...a), ms); }};
  }}

  listEl.addEventListener("click", (e) => {{
    const btn = e.target.closest(".item");
    if (!btn) return;
    activeId = btn.dataset.id;
    renderList();
    renderPanel(activeId);
  }});

  $("#q").addEventListener("input", debounce(renderList, 120));
  $("#filter").addEventListener("change", renderList);

  $("#export-json").addEventListener("click", () => {{
    const blob = new Blob([JSON.stringify(approved, null, 2)], {{ type: "application/json" }});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "approved.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("已下载 approved.json");
  }});

  $("#open-approved").addEventListener("click", () => {{
    window.open("approved.html", "_blank");
  }});

  async function probeApi() {{
    try {{
      const r = await fetch("/api/ping", {{ method: "GET" }});
      apiOk = r.ok;
    }} catch {{
      apiOk = false;
    }}
    try {{
      const ls = localStorage.getItem(LS_KEY);
      if (ls) {{
        const parsed = JSON.parse(ls);
        approved = {{ ...approved, ...parsed }};
      }}
    }} catch {{}}
    renderList();
  }}

  probeApi();
}})();
  </script>
</body>
</html>
"""


def write_outputs(quotes: list[dict]) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    QUOTES_JSON.write_text(json.dumps(quotes, ensure_ascii=False, indent=2), encoding="utf-8")
    approved = load_approved()
    REVIEW_HTML.write_text(render_review_html(quotes, approved), encoding="utf-8")
    APPROVED_HTML.write_text(render_approved_html(quotes, approved), encoding="utf-8")
    _log(f"[ok] {len(quotes)} quotes -> {QUOTES_JSON}")
    _log(f"[ok] review -> {REVIEW_HTML}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch gal quotes from VNDB")
    ap.add_argument("--limit", type=int, default=1200, help="max quotes (default 1200)")
    ap.add_argument("--min-score", type=int, default=0, help="VNDB score filter (default 0)")
    ap.add_argument("--translate", action="store_true", help="机翻英文台词为中文")
    ap.add_argument(
        "--workers",
        type=int,
        default=8,
        help="机翻并行线程数（默认 8，建议 4–16）",
    )
    ap.add_argument(
        "--reuse",
        action="store_true",
        help="不重新抓取，基于现有 quotes.json 补汉化并重生 HTML",
    )
    args = ap.parse_args()

    if args.reuse and QUOTES_JSON.is_file():
        quotes = json.loads(QUOTES_JSON.read_text(encoding="utf-8"))
        _log(f"[reuse] {len(quotes)} from {QUOTES_JSON}")
    else:
        quotes = fetch_quotes(limit=max(1, args.limit), min_score=max(0, args.min_score))

    quotes = enrich_zh(
        quotes,
        do_translate=bool(args.translate),
        workers=max(1, args.workers),
    )
    write_outputs(quotes)
    zh_count = sum(1 for q in quotes if q.get("quote_zh"))
    title_zh = sum(1 for q in quotes if q.get("vn_title_zh"))
    _log(f"[stat] quote_zh={zh_count}/{len(quotes)} vn_title_zh={title_zh}/{len(quotes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
