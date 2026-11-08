"""Associação do erro a um artigo e a um fornecedor por sobreposição de termos."""

from __future__ import annotations

import re
from collections.abc import Iterable

STOPWORDS = {
    "para",
    "com",
    "sem",
    "uma",
    "uns",
    "umas",
    "que",
    "dos",
    "das",
    "nos",
    "nas",
    "pelo",
    "pela",
    "como",
    "mais",
    "menos",
    "sobre",
    "depois",
    "antes",
    "quando",
    "where",
    "from",
    "with",
    "this",
    "that",
    "have",
    "after",
    "while",
}

_TOKEN = re.compile(r"[a-z0-9áàâãéêíóôõúç]{4,}")


def tokens(text: str) -> set[str]:
    return {word for word in _TOKEN.findall(text.lower()) if word not in STOPWORDS}


def match_vendor(text: str, vendors: Iterable):
    blob = text.lower()
    best = None
    best_score = 0
    for vendor in vendors:
        keys = [key.strip().lower() for key in vendor.keywords.split(",") if key.strip()]
        score = sum(1 for key in keys if key and key in blob)
        if score > best_score:
            best = vendor
            best_score = score
    return best


def best_article(text: str, articles: Iterable):
    wanted = tokens(text)
    best = None
    best_score = 1
    for article in articles:
        blob = " ".join([article.title, article.symptoms, article.cause, article.tags])
        score = len(wanted & tokens(blob))
        if score > best_score:
            best = article
            best_score = score
    return best
