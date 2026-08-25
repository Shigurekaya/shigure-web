# -*- coding: utf-8 -*-
"""严格审查 gal-quiz 未引用素材，确认可删后再输出清单。"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
ASSET = ROOT / "assets" / "gal-quiz"

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
AUD_EXT = {".mp3", ".ogg", ".wav", ".m4a", ".flac"}
VID_EXT = {".mp4", ".webm", ".mkv", ".mov"}
MEDIA_EXT = IMG_EXT | AUD_EXT | VID_EXT
SKIP_DIRS = {"_delete-images", "_review-delete-r18"}

# 文本命中若仅出现在这些路径，视为审计残留，不算运行时引用
AUDIT_HINTS = (
    "_quiz_raw/",
    "manifest",
    "audit",
    "scan",
    "review",
    "compact",
    "dump",
    "player_view",
    "media_list",
    "r18_",
    "extra",
    "_unused_media",
    "_all_image",
    "_multi_image",
    "_player_media",
    "_junk_",
    "_text_qs",
    "_convert",
    "moegirl",
    "ym_vndb",
)


def norm(rel: str) -> str:
    return str(rel).strip().lstrip("/").replace("\\", "/")


def load_bank() -> list[dict]:
    text = (ROOT / "js" / "gal-quiz-data.js").read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S).group(1))


def add_ref(store: dict[str, set[str]], rel: str, source: str) -> None:
    r = norm(rel)
    if not r:
        return
    if r.startswith("http://") or r.startswith("https://"):
        if "gal-quiz" not in r:
            return
    store[r.lower()].add(source)


def collect_runtime_refs(bank: list[dict]) -> dict[str, set[str]]:
    refs: dict[str, set[str]] = defaultdict(set)
    for q in bank:
        qid = q["id"]
        for kind in ("images", "audio", "video"):
            for rel in q.get(kind) or []:
                add_ref(refs, rel, f"bank:{qid}:{kind}")

    map_path = RAW / "media_local_map.json"
    if map_path.is_file():
        mmap = json.loads(map_path.read_text(encoding="utf-8"))
        for qid, m in mmap.items():
            if not isinstance(m, dict):
                continue
            for kind in ("images", "audio", "video"):
                for rel in m.get(kind) or []:
                    add_ref(refs, rel, f"media_map:{qid}:{kind}")

    raw_path = RAW / "questions_raw.json"
    if raw_path.is_file():
        for q in json.loads(raw_path.read_text(encoding="utf-8")):
            m = q.get("media") or {}
            for kind in ("images", "audio", "video"):
                for rel in m.get(kind) or []:
                    s = str(rel)
                    if "gal-quiz" in s or s.startswith("/assets/") or s.startswith("assets/"):
                        add_ref(refs, rel, f"raw:{q['id']}:{kind}")
    return refs


def iter_media_files():
    for p in ASSET.rglob("*"):
        if not p.is_file():
            continue
        parts = p.relative_to(ASSET).parts
        if parts[0] in SKIP_DIRS:
            continue
        if p.suffix.lower() not in MEDIA_EXT:
            continue
        rel = norm("assets/gal-quiz/" + "/".join(parts))
        yield p, rel


def load_text_corpus() -> list[tuple[str, str]]:
    blobs: list[tuple[str, str]] = []
    for folder in (ROOT / "js", ROOT / "css", RAW):
        if not folder.exists():
            continue
        for f in folder.rglob("*"):
            if not f.is_file():
                continue
            if f.suffix.lower() not in {".js", ".css", ".html", ".json", ".md", ".txt", ".py", ".mjs"}:
                continue
            if f.stat().st_size > 5_000_000:
                continue
            try:
                blobs.append((norm(str(f.relative_to(ROOT))), f.read_text(encoding="utf-8", errors="ignore")))
            except OSError:
                pass
    for name in ("gal-quiz.html", "index.html"):
        f = ROOT / name
        if f.is_file():
            blobs.append((name, f.read_text(encoding="utf-8", errors="ignore")))
    return blobs


def is_audit_only(paths: list[str]) -> bool:
    for ff in paths:
        n = ff.replace("\\", "/")
        if n.endswith("gal-quiz-data.js") or n.endswith("media_local_map.json"):
            return False
        if n.endswith(".html") and not n.startswith("_quiz_raw"):
            return False
        if any(h in n for h in AUDIT_HINTS):
            continue
        # other runtime-ish files
        if n.startswith("js/") or n.startswith("css/"):
            return False
        return False
    return True


def main() -> None:
    bank = load_bank()
    refs = collect_runtime_refs(bank)
    bank_paths = {
        norm(rel)
        for q in bank
        for kind in ("images", "audio", "video")
        for rel in (q.get(kind) or [])
    }
    bank_paths_l = {p.lower() for p in bank_paths}

    used_basenames: dict[str, list[str]] = defaultdict(list)
    for r in refs:
        used_basenames[Path(r).name].append(r)

    candidates = [(p, rel) for p, rel in iter_media_files() if rel.lower() not in refs]
    corpus = load_text_corpus()

    safe: list[dict] = []
    suspicious: list[dict] = []

    for p, rel in candidates:
        name = p.name
        name_l = name.lower()
        qid = p.relative_to(ASSET).parts[0]
        size = p.stat().st_size
        why: list[str] = []

        # hard fail if somehow still in bank
        if rel in bank_paths or rel.lower() in bank_paths_l:
            suspicious.append({"path": rel, "bytes": size, "why": ["IN_BANK_UNEXPECTED"]})
            continue

        # duplicate misplaced audio: video/foo.mp3 while bank uses audio/foo.mp3 same qid
        if p.suffix.lower() in AUD_EXT and p.parent.name == "video" and name_l in used_basenames:
            same_qid = [
                u
                for u in used_basenames[name_l]
                if f"assets/gal-quiz/{qid}/".lower() in u
            ]
            if same_qid and any("/audio/" in u for u in same_qid):
                # also verify the used file exists
                ok_exists = any((ROOT / u.replace("/", "\\") if False else ROOT.joinpath(*u.split("/"))).is_file() for u in same_qid)
                if ok_exists:
                    safe.append(
                        {
                            "path": rel,
                            "bytes": size,
                            "why": [f"dup_audio_of:{same_qid[0]}"],
                            "qid": qid,
                        }
                    )
                    continue

        if name_l in used_basenames:
            # same basename used by another path — do not delete unless proven same-qid audio dup (handled above)
            why.append("basename_used_elsewhere:" + ";".join(used_basenames[name_l][:4]))

        hits: list[str] = []
        for src, txt in corpus:
            if name in txt or rel in txt:
                hits.append(src)
                if len(hits) >= 8:
                    break
        if hits:
            why.append("text_mention:" + ",".join(hits[:8]))

        if why:
            # basename collision with OTHER files → keep
            if any(w.startswith("basename_used_elsewhere") for w in why):
                suspicious.append({"path": rel, "bytes": size, "why": why, "qid": qid})
                continue
            # only audit mentions → safe
            mention_files = []
            for w in why:
                if w.startswith("text_mention:"):
                    mention_files = w.split(":", 1)[1].split(",")
            if mention_files and is_audit_only(mention_files):
                safe.append({"path": rel, "bytes": size, "why": ["audit_only"] + why, "qid": qid})
            else:
                suspicious.append({"path": rel, "bytes": size, "why": why, "qid": qid})
        else:
            safe.append({"path": rel, "bytes": size, "why": ["no_runtime_ref"], "qid": qid})

    # Final gate: for every safe path, re-check bank + exists as unused
    final_safe = []
    for item in safe:
        rel = item["path"]
        p = ROOT.joinpath(*rel.split("/"))
        if not p.is_file():
            continue
        if rel in bank_paths or rel.lower() in bank_paths_l:
            suspicious.append({**item, "why": item["why"] + ["FINAL_GATE_IN_BANK"]})
            continue
        # ensure deleting won't remove the only copy of a used basename for this qid image
        name_l = Path(rel).name.lower()
        if name_l in used_basenames and not any(w.startswith("dup_audio_of:") for w in item["why"]):
            # unused extra image whose filename coincides with another question's used image
            suspicious.append({**item, "why": item["why"] + ["basename_shared_skip"]})
            continue
        final_safe.append(item)

    # Verify used media still all exist
    missing_used = [r for r in sorted(bank_paths) if not ROOT.joinpath(*r.split("/")).is_file()]

    report = {
        "bank_questions": len(bank),
        "runtime_refs": len(refs),
        "candidates": len(candidates),
        "safe_delete": sorted(final_safe, key=lambda x: x["path"]),
        "suspicious_keep": sorted(suspicious, key=lambda x: x["path"]),
        "missing_used": missing_used,
        "safe_count": len(final_safe),
        "safe_mb": round(sum(i["bytes"] for i in final_safe) / 1024 / 1024, 2),
        "suspicious_count": len(suspicious),
    }
    out = RAW / "_unused_media_strict.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"bank={report['bank_questions']} refs={report['runtime_refs']} candidates={report['candidates']}")
    print(f"SAFE delete: {report['safe_count']} ({report['safe_mb']} MB)")
    print(f"SUSPICIOUS keep: {report['suspicious_count']}")
    print(f"missing used refs: {len(missing_used)}")
    if suspicious:
        print("--- suspicious sample ---")
        for item in report["suspicious_keep"][:20]:
            print(item["path"])
            for w in item["why"]:
                print("  ", w)
    print("wrote", out)


if __name__ == "__main__":
    main()
