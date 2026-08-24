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


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFKC", str(s or "")).lower()
    s = _STRIP_RE.sub("", s)
    return s.replace("ー", "").replace("〜", "")


def answer_variants(raw: str) -> list[str]:
    full = normalize(raw)
    parts = [normalize(p) for p in re.split(r"[/／、]", str(raw or ""))]
    parts = [p for p in parts if p]
    out: list[str] = []
    for v in [full, *parts]:
        if v and v not in out:
            out.append(v)
    return out


def check_text(user: str, answers: list[str]) -> bool:
    u = normalize(user)
    if not u:
        return False
    for a in answers:
        for v in answer_variants(a):
            if not v:
                continue
            if u == v:
                return True
            if len(v) >= 4 and u.find(v) >= 0:
                return True
            if (
                len(u) >= 4
                and len(v) >= 4
                and v.find(u) >= 0
                and len(u) >= math.ceil(len(v) * 0.6)
            ):
                return True
    return False
