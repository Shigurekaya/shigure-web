import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "b", Path(__file__).with_name("build_games_data.py")
)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

parsed = b.parse_departments(b.SRC.read_text(encoding="utf-8"))
lines = []
for year in ["2005", "2006", "2009", "2023"]:
    depts = parsed[year]
    built = set(b.build_year_list(depts))
    all_titles = []
    seen = set()
    for dept, titles in depts.items():
        if dept == "角色部门":
            continue
        for t in titles:
            if t not in seen:
                seen.add(t)
                all_titles.append((dept, t))
    missing = [(d, t) for d, t in all_titles if t not in built]
    lines.append(f"{year}: built={len(built)} available={len(all_titles)} depts={list(depts.keys())}")
    lines.append("missing:")
    for d, t in missing:
        lines.append(f"  [{d}] {t}")
    lines.append("")

Path(__file__).with_name("debug.txt").write_text("\n".join(lines), encoding="utf-8")
print("done")
