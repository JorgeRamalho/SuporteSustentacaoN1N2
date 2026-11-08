"""Assinatura estável: o mesmo erro com outro id não vira outro incidente."""

from __future__ import annotations

import re

_DIGITS = re.compile(r"\d+")
_NOISE = re.compile(r"[^a-z0-9#áàâãéêíóôõúç]+")


def signature_of(message: str) -> str:
    first = message.splitlines()[0].lower()
    cleaned = _DIGITS.sub("#", first)
    cleaned = _NOISE.sub(" ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:180]
