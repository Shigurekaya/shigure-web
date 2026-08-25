# -*- coding: utf-8 -*-
"""按 _unused_media_strict.json 的 safe_delete 清单删除已确认无用素材。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
REPORT = RAW / "_unused_media_strict.json"


def load_bank_paths() -> set[str]:
    text = (ROOT / "js" / "gal-quiz-data.js").read_text(encoding="utf-8")
    bank = json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S).group(1))
    paths = set()
    for q in bank:
        for kind in ("images", "audio", "video"):
            for rel in q.get(kind) or []:
                paths.add(str(rel).strip().lstrip("/").replace("\\", "/"))
    return paths


def main() -> None:
    if not REPORT.is_file():
        raise SystemExit(f"missing report: {REPORT} — run audit_unused_media.py first")

    report = json.loads(REPORT.read_text(encoding="utf-8"))
    bank_paths = load_bank_paths()
    bank_l = {p.lower() for p in bank_paths}

    deleted = []
    skipped = []
    for item in report.get("safe_delete", []):
        rel = item["path"]
        if rel in bank_paths or rel.lower() in bank_l:
            skipped.append((rel, "still_in_bank"))
            continue
        p = ROOT.joinpath(*rel.split("/"))
        if not p.is_file():
            skipped.append((rel, "already_gone"))
            continue
        p.unlink()
        deleted.append(rel)

    # remove empty dirs under gal-quiz (except review folders)
    asset = ROOT / "assets" / "gal-quiz"
    skip = {"_delete-images", "_review-delete-r18"}
    for d in sorted(asset.rglob("*"), key=lambda x: len(x.parts), reverse=True):
        if not d.is_dir():
            continue
        if d.name in skip or any(p in skip for p in d.parts):
            continue
        try:
            d.rmdir()
        except OSError:
            pass

    # verify bank media still intact
    missing = [r for r in sorted(bank_paths) if not ROOT.joinpath(*r.split("/")).is_file()]

    summary = {
        "deleted_count": len(deleted),
        "skipped_count": len(skipped),
        "missing_after": missing,
        "suspicious_kept": [x["path"] for x in report.get("suspicious_keep", [])],
    }
    (RAW / "_unused_media_deleted.json").write_text(
        json.dumps({"deleted": deleted, "skipped": skipped, "summary": summary}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"deleted: {len(deleted)} files")
    print(f"skipped: {len(skipped)}")
    print(f"bank media missing after delete: {len(missing)}")
    if missing:
        for m in missing:
            print("  MISSING", m)
        raise SystemExit(1)
    kept = report.get("suspicious_keep", [])
    if kept:
        print(f"kept suspicious ({len(kept)}):")
        for x in kept:
            print(" ", x["path"], "—", "; ".join(x["why"][:2]))


if __name__ == "__main__":
    main()
