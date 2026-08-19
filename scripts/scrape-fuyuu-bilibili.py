#!/usr/bin/env python3
"""从 B 站抓取浮游Lev 投稿，更新 fuyuu WORK 页数据（带浏览器伪装）。

用法见 docs/update-fuyuu-videos.md
  uv run --with httpx python scripts/scrape-fuyuu-bilibili.py
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx

MID = 353604313
ROOT = Path(__file__).resolve().parents[1]
FUYUU = ROOT / "fuyuu"
COVER_ASSETS = FUYUU / "assets" / "images" / "covers"
COVER_DATA = FUYUU / "data" / "images" / "covers"
DATA_IMAGES = FUYUU / "data" / "images"
SITE_DATA_JS = FUYUU / "js" / "site-data.js"
PROFILE_JSON = FUYUU / "data" / "profile.json"

TZ_CN = timezone(timedelta(hours=8))

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

# WBI mixin 表（公开算法）
MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]


def browser_headers(referer: str | None = None) -> dict[str, str]:
    ref = referer or f"https://space.bilibili.com/{MID}"
    return {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        # 不声明 br：避免未装 brotli 时拿到压缩体解不开
        "Accept-Encoding": "gzip, deflate",
        "Origin": "https://space.bilibili.com",
        "Referer": ref,
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Connection": "keep-alive",
    }


def get_mixin_key(img_key: str, sub_key: str) -> str:
    raw = img_key + sub_key
    return "".join(raw[i] for i in MIXIN_KEY_ENC_TAB)[:32]


def wbi_sign(params: dict, mixin_key: str) -> dict:
    params = dict(params)
    params["wts"] = int(time.time())
    filtered = {
        k: "".join(c for c in str(v) if c not in "!'()*")
        for k, v in params.items()
    }
    query = urllib.parse.urlencode(sorted(filtered.items()))
    filtered["w_rid"] = hashlib.md5((query + mixin_key).encode()).hexdigest()
    return filtered


class BiliClient:
    def __init__(self) -> None:
        self.client = httpx.Client(
            headers=browser_headers(),
            timeout=30.0,
            follow_redirects=True,
            http2=False,
        )
        self.mixin_key = ""
        self._warmup()

    def _warmup(self) -> None:
        # 拿 buvid / 会话 cookie，降低风控
        self.client.cookies.set("buvid3", f"{hashlib.md5(str(time.time()).encode()).hexdigest()}infoc", domain=".bilibili.com")
        self.client.get("https://www.bilibili.com", headers=browser_headers("https://www.bilibili.com/"))
        nav = self.get_json("https://api.bilibili.com/x/web-interface/nav")
        wbi = (nav.get("data") or {}).get("wbi_img") or {}
        img = Path(urllib.parse.urlparse(wbi.get("img_url", "")).path).stem
        sub = Path(urllib.parse.urlparse(wbi.get("sub_url", "")).path).stem
        if not img or not sub:
            raise RuntimeError(f"无法获取 WBI keys: {nav}")
        self.mixin_key = get_mixin_key(img, sub)
        print(f"[ok] WBI ready")

    def get_json(self, url: str, params: dict | None = None, *, signed: bool = False) -> dict:
        p = dict(params or {})
        if signed:
            p = wbi_sign(p, self.mixin_key)
        for attempt in range(4):
            r = self.client.get(url, params=p, headers=browser_headers())
            if r.status_code == 412:
                time.sleep(1.5 * (attempt + 1))
                continue
            r.raise_for_status()
            try:
                data = r.json()
            except Exception:
                preview = r.content[:200]
                raise RuntimeError(
                    f"非 JSON 响应 status={r.status_code} url={r.url} body={preview!r}"
                ) from None
            code = data.get("code")
            if code in (-352, -412, -509) and attempt < 3:
                time.sleep(1.2 * (attempt + 1))
                continue
            return data
        return r.json()

    def download(self, url: str, dest: Path) -> bool:
        if not url:
            return False
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("http://"):
            url = "https://" + url[len("http://") :]
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            r = self.client.get(
                url,
                headers={
                    **browser_headers("https://www.bilibili.com/"),
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                },
            )
            r.raise_for_status()
            dest.write_bytes(r.content)
            return True
        except Exception as e:
            print(f"  [warn] download fail {dest.name}: {e}")
            return False

    def close(self) -> None:
        self.client.close()


def fmt_date(ts: int) -> str:
    return datetime.fromtimestamp(ts, TZ_CN).strftime("%Y.%m.%d")


def fetch_card(bili: BiliClient) -> dict:
    data = bili.get_json(
        "https://api.bilibili.com/x/web-interface/card",
        {"mid": MID, "photo": "true"},
    )
    if data.get("code") != 0:
        raise RuntimeError(f"card API: {data}")
    return data["data"]


def fetch_relation(bili: BiliClient) -> dict:
    data = bili.get_json(
        "https://api.bilibili.com/x/relation/stat",
        {"vmid": MID},
    )
    return data.get("data") or {}


def fetch_upstat(bili: BiliClient) -> dict:
    data = bili.get_json(
        "https://api.bilibili.com/x/space/upstat",
        {"mid": MID},
        signed=True,
    )
    return data.get("data") or {}


def fetch_all_videos(bili: BiliClient) -> list[dict]:
    videos: list[dict] = []
    pn = 1
    ps = 50
    while True:
        data = bili.get_json(
            "https://api.bilibili.com/x/space/wbi/arc/search",
            {
                "mid": MID,
                "pn": pn,
                "ps": ps,
                "order": "pubdate",
                "tid": 0,
                "keyword": "",
            },
            signed=True,
        )
        if data.get("code") != 0:
            # 回退旧接口
            data = bili.get_json(
                "https://api.bilibili.com/x/space/arc/search",
                {
                    "mid": MID,
                    "pn": pn,
                    "ps": ps,
                    "order": "pubdate",
                    "tid": 0,
                    "keyword": "",
                },
            )
        if data.get("code") != 0:
            raise RuntimeError(f"arc search fail pn={pn}: {data}")

        lst = ((data.get("data") or {}).get("list") or {}).get("vlist") or []
        count = ((data.get("data") or {}).get("page") or {}).get("count") or 0
        videos.extend(lst)
        print(f"[ok] page {pn}: +{len(lst)} (total {len(videos)}/{count})")
        if not lst or len(videos) >= count:
            break
        pn += 1
        time.sleep(0.45)
    return videos


def build_outputs(card: dict, relation: dict, upstat: dict, vlist: list[dict], bili: BiliClient) -> None:
    card_user = card.get("card") or {}
    pendant = card_user.get("pendant") or {}
    now = datetime.now(timezone.utc)
    data_updated = datetime.now(TZ_CN).strftime("%Y.%m.%d")

    avatar_url = card_user.get("face") or ""
    pendant_url = pendant.get("image") or ""

    avatar_assets = FUYUU / "assets" / "images" / "avatar.jpg"
    pendant_assets = FUYUU / "assets" / "images" / "pendant.jpg"
    avatar_data = DATA_IMAGES / "avatar.jpg"
    pendant_data = DATA_IMAGES / "pendant.jpg"

    print("[..] download avatar / pendant")
    bili.download(avatar_url, avatar_assets)
    bili.download(avatar_url, avatar_data)
    if pendant_url:
        bili.download(pendant_url, pendant_assets)
        bili.download(pendant_url, pendant_data)

    COVER_ASSETS.mkdir(parents=True, exist_ok=True)
    COVER_DATA.mkdir(parents=True, exist_ok=True)

    profile_videos = []
    site_videos = []
    images = {
        "avatar": "data/images/avatar.jpg",
        "pendant": "data/images/pendant.jpg",
    }

    for i, v in enumerate(vlist):
        bvid = v.get("bvid") or ""
        if not bvid:
            continue
        pic = v.get("pic") or ""
        title = v.get("title") or ""
        desc = v.get("description") or ""
        created = int(v.get("created") or 0)
        length = v.get("length") or ""
        typename = v.get("typeid")  # often int; keep empty string like before if unused
        typename_s = ""
        if isinstance(v.get("typename"), str):
            typename_s = v["typename"]

        cover_name = f"{bvid}.jpg"
        assets_path = COVER_ASSETS / cover_name
        data_path = COVER_DATA / cover_name
        legacy_path = DATA_IMAGES / f"video_{i}.jpg"

        print(f"[..] cover {i+1}/{len(vlist)} {bvid}")
        ok = bili.download(pic, assets_path)
        if ok:
            data_path.write_bytes(assets_path.read_bytes())
            legacy_path.write_bytes(assets_path.read_bytes())
        time.sleep(0.12)

        profile_videos.append(
            {
                "bvid": bvid,
                "title": title,
                "description": desc,
                "pic": pic.replace("https://", "http://") if pic.startswith("https://") else pic,
                "play": int(v.get("play") or 0),
                "comment": int(v.get("comment") or 0),
                "created": created,
                "length": length,
                "typename": typename_s,
                "local_pic": f"data/images/covers/{cover_name}",
            }
        )
        site_videos.append(
            {
                "bvid": bvid,
                "title": title,
                "description": desc,
                "date": fmt_date(created) if created else "",
                "length": length,
                "thumb": f"assets/images/covers/{cover_name}",
                "typename": typename_s,
            }
        )
        images[f"video_{i}"] = f"data/images/video_{i}.jpg"

    likes = card.get("like_num")
    if not isinstance(likes, int):
        likes = upstat.get("likes") if isinstance(upstat.get("likes"), int) else 0
    if not isinstance(likes, int):
        likes = 0

    profile = {
        "mid": MID,
        "source": "bilibili",
        "bilibili_url": f"https://space.bilibili.com/{MID}",
        "user": {
            "mid": MID,
            "name": card_user.get("name") or "浮游Lev",
            "sex": card_user.get("sex") or "",
            "sign": card_user.get("sign") or "",
            "face": avatar_url,
            "level": (card_user.get("level_info") or {}).get("current_level", 0),
            "pendant": {
                "name": pendant.get("name") or "",
                "image": pendant_url,
            },
        },
        "stats": {
            "following": int(relation.get("following") or 0),
            "follower": int(relation.get("follower") or 0),
            "likes": int(likes or 0),
            "videos": len(profile_videos),
        },
        "videos": profile_videos,
        "seasons": [],
        "series": [],
        "images": images,
        "scraped_at": now.isoformat(),
    }

    site_data = {
        "mid": MID,
        "bilibili_url": f"https://space.bilibili.com/{MID}",
        "data_updated": data_updated,
        "user": {
            "name": profile["user"]["name"],
            "sign": profile["user"]["sign"],
            "pendant_name": profile["user"]["pendant"]["name"],
            "avatar": "assets/images/avatar.jpg",
            "pendant": "assets/images/pendant.jpg",
            "level": profile["user"]["level"],
            "sex": profile["user"]["sex"],
        },
        "videos": site_videos,
        "seasons": [],
        "series": [],
    }

    PROFILE_JSON.write_text(
        json.dumps(profile, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    js = (
        "// 站点数据（本地同步生成）· 浮游Lev\n"
        "window.SITE_DATA = "
        + json.dumps(site_data, ensure_ascii=False, indent=2)
        + ";\n"
    )
    SITE_DATA_JS.write_text(js, encoding="utf-8")

    # 清理多余的旧 video_N / 多余封面（可选：仅提示）
    print(f"[done] videos={len(site_videos)} data_updated={data_updated}")
    print(f"  wrote {SITE_DATA_JS.relative_to(ROOT)}")
    print(f"  wrote {PROFILE_JSON.relative_to(ROOT)}")


def main() -> int:
    print(f"scraping mid={MID} -> {FUYUU}")
    bili = BiliClient()
    try:
        card = fetch_card(bili)
        print(f"[ok] user={card.get('card', {}).get('name')}")
        relation = fetch_relation(bili)
        print(f"[ok] followers={relation.get('follower')}")
        upstat = fetch_upstat(bili)
        print(f"[ok] upstat keys={list(upstat.keys())}")
        vlist = fetch_all_videos(bili)
        if not vlist:
            print("[err] no videos", file=sys.stderr)
            return 1
        build_outputs(card, relation, upstat, vlist, bili)
        return 0
    finally:
        bili.close()


if __name__ == "__main__":
    raise SystemExit(main())
