# -*- coding: utf-8 -*-
"""Shared answer normalization + matching (mirrors js/gal-quiz.js)."""
from __future__ import annotations

import math
import re
import unicodedata

_STRIP_RE = re.compile(
    r"[\s\u3000"
    r"「」『』【】\[\]()（）\"'""''"
    r".,。，!！?？~～・·♥♡★☆†‡=＝:：;；/、\-—]"
)

# 字形归一（非错字互认）：繁简、异体字
_TYPO_PAIRS = (
    ("脫", "脱"),
    ("離", "离"),
    ("戀", "恋"),
)


def cjk_count(s: str) -> int:
    return sum(1 for ch in s if "\u4e00" <= ch <= "\u9fff")


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFKC", str(s or "")).lower()
    s = _STRIP_RE.sub("", s)
    return s.replace("ー", "").replace("〜", "")


def typo_expansions(s: str) -> list[str]:
    forms = [s]
    for a, b in _TYPO_PAIRS:
        if a in s:
            forms.append(s.replace(a, b))
        if b in s:
            forms.append(s.replace(b, a))
    out: list[str] = []
    for f in forms:
        if f and f not in out:
            out.append(f)
    return out


def answer_variants(raw: str) -> list[str]:
    full = normalize(raw)
    parts = [normalize(p) for p in re.split(r"[/／、]", str(raw or ""))]
    parts = [p for p in parts if p]
    out: list[str] = []
    for v in [full, *parts]:
        if not v:
            continue
        for vv in typo_expansions(v):
            if vv not in out:
                out.append(vv)
    return out


def _partial_match(u: str, v: str) -> bool:
    if u == v:
        return True
    if len(v) >= 4 and u.find(v) >= 0:
        return True
    if len(u) >= 4 and v.find(u) >= 0:
        # 中文作品昵称：≥3 个汉字且互为子串即认可（如「常轨脱离」⊂「常轨脱离creative」）
        if cjk_count(u) >= 3 and cjk_count(v) >= 3:
            return True
        if len(u) >= math.ceil(len(v) * 0.6):
            return True
    return False


def check_text(user: str, answers: list[str]) -> bool:
    u_forms = typo_expansions(normalize(user))
    if not u_forms or not u_forms[0]:
        return False
    for a in answers:
        for v in answer_variants(a):
            if not v:
                continue
            for u in u_forms:
                if _partial_match(u, v):
                    return True
    return False
