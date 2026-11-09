"""Liberação por função (N1–N3) no console e na API."""

from __future__ import annotations

from fastapi import Depends, HTTPException

from app.models import User
from app.services.auth import require_user

ROLE_RANK = {"N1": 1, "N2": 2, "N3": 3}

_N1_SECTIONS = frozenset({"chamados", "incidentes"})
_N2_SECTIONS = frozenset(
    {
        "painel",
        "logs",
        "registro-n1",
        "conhecimento",
        "fornecedores",
        "automacao",
    }
)
_N3_SECTIONS = frozenset({"relatorios", "conteudo"})


def normalize_role(role: str | None) -> str:
    text = (role or "N1").strip().upper()
    if text in {"N4", "N5"}:
        return "N3"
    return text if text in ROLE_RANK else "N1"


def role_rank(role: str | None) -> int:
    return ROLE_RANK[normalize_role(role)]


def sections_for(role: str | None) -> frozenset[str]:
    rank = role_rank(role)
    allowed = set(_N1_SECTIONS)
    if rank >= 2:
        allowed |= _N2_SECTIONS
    if rank >= 3:
        allowed |= _N3_SECTIONS
    return frozenset(allowed)


def require_min_role(minimum: str):
    floor = normalize_role(minimum)

    def dep(user: User = Depends(require_user)) -> User:
        if role_rank(user.role) < ROLE_RANK[floor]:
            raise HTTPException(
                status_code=403,
                detail=f"A função {user.role} não libera esta operação. É necessário {floor} ou superior.",
            )
        return user

    return dep


def require_operational_console(user: User = Depends(require_user)) -> User:
    """N1 só opera chamados e incidentes; o restante do console exige N2+."""
    if role_rank(user.role) < 2:
        raise HTTPException(
            status_code=403,
            detail="A função N1 libera apenas chamados e incidentes.",
        )
    return user
