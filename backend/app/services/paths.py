"""Limites de diretório. A API não passeia fora de data/."""

from __future__ import annotations

from pathlib import Path

from app.config import Settings
from app.errors import SentinelaError, UnsafePathError

_SYSTEM_PARTS = {"system32", "syswow64"}


def resolve_api_log_dir(raw: str | None, settings: Settings) -> Path:
    base = (settings.root / "data").resolve()
    if not raw:
        target = (base / "sample_logs").resolve()
    else:
        candidate = Path(raw)
        target = candidate.resolve() if candidate.is_absolute() else (base / candidate).resolve()
    try:
        target.relative_to(base)
    except ValueError as exc:
        raise UnsafePathError("A API só lê logs dentro da pasta data do laboratório.") from exc
    if not target.is_dir():
        raise SentinelaError("Diretório de log não encontrado dentro de data/.")
    return target


def resolve_cli_log_dir(raw: str | None, settings: Settings) -> Path:
    target = (settings.root / "data" / "sample_logs") if not raw else Path(raw)
    target = target.resolve()
    if target.parent == target:
        raise UnsafePathError("Recuso ler a raiz do sistema de arquivos.")
    if any(part.lower() in _SYSTEM_PARTS for part in target.parts):
        raise UnsafePathError("Recuso ler diretórios de sistema.")
    if not target.is_dir():
        raise SentinelaError(f"Diretório não encontrado: {target}")
    return target
