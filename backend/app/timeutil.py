"""Datas em UTC para não misturar o fuso do servidor com o do chamado."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from app.errors import ProviderError


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def iso(value: datetime | None) -> str | None:
    aware = as_utc(value)
    if aware is None:
        return None
    return aware.isoformat()


def parse_dt(value: str | None) -> datetime | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = text.replace("Z", "+00:00")
    text = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", text)
    text = re.sub(r"\.(\d{6})\d+", r".\1", text)
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise ProviderError("Data inválida no retorno da ferramenta de chamados.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
