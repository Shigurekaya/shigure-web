# -*- coding: utf-8 -*-
"""
玩家视角全题审计：逐题检查可答性、媒体、假「看图」、别名、判分过宽等。
输出 UTF-8 报告，不依赖控制台编码。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from quiz_match import check_text, normalize as norm

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
JS = ROOT / "js" / "gal-quiz-data.js"
OUT = RAW / "player_view_audit.json"
OUT_MD = RAW / "player_view_audit.md"

IMG_PROMPT = re.compile(r"请根据图片|根据图片|图中|看[图圖]|图片里|如[图圖]|（含.*剪影")
AUD_PROMPT = re.compile(r"请根据音频|请听|听音频|音频（|与音频")
NUM_PROMPT = re.compile(r"[①②③④⑤⑥⑦⑧]|①～|①〜|1～|编号")
LR_PROMPT = re.compile(r"左.*右|右.*左|哪边")
JA_IMG = re.compile(
    r"画像|イラスト|パッケージ|起動アイコン|シルエット|ポーズ|"
    r"制服|聖地|マスコット|部屋|掛け軸|Tシャツ|Ｔシャツ|"
    r"エンドカード|アイコン|番号で|アフター|構図|ヒント"
)


def load_bank():
    text = JS.read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S).group(1))


def media_exists(rel: str) -> bool:
    return (ROOT / rel.lstrip("/")).is_file()


def file_size(rel: str) -> int:
    p = ROOT / rel.lstrip("/")
    return p.stat().st_size if p.is_file() else -1


def main() -> int:
    bank = load_bank()
    raw = {q["id"]: q for q in json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))}

    issues: list[dict] = []
    per_q: list[dict] = []

    junk = ["test", "aaa", "不知道", "随便", "a", "1", "はい", "不知道啊"]

    for q in bank:
        qid = q["id"]
        stem = q.get("question") or ""
        r = raw.get(qid, {})
        qj = r.get("question_ja") or ""
        imgs = q.get("images") or []
        aud = q.get("audio") or []
        vid = q.get("video") or []
        nimg, naud, nvid = len(imgs), len(aud), len(vid)

        entry = {
            "id": qid,
            "type": q.get("type"),
            "stem": stem,
            "nimg": nimg,
            "naud": naud,
            "nvid": nvid,
            "flags": [],
        }

        # media missing / tiny
        for kind, arr in (("image", imgs), ("audio", aud), ("video", vid)):
            for rel in arr:
                if not media_exists(rel):
                    issues.append({"id": qid, "sev": "error", "kind": f"missing_{kind}", "detail": rel})
                    entry["flags"].append(f"missing:{rel}")
                else:
                    sz = file_size(rel)
                    if sz < 500:
                        issues.append(
                            {"id": qid, "sev": "error", "kind": "tiny_media", "detail": f"{rel} ({sz}B)"}
                        )
                        entry["flags"].append(f"tiny:{rel}")

        # prompt vs media
        if IMG_PROMPT.search(stem) and nimg == 0:
            issues.append({"id": qid, "sev": "error", "kind": "img_prompt_no_media", "detail": stem[:80]})
            entry["flags"].append("img_prompt_no_media")
        if AUD_PROMPT.search(stem) and naud == 0 and nvid == 0:
            issues.append({"id": qid, "sev": "error", "kind": "aud_prompt_no_media", "detail": stem[:80]})
            entry["flags"].append("aud_prompt_no_media")

        # 题干写看图，但原题日文无看图线索 → 假看图
        if IMG_PROMPT.search(stem) and not JA_IMG.search(qj) and "こちらは" not in qj:
            issues.append(
                {
                    "id": qid,
                    "sev": "warn",
                    "kind": "fake_image_prompt",
                    "detail": "ZH says 根据图片 but JA has no image cue",
                }
            )
            entry["flags"].append("fake_image_prompt")

        # 原题看图，汉化却没写，且有图 — 可接受，不强制
        # 原题看图但无图 — 严重
        if JA_IMG.search(qj) and nimg == 0 and not IMG_PROMPT.search(stem):
            # some JA use 画像 metaphorically; still flag
            if re.search(r"画像|イラスト|パッケージ|アイコン|制服|聖地|部屋|シルエット", qj):
                issues.append(
                    {
                        "id": qid,
                        "sev": "error",
                        "kind": "ja_needs_image_missing",
                        "detail": qj[:100].replace("\n", " / "),
                    }
                )
                entry["flags"].append("ja_needs_image_missing")

        # 编号题但无足够图（允许单张合成图）
        if re.search(r"①～④|①～⑥|①～⑧|①～⑦|①～⑤", stem) and nimg == 0:
            issues.append({"id": qid, "sev": "error", "kind": "numbered_no_image", "detail": stem[:80]})
            entry["flags"].append("numbered_no_image")

        # 左右题
        if LR_PROMPT.search(stem) and nimg < 1:
            issues.append({"id": qid, "sev": "error", "kind": "lr_no_image", "detail": stem[:80]})
            entry["flags"].append("lr_no_image")

        # 空答案 / 选项
        if q.get("type") == "choice":
            opts = q.get("options") or []
            ans = q.get("answer")
            idxs = ans if isinstance(ans, list) else [ans]
            if not opts:
                issues.append({"id": qid, "sev": "error", "kind": "empty_options", "detail": ""})
                entry["flags"].append("empty_options")
            for i in idxs:
                if i is None or i < 0 or i >= len(opts):
                    issues.append(
                        {"id": qid, "sev": "error", "kind": "bad_answer_index", "detail": f"{ans}/{len(opts)}"}
                    )
                    entry["flags"].append("bad_answer_index")
            # 正确答案原样出现在题干（排除作品名短词误报：要求答案不整段出现在题干作为独立泄漏）
            # 仅当「选项全文」在题干中且选项较长，且不是「候选列表」题
        else:
            answers = q.get("answers") or []
            if not answers:
                issues.append({"id": qid, "sev": "error", "kind": "empty_answers", "detail": ""})
                entry["flags"].append("empty_answers")
            for junk_s in junk:
                if check_text(junk_s, answers):
                    issues.append(
                        {
                            "id": qid,
                            "sev": "warn",
                            "kind": "junk_accept",
                            "detail": f"{junk_s!r} → {answers[0][:40]}",
                        }
                    )
                    entry["flags"].append(f"junk:{junk_s}")

            # 真实泄题：完整答案串（去空格后）出现在题干，且答案不是题干里已点名的作品简称
            # 更严：答案 normalize 后长度>=8，且整段在题干 normalize 中，且答案不是题干里书名号内容的子集
            books = set(re.findall(r"《([^》]+)》", stem))
            book_n = {norm(b) for b in books}
            for a in answers:
                an = norm(a)
                if len(an) < 8:
                    continue
                # skip if answer is essentially the titled work already named
                if any(an == bn or an in bn or bn in an for bn in book_n if len(bn) >= 4):
                    continue
                # skip aliases that are mostly the work title from JA【】
                ja_titles = set(re.findall(r"【([^】]+)】", qj))
                ja_n = {norm(t) for t in ja_titles}
                if any(an == jn or an in jn or jn in an for jn in ja_n if len(jn) >= 4):
                    continue
                stn = norm(stem)
                if an in stn:
                    issues.append(
                        {
                            "id": qid,
                            "sev": "error",
                            "kind": "answer_verbatim_in_stem",
                            "detail": a[:60],
                        }
                    )
                    entry["flags"].append("answer_in_stem")

        # explain empty
        if not (q.get("explain") or "").strip():
            issues.append({"id": qid, "sev": "info", "kind": "empty_explain", "detail": ""})
            entry["flags"].append("empty_explain")

        per_q.append(entry)

    # 汇总
    by_sev = {"error": [], "warn": [], "info": []}
    for x in issues:
        by_sev[x["sev"]].append(x)

    report = {
        "total": len(bank),
        "issue_counts": {k: len(v) for k, v in by_sev.items()},
        "errors": by_sev["error"],
        "warns": by_sev["warn"],
        "infos": by_sev["info"],
        "flagged_questions": [e for e in per_q if e["flags"]],
        "all_questions": [
            {
                "id": e["id"],
                "type": e["type"],
                "media": f"img={e['nimg']} aud={e['naud']} vid={e['nvid']}",
                "stem": e["stem"][:120],
                "flags": e["flags"],
            }
            for e in per_q
        ],
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        f"# Player-view audit ({len(bank)} questions)",
        "",
        f"- errors: {len(by_sev['error'])}",
        f"- warns: {len(by_sev['warn'])}",
        f"- infos: {len(by_sev['info'])}",
        "",
        "## Errors",
    ]
    if not by_sev["error"]:
        lines.append("(none)")
    for x in by_sev["error"]:
        lines.append(f"- **{x['id']}** `{x['kind']}`: {x['detail']}")
    lines += ["", "## Warns"]
    if not by_sev["warn"]:
        lines.append("(none)")
    for x in by_sev["warn"]:
        lines.append(f"- **{x['id']}** `{x['kind']}`: {x['detail']}")
    lines += ["", "## Every question (stem + media)"]
    for e in per_q:
        flag = (" ⚠ " + ",".join(e["flags"])) if e["flags"] else ""
        lines.append(
            f"- `{e['id']}` [{e['type']}] img={e['nimg']} aud={e['naud']} vid={e['nvid']}{flag}"
        )
        lines.append(f"  {e['stem'][:140].replace(chr(10), ' / ')}")

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_MD}")
    print(f"errors={len(by_sev['error'])} warns={len(by_sev['warn'])} infos={len(by_sev['info'])}")
    return 1 if by_sev["error"] else 0


if __name__ == "__main__":
    sys.exit(main())
