"""Heuristics: VNDB quote score 高 = 梗/迷言；名言 = 文学性台词。"""
from __future__ import annotations

import re

# VNDB 社区投票：高分多为梗句，名言通常 score 较低
MEME_MAX_SCORE = 35

MEME_RE = re.compile(
    r"(?i)(hitler|sonovabitch|man-sized spider|sexual intercourse|porn game|"
    r"normies|otaku and norm|tampon|anal\.|libido|masturb|titjob|uterus|"
    r"groped|vagina|penis|semen|breasts at the same|bananaa|muthafucka|dayumn|"
    r"airhead mean|children's card game|fucking hard|spaghetti|manju were born|"
    r"joystick in your pants|scroll of secret royal|pervy gentleman|"
    r"cranial pervert|yuri flags|brain in a vat of pure moe|sakura gapes|"
    r"confessions do immediately|holy grail has returned|sensei\.\.\. do you have|"
    r"secret royal titjobs|magical girl who came from alpha|weird, huh\? you, me|"
    r"people get kinder the more they sweat|on your period|grumpy\? oh, are you|"
    r"touch myself with the pen|reality my ass|didn't you get the memo\? the world we live in is a virtual|"
    r"beautiful women like you|pen i stole|doki doki literature club.*love you so much|"
    r"\bcock of a boy\b|better thick|first time\.\.\. those, of course)"
)

LITERARY_RE = re.compile(
    r"(?i)\b("
    r"life|world|heart|dream|future|past|memory|memories|hope|love|sorrow|pain|"
    r"freedom|truth|soul|light|dark|sky|stars?|rain|snow|wind|flowers?|"
    r"forever|never|always|because|remember|forget|protect|believe|wish|wishes|"
    r"destiny|fate|time|tomorrow|yesterday|live|die|death|alive|happiness|"
    r"sadness|lonely|alone|friend|promise|regret|mistake|failure|resolve|"
    r"meaning|reason|exist|end|beginning|everything|nothing|anyone|someone|"
    r"myself|yourself|world|miracle|eternity|goodbye|farewell|thank|sorry|"
    r"important|precious|beautiful|happy|sad|tears|smile|voice|silence"
    r")\b"
)

FIRST_PERSON_RE = re.compile(
    r"(?i)^(?:I|We|You|She|He|They|It) (?:don't|do not|cannot|can't|will|"
    r"want|wish|believe|think|know|feel|love|must|have|am|was|would|could|"
    r"should|need|hope|remember|forgot|never|always|still|just|can)"
)

# 知名偏文艺向作品（EN 标题小写 → 加分）
LITERARY_VN_HINTS: set[str] = {
    "clannad",
    "kanon",
    "air",
    "planetarian ~chiisana hoshi no yume~",
    "planetarian",
    "ever17 -the out of infinity-",
    "ever17",
    "remember11 -the age of infinity-",
    "narcissu",
    "katawa shoujo",
    "muv-luv alternative",
    "muv-luv",
    "fate/stay night",
    "fate/hollow ataraxia",
    "steins;gate",
    "the house in fata morgana",
    "fata morgana no yakata",
    "subarashiki hibi ~furenzoku sonzai~",
    "saya no uta",
    "tsukihime",
    "umineko no naku koro ni",
    "higurashi no naku koro ni",
    "white album 2",
    "white album2",
    "ef - a fairy tale of the two.",
    "ef - the first tale.",
    "sakura no uta",
    "sakura no toki",
    "the fruit of grisaia",
    "grisaia no kajitsu",
    "little busters!",
    "rewrite",
    "angel beats! -1st beat-",
    "narcissu side 2nd",
    "kimi ga nozomu eien",
    "aoishiro",
    "cross channel",
    "doki doki literature club!",
    "harmonia",
    "summer pockets",
    "baldr sky",
    "soukou akki muramasa",
    "daitoshokan no hitsujikai",
    "g-senjou no maou",
    "narcissu",
    "planetarian",
    "kimi to kanojo to kanojo no koi.",
    "kazoku keikaku",
    "family project",
    "narcissu",
}


def motto_quality(quote: str, vndb_score: int, vn_title: str = "") -> int | None:
    """返回名言质量分；None = 不是名言。"""
    text = (quote or "").strip()
    if len(text) < 45 or len(text) > 280:
        return None
    if MEME_RE.search(text):
        return None
    if vndb_score > MEME_MAX_SCORE:
        return None
    # 过短且无文学词
    lit_hits = LITERARY_RE.findall(text)
    if len(lit_hits) < 2 and len(text) < 70:
        return None

    score = len(lit_hits) * 4
    score += min(len(text) // 18, 10)
    if FIRST_PERSON_RE.search(text):
        score += 6
    if re.search(r'[.…"」』]$', text):
        score += 2
    if text.count("!") > 2:
        score -= 5
    if text.count("?") > 3:
        score -= 3
    if re.search(r"(?i)\b(lol|wtf|lmao|fuck|shit|damn)\b", text):
        score -= 8

    vn_key = (vn_title or "").strip().lower()
    if vn_key in LITERARY_VN_HINTS:
        score += 12
    elif any(h in vn_key for h in ("clannad", "ever17", "planetarian", "narcissu", "grisaia", "sakura no", "fata morgana", "muv-luv", "white album", "steins;gate", "fate/stay", "little busters", "rewrite", "harmonia", "summer pockets", "cross channel", "saya no uta", "tsukihime", "umineko", "higurashi", "ef -", "kanon", "air")):
        score += 8

    # 梗句 vote 常为负分；轻微加分
    if vndb_score < 0:
        score += 2

    if score < 12:
        return None
    return score


def is_motto(quote: str, vndb_score: int, vn_title: str = "") -> bool:
    return motto_quality(quote, vndb_score, vn_title) is not None
