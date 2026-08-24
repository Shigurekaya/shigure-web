# -*- coding: utf-8 -*-
"""Parse ima-ero quiz HTML into structured JSON + media URL list."""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

RAW = Path(__file__).resolve().parent
BASE = "https://www.ima-ero.com"


def abs_url(u: str) -> str:
    u = (u or "").strip()
    if not u:
        return ""
    if u.startswith("//"):
        return "https:" + u
    if u.startswith("http"):
        return u
    return urljoin(BASE + "/", u.lstrip("/"))


def strip_tags(html: str) -> str:
    t = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    t = re.sub(r"</p>|</li>|</div>|</h\d>", "\n", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    for a, b in (
        ("&nbsp;", " "),
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", '"'),
        ("&#x2665;", "♥"),
        ("&#8212;", "—"),
        ("&#12316;", "〜"),
    ):
        t = t.replace(a, b)
    t = re.sub(r"&#\d+;", "", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def extract_media(block: str) -> dict:
    imgs = []
    for m in re.finditer(
        r'<img[^>]+(?:data-src|src)=["\']([^"\']+)["\']', block, re.I
    ):
        u = abs_url(m.group(1))
        if not u:
            continue
        if "speech-bubble" in u or "wp-includes" in u:
            continue
        if u.endswith("1x1.jpg") or "/1x1." in u:
            continue
        imgs.append(u)
    # lazy data-src that may coexist
    for m in re.finditer(r'data-src=["\']([^"\']+)["\']', block, re.I):
        u = abs_url(m.group(1))
        if u and "speech-bubble" not in u and "1x1" not in u and "wp-includes" not in u:
            imgs.append(u)
    audios = []
    for m in re.finditer(
        r'<(?:audio|source)[^>]+src=["\']([^"\']+)["\']', block, re.I
    ):
        audios.append(abs_url(m.group(1)))
    # bare .mp3 links in text/html
    for m in re.finditer(r'(https?://[^\s"\'<>]+\.mp3)', block, re.I):
        audios.append(m.group(1))
    for m in re.finditer(r'src=["\']([^"\']+\.mp3)["\']', block, re.I):
        audios.append(abs_url(m.group(1)))
    videos = []
    for m in re.finditer(
        r"<video[^>]*>[\s\S]*?</video>", block, re.I
    ):
        for s in re.finditer(r'src=["\']([^"\']+)["\']', m.group(0), re.I):
            videos.append(abs_url(s.group(1)))
    for m in re.finditer(r'<video[^>]+src=["\']([^"\']+)["\']', block, re.I):
        videos.append(abs_url(m.group(1)))
    iframes = []
    for m in re.finditer(r'<iframe[^>]+src=["\']([^"\']+)["\']', block, re.I):
        iframes.append(abs_url(m.group(1)))
    # youtube links
    for m in re.finditer(
        r'(https?://(?:www\.)?(?:youtube\.com/embed/|youtu\.be/)[^\s"\'<>]+)',
        block,
        re.I,
    ):
        iframes.append(m.group(1))

    def uniq(xs):
        seen, out = set(), []
        for x in xs:
            if x and x not in seen:
                seen.add(x)
                out.append(x)
        return out

    return {
        "images": uniq(imgs),
        "audio": uniq(audios),
        "video": uniq(videos),
        "embeds": uniq(iframes),
    }


def parse_answer(text: str) -> str:
    m = re.search(r"答え[：:]\s*(.+?)(?:\n|$)", text)
    if m:
        return m.group(1).strip()
    return ""


def parse_quiz(path: Path, source: int) -> list[dict]:
    html = path.read_text(encoding="utf-8", errors="ignore")
    html = re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", "", html, flags=re.I)
    # find entry content area if possible
    qs = []
    for m in re.finditer(
        r"<h3[^>]*>([\s\S]*?)</h3>([\s\S]*?)(?=<h3|以上です|</article|$)",
        html,
        re.I,
    ):
        heading = strip_tags(m.group(1))
        hm = re.search(r"第\s*([０-９0-9]+)\s*問", heading)
        if not hm:
            continue
        num_raw = hm.group(1)
        # normalize fullwidth digits
        trans = str.maketrans("０１２３４５６７８９", "0123456789")
        num = int(num_raw.translate(trans))
        block = m.group(2)
        # split answer accordion if present
        ans_html = ""
        q_html = block
        # common pattern: accordion with 正解
        split = re.search(
            r"(正解はこちら|答え[：:])",
            block,
        )
        media = extract_media(block)
        full_text = strip_tags(block)
        # remove checkbox noise
        full_text = re.sub(r"正解したらチェック！", "", full_text).strip()
        answer = parse_answer(full_text)
        # question body: before 答え
        q_text = full_text
        if "答え：" in full_text or "答え:" in full_text:
            q_text = re.split(r"答え[：:]", full_text, maxsplit=1)[0]
        q_text = re.sub(r"\+?\s*正解はこちら（クリックで展開）", "", q_text)
        q_text = q_text.strip()
        # explain after answer line
        explain = ""
        if answer:
            after = re.split(r"答え[：:].*", full_text, maxsplit=1)
            if len(after) > 1:
                explain = after[1].strip()

        qs.append(
            {
                "id": f"s{source}-{num:02d}",
                "source": source,
                "num": num,
                "question_ja": q_text,
                "answer_ja": answer,
                "explain_ja": explain[:800],
                "media": media,
            }
        )
    return qs


def main():
    all_q = []
    for i in range(1, 6):
        path = RAW / f"q{i}.html"
        qs = parse_quiz(path, i)
        print(f"quiz{i}: {len(qs)} questions")
        all_q.extend(qs)

    out = RAW / "questions_raw.json"
    out.write_text(json.dumps(all_q, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out, "total", len(all_q))

    # media list
    media = []
    for q in all_q:
        for k in ("images", "audio", "video"):
            for u in q["media"][k]:
                media.append({"id": q["id"], "kind": k[:-1] if k.endswith("s") else k, "url": u})
        for u in q["media"]["embeds"]:
            media.append({"id": q["id"], "kind": "embed", "url": u})
    (RAW / "media_list.json").write_text(
        json.dumps(media, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("media items", len(media))


if __name__ == "__main__":
    main()
