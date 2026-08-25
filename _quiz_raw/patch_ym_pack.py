# -*- coding: utf-8 -*-
"""一次性修补 ym_vndb_alias_pack.json 中的已知错配。"""
from __future__ import annotations

import json
from pathlib import Path

RAW = Path(__file__).resolve().parent
PACK = RAW / "ym_vndb_alias_pack.json"


def dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in items:
        k = x.casefold()
        if k in seen:
            continue
        seen.add(k)
        out.append(x)
    return out


def main() -> None:
    pack = json.loads(PACK.read_text(encoding="utf-8"))
    bq = pack.setdefault("by_query", {})

    # 大恶党 → DRACU-RIOT!（≠ 大悪司）
    bq["大恶党"] = {
        "ym_gid": 17858,
        "vndb_id": "v1069",
        "aliases": dedupe(
            [
                "Dracu-Riot!",
                "DRACU-RIOT!",
                "DRACU-RIOT",
                "ドラクリオット",
                "龙骑士骚动",
                "大恶党",
            ]
        ),
        "sources": {
            "ym": {
                "name": "Dracu-Riot!",
                "chineseName": None,
                "extension": ["ドラクリオット"],
                "matched_by": "DRACU-RIOT",
            },
            "vndb": {"title": "DRACU-RIOT!", "matched_by": "DRACU-RIOT"},
        },
    }

    # 大泉君：去掉误命中「妹を汚した記憶」
    oizumi = dedupe(
        [
            "リアル妹がいる大泉くんのばあい",
            "有个真妹妹的大泉君",
            "实妹相伴的大泉君",
            "Riaimo",
            "Real Imouto gairu Ooizumikun no Baai",
            "大泉くんのばあい",
        ]
    )
    bq["有个真妹妹的大泉君"] = {
        "ym_gid": None,
        "vndb_id": "v9888",
        "aliases": oizumi,
        "sources": {"vndb": {"title": "リアル妹がいる大泉くんのばあい", "matched_by": "manual"}},
    }
    bq["リアル妹がいる大泉くんのばあい"] = bq["有个真妹妹的大泉君"]

    # さらば諭吉（复古梗，无月幕条目）
    saraba = dedupe(
        [
            "さらば諭吉ぃっ!!",
            "さらば諭吉ぃっ",
            "さらば諭吉",
            "再见了谕吉",
        ]
    )
    for k in saraba:
        bq[k] = {
            "ym_gid": None,
            "vndb_id": None,
            "aliases": saraba,
            "sources": {"manual": "ima-ero quiz answer"},
        }

    # 作中作虚构标题
    bq["种付大叔 VS 迷你裙警察"] = {
        "ym_gid": None,
        "vndb_id": None,
        "aliases": ["种付大叔 VS 迷你裙警察", "種付おじさんVSミニスカ警察"],
        "sources": {"manual": "gal like a gal in-game title"},
    }

    # 查拉图：尼采/ Dies irae 相关可接受答法
    bq["查拉图斯特拉如是说"] = {
        "ym_gid": None,
        "vndb_id": "v95",
        "aliases": dedupe(
            [
                "查拉图斯特拉如是说",
                "Also sprach Zarathustra",
                "Dies irae Also sprach Zarathustra",
            ]
        ),
        "sources": {"manual": "s2-18 alternate answer"},
    }

    # 重建 by_ja / by_cn / by_qid
    from enrich_aliases_ym_vndb import build_pack, collect_queries

    _, qid_queries = collect_queries()
    pack = build_pack(bq, qid_queries)
    PACK.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
    nonempty = sum(1 for v in pack["by_qid"].values() if v)
    print(f"patched {PACK.name}: by_qid_nonempty={nonempty}/{len(pack['by_qid'])}")


if __name__ == "__main__":
    main()
