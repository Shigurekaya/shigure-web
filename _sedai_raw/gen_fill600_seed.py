#!/usr/bin/env python3
"""生成 pick_popular_seed_fill600.json：未收录的主流人气作。"""
from __future__ import annotations

import json
from pathlib import Path

from pick_pool_dedupe import filter_new_candidates, pool_id_sets, sedai_pool_ids

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "pick_popular_seed_fill600.json"

SEEDS: list[tuple[str, int, int]] = [
    ("NOeSIS ~Uso o Tsuita Kioku no Monogatari~", 2011, 1),
    ("NOeSIS02 -Uka-", 2012, 1),
    ("Mahoutsukai no Yoru", 2012, 2),
    ("Dies irae ~Acta est Fabula~", 2009, 1),
    ("Dies irae Also sprach Zarathustra", 2007, 2),
    ("Subarashiki Hibi ~Furenzoku Sonzai~", 2018, 1),
    ("Sakura no Toki -Sakura no Mori no Ue o Mau-", 2015, 1),
    ("Sakura no Uta -Yumi o Sakasaba ni-", 2014, 1),
    ("Sakura no Shima", 2015, 2),
    ("Fate/hollow ataraxia", 2005, 1),
    ("Muv-Luv", 2003, 1),
    ("Higurashi no Naku Koro ni Kai", 2007, 1),
    ("Higurashi no Naku Koro ni", 2004, 1),
    ("Chaos;Child", 2014, 1),
    ("Robotics;Notes", 2011, 2),
    ("Robotics;Notes Elite", 2010, 2),
    ("Himawari -The Sunflower-", 2006, 2),
    ("Swan Song", 2006, 3),
    ("Kara no Shoujo", 2008, 2),
    ("Kara no Shoujo 2", 2012, 3),
    ("Baldr Sky Dive2 \"Recordare\"", 2010, 3),
    ("Baldr Sky DiveX \"Dream World\"", 2011, 3),
    ("WHITE ALBUM", 2005, 2),
    ("D.C. II ~Da Capo II~", 2006, 2),
    ("D.C. III ~Da Capo III~", 2012, 4),
    ("Hoshizora e Kakaru Hashi", 2008, 4),
    ("Ichiban Ushiro no Daimaou", 2010, 4),
    ("Princess Evangile", 2011, 4),
    ("Maji de Watashi ni Koi Shinasai!", 2011, 5),
    ("Grisaia no Meikyuu", 2011, 6),
    ("Grisaia no Rakuen", 2013, 6),
    ("Grisaia: Phantom Trigger Vol.1", 2014, 6),
    ("Nekopara Vol.2", 2014, 7),
    ("Nekopara Vol.3", 2015, 7),
    ("Nekopara Vol.4", 2020, 2),
    ("Angel Beats! -1st beat-", 2015, 8),
    ("Planetarian ~Chiisana Hoshi no Yume~", 2016, 8),
    ("Tomoyo After ~It's a Wonderful Life~", 2005, 3),
    ("Kud Wafter", 2010, 5),
    ("Anonymous;Code", 2019, 8),
    ("Root Letter", 2016, 9),
    ("The House in Fata Morgana", 2012, 5),
    ("Sharin no Kuni, Himawari no Shoujo", 2008, 5),
    ("Sekien no Inganock -What a Beautiful People-", 2008, 6),
    ("Shikkoku no Sharnoth ~What a beautiful tomorrow~", 2008, 7),
    ("Cross Channel", 2009, 3),
    ("Cartagra -Satsujin Kinen-", 2005, 4),
    ("Kikokugai", 2006, 4),
    ("Jingai Makyou", 2007, 4),
    ("Yume Miru Kusuri", 2002, 3),
    ("Wind -a breath of heart-", 2003, 3),
    ("Shuffle! Essence+", 2007, 5),
    ("ToHeart", 2005, 5),
    ("Edelweiss Eiden Fantasia", 2010, 6),
    ("Edelweiss", 2009, 4),
    ("Hatsuyuki Sakura -White Graduation-", 2012, 6),
    ("Amairo Chocolate", 2016, 10),
    ("Amairo Chocolate 2", 2017, 8),
    ("Primal Hearts", 2015, 9),
    ("Primal Hearts 2", 2015, 10),
    ("Wagamama High Spec", 2016, 11),
    ("Wagamama High Spec 2", 2017, 11),
    ("9-nine- Episode2", 2016, 12),
    ("9-nine- Episode3", 2017, 10),
    ("9-nine- Episode4", 2018, 11),
    ("Summer Pockets REFLECTION BLUE", 2021, 5),
    ("Tenshi Souzou RE-BOOT!", 2023, 1),
    ("Amane Switch", 2022, 4),
    ("Kin'iro Loveriche", 2021, 8),
    ("Kin'iro Loveriche -Golden Time-", 2021, 9),
    ("Hoshi Ori Yume Mirai", 2020, 8),
    ("Tsuki no Kanata de Aimashou", 2019, 13),
    ("Dracu-Riot!", 2018, 13),
    ("Hoshizora no Memoria -Wish of a Star-", 2016, 14),
    ("Koi ga Saku Koro Sakura Doki", 2013, 8),
    ("Ao no Kanata no Four Rhythm EXTRA1", 2014, 11),
    ("Ao no Kanata no Four Rhythm EXTRA2", 2017, 13),
    ("Karakara2", 2019, 14),
    ("Hapymaher -Fragments-", 2021, 7),
    ("Mama x Holic", 2020, 5),
    ("Amakano 2", 2018, 10),
    ("Amakano 3", 2021, 6),
    ("Tropical Liquor", 2017, 14),
    ("Tricolour Lovestory", 2016, 15),
    ("Rewrite Harvest festa!", 2011, 7),
    ("Hoshizora no Memoria", 2010, 7),
    ("12Riven -the Ψcliminal of integral-", 2009, 5),
    ("Root Double -Before Crime * After Days-", 2009, 6),
    ("Akatsuki no Goei", 2008, 8),
    ("Akatsuki no Goei Trinity", 2010, 8),
    ("A Clockwork Ley-Line -Daybreak of Remnants Shadow-", 2017, 15),
    ("AstralAir no Shiroki Towa", 2014, 9),
    ("Clover Day's", 2014, 10),
    ("If My Heart Had Wings", 2012, 8),
    ("Hanachirasu", 2004, 5),
    ("Koi to Senkyo to Chocolate", 2011, 8),
    ("Koiiro Soramoyou", 2013, 9),
    ("Saku Saku", 2014, 8),
    ("Karakara", 2016, 16),
    ("Hatsukoi 1/1", 2015, 11),
    ("Chrono Clock", 2014, 9),
    ("Fureraba ~Friend to Lover~", 2013, 8),
    ("Hapymaher", 2020, 6),
    ("Making*Lovers", 2018, 10),
    ("Renai, Karichaimashita", 2019, 10),
    ("Maitetsu Last Run!!", 2022, 3),
    ("Aokana -Four Rhythm Across the Blue-", 2016, 8),
    ("Muv-Luv Alternative Chronicles", 2013, 3),
    ("Muv-Luv Alternative Chronicles Resonance", 2014, 4),
    ("Muv-Luv Alternative Chronicles Axiom", 2014, 5),
    ("Muv-Luv Alternative Chronicles Hydra", 2014, 6),
    ("Muv-Luv Alternative Chronicles Phoenix", 2014, 7),
    ("Muv-Luv Alternative Chronicles Adoration", 2014, 8),
    ("Muv-Luv Alternative Chronicles Rain Dancers", 2014, 9),
    ("True Remembrance", 2007, 6),
    ("Narcissu", 2005, 6),
    ("Narcissu Side 2nd", 2007, 7),
    ("Planetarian ~Chiisana Hoshi no Yume~", 2016, 8),
    ("Himawari no Kiseki", 2018, 5),
    ("Himawari", 2004, 4),
    ("Himawari!!", 2006, 5),
    ("Himawari!! -Anata Dake o Mitsumeteru-", 2006, 6),
    ("Himawari!! -Anata Dake o Mitsumeteru- Kai", 2007, 6),
    ("Himawari!! -Anata Dake o Mitsumeteru- Kai Extra", 2007, 7),
    ("Himawari!! -Anata Dake o Mitsumeteru- Kai Extra 2", 2007, 8),
]


def main() -> None:
    pv, pb, pn = sedai_pool_ids()
    supp = ROOT / "pick_supplement_tags.json"
    if supp.exists():
        sv, sb, sn = pool_id_sets(json.loads(supp.read_text(encoding="utf-8")))
        pv |= sv
        pb |= sb
        pn |= sn

    seen: set[str] = set()
    items: list[tuple[int, int, str]] = []
    for name, year, rank in SEEDS:
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        items.append((year, rank, name))

    new = filter_new_candidates(items, pv, pb, pn)
    out = [{"year": y, "rank": r, "name": n} for y, r, n in new]
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT.name}: {len(out)} candidates")
    for row in out[:25]:
        print(f"  {row['name']}")


if __name__ == "__main__":
    main()
