#!/usr/bin/env python3
"""Full tag coverage + consistency audit for gal-pick."""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEDAI = Path(__file__).with_name("sedai_tags.json")
SUPP = Path(__file__).with_name("pick_supplement_tags.json")
CATALOG = Path(__file__).with_name("gal-pick-catalog.json")

from extract_pick_catalog import derive_profile, is_tagged, row_to_game  # noqa: E402
from pick_tag_axes import (  # noqa: E402
    CN_MAP,
    VNDB_MAP,
    count_meaningful_tag_hits,
    derive_axes_from_raw_tags,
    is_sweet_incompatible,
    rederive_row_axes,
    tag_maps_to,
)
from pick_traits import RAW_TRAIT_RULES  # noqa: E402

AXIS_TONES = {"sweet", "heal", "drama", "mindbend", "epic", "hype", "literary", "utsuge"}
AXIS_SETTINGS = {"school", "daily", "fantasy", "scifi", "mystery"}
AXIS_PACES = {"short", "breezy", "slowburn", "dense"}


def load_rows() -> list[tuple[str, dict]]:
    out: list[tuple[str, dict]] = []
    for label, path in (("sedai", SEDAI), ("supplement", SUPP)):
        if path.exists():
            for row in json.loads(path.read_text(encoding="utf-8")):
                out.append((label, row))
    return out


def tag_name(raw: str) -> tuple[str, str]:
    if ":" in raw:
        src, name = raw.split(":", 1)
        return src, name
    return "vndb", raw


def trait_maps_to(name: str) -> bool:
    blob = name.lower()
    return any(p.search(blob) for p, _ in RAW_TRAIT_RULES)


def audit_coverage(rows: list[tuple[str, dict]]) -> dict:
    axis_mapped = Counter()
    axis_unmapped = Counter()
    trait_only = Counter()
    total_tag_hits = 0

    for _, row in rows:
        for raw in row.get("raw_tags") or []:
            src, name = tag_name(raw)
            total_tag_hits += 1
            hit = tag_maps_to(name, src)
            if hit:
                axis_mapped[name] += 1
            elif trait_maps_to(name):
                trait_only[name] += 1
            else:
                axis_unmapped[name] += 1

    return {
        "total_tag_hits": total_tag_hits,
        "unique_names": len(set(tag_name(t)[1] for _, r in rows for t in (r.get("raw_tags") or []))),
        "axis_mapped_names": len(axis_mapped),
        "trait_only_names": len(trait_only),
        "unmapped_names": len(axis_unmapped),
        "axis_unmapped_top": axis_unmapped.most_common(30),
        "trait_only_top": trait_only.most_common(15),
    }


def audit_consistency(rows: list[tuple[str, dict]]) -> dict[str, list]:
    issues: dict[str, list] = defaultdict(list)

    for source, row in rows:
        raw = row.get("raw_tags") or []
        name = row.get("name") or "?"
        if not raw:
            if row.get("tag_source") not in (None, "none", "heuristic"):
                issues["no_raw_tags"].append({"source": source, "name": name})
            continue

        expected = rederive_row_axes(row)
        for k in ("tone", "setting", "pace"):
            if row.get(k) != expected.get(k):
                issues["stored_vs_full_derive"].append(
                    {"name": name, "axis": k, "stored": row.get(k), "expected": expected.get(k)}
                )

        if count_meaningful_tag_hits(raw) == 0:
            from pick_title_rules import has_title_rule

            if not has_title_rule(name):
                issues["weak_tags_no_rule"].append({"name": name, "tags": raw[:3]})

        game = row_to_game(row, source)
        if is_sweet_incompatible(raw):
            if row.get("tone") in ("sweet", "heal"):
                issues["sweet_dark"].append({"name": name, "tone": row.get("tone")})
            if game.get("mood") == "light":
                issues["light_mood_dark"].append({"name": name})
            if game.get("focus") == "romance":
                issues["romance_focus_dark"].append({"name": name})

        blob = " ".join(raw).lower()
        if any(x in blob for x in ("romance", "恋爱", "纯爱", "vndb:romance")) and not is_sweet_incompatible(raw):
            if row.get("tone") in ("utsuge", "literary") and "comedy" not in blob:
                issues["romance_unexpected_tone"].append({"name": name, "tone": row.get("tone")})
        if re.search(r"\bmystery\b|悬疑|推理|multiple route mystery", blob) and "rape" not in blob:
            if (
                row.get("tone") not in ("mindbend", "drama", "sweet", "hype", "epic", "literary", "utsuge")
                and row.get("setting") != "mystery"
            ):
                issues["mystery_unexpected"].append(
                    {"name": name, "tone": row.get("tone"), "setting": row.get("setting")}
                )
        if re.search(r"\butsuge\b|vndb:utsuge|鬱ゲ|郁ゲ|郁系", blob) and row.get("tone") != "utsuge":
            issues["utsuge_missed"].append({"name": name, "tone": row.get("tone")})

        for k, allowed in (("tone", AXIS_TONES), ("setting", AXIS_SETTINGS), ("pace", AXIS_PACES)):
            val = row.get(k)
            if val and val not in allowed:
                issues["invalid_axis"].append({"name": name, "axis": k, "value": val})

    return issues


def audit_catalog(catalog_path: Path, rows: list[tuple[str, dict]]) -> dict[str, list]:
    issues: dict[str, list] = defaultdict(list)
    if not catalog_path.exists():
        return issues

    raw_by: dict[str, list[str]] = {}
    for _, row in rows:
        raw = row.get("raw_tags") or []
        if not raw:
            continue
        for key in (row.get("vndb_id"), row.get("name", "").casefold()):
            if key:
                raw_by[str(key)] = raw

    for g in json.loads(catalog_path.read_text(encoding="utf-8")):
        name = g.get("name") or "?"
        key = str(g.get("vndb_id") or name.casefold())
        raw = raw_by.get(key) or raw_by.get(name.casefold()) or []
        if not raw:
            if is_tagged({"tag_source": g.get("tag_source"), "raw_tags": []}) is False and g.get("tag_source") not in (None, "none", "heuristic"):
                pass
            continue
        if is_sweet_incompatible(raw):
            if g.get("tone") in ("sweet", "heal"):
                issues["catalog_sweet_dark"].append({"name": name})
            if g.get("mood") == "light":
                issues["catalog_light_dark"].append({"name": name})
            if g.get("focus") == "romance":
                issues["catalog_romance_dark"].append({"name": name})

    return issues


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    rows = load_rows()
    cov = audit_coverage(rows)
    issues = audit_consistency(rows)
    cat_issues = audit_catalog(CATALOG, rows)

    fail = 0
    print("=== gal-pick 全标签审计 ===\n")
    print(f"VNDB_MAP 条目: {len(VNDB_MAP)}  CN_MAP 条目: {len(CN_MAP)}  RAW_TRAIT_RULES: {len(RAW_TRAIT_RULES)}")
    print(f"原始记录: {len(rows)}  含 raw_tags: {sum(1 for _, r in rows if r.get('raw_tags'))}")
    print(f"标签命中次数: {cov['total_tag_hits']}  唯一标签名: {cov['unique_names']}")
    hit_rate = 100.0 * cov["axis_mapped_names"] / max(cov["unique_names"], 1)
    print(
        f"轴映射覆盖: {cov['axis_mapped_names']} 名 "
        f"({hit_rate:.1f}%) | trait 规则覆盖: {cov['trait_only_names']} 名 | 未映射: {cov['unmapped_names']} 名"
    )
    print("\n--- 高频未映射标签 (通常为元数据/角色属性，可不进轴) ---")
    for name, n in cov["axis_unmapped_top"][:20]:
        print(f"  {n:4d}  {name}")

    checks = [
        ("stored 与完整 derive 不一致", issues["stored_vs_full_derive"]),
        ("重口却 sweet/heal", issues["sweet_dark"]),
        ("重口 mood=light", issues["light_mood_dark"]),
        ("重口 focus=romance", issues["romance_focus_dark"]),
        ("有 tag_source 无 raw_tags", issues["no_raw_tags"]),
        ("Romance 标签 tone 异常", issues["romance_unexpected_tone"]),
        ("Mystery 标签未进 mystery/mindbend", issues["mystery_unexpected"]),
        ("Utsuge 标签未标 utsuge", issues["utsuge_missed"]),
        ("非法轴值", issues["invalid_axis"]),
        ("弱标签且无标题规则 (INFO)", issues["weak_tags_no_rule"]),
        ("catalog 重口 sweet", cat_issues["catalog_sweet_dark"]),
        ("catalog 重口 light", cat_issues["catalog_light_dark"]),
        ("catalog 重口 romance", cat_issues["catalog_romance_dark"]),
    ]

    print("\n--- 一致性检查 ---")
    for title, items in checks:
        n = len(items)
        is_info = "INFO" in title
        status = "OK" if n == 0 else ("INFO" if is_info else "FAIL")
        if n and not is_info:
            fail += n
        print(f"[{status}] {title}: {n}")
        for item in items[:5]:
            print(f"  - {item}")
        if n > 5:
            print(f"  ... +{n - 5} more")

    if fail:
        print(f"\nTOTAL ISSUES: {fail}")
        return 1
    print("\nALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
