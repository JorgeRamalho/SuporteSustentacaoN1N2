"""Conta de SLA: atendimento, primeira resposta e conformidade."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from app.timeutil import as_utc


@dataclass
class TicketView:
    provider: str
    status: str
    priority: str
    opened_at: datetime
    first_response_at: datetime | None
    closed_at: datetime | None
    sla_hours: int


def _hours(start: datetime, end: datetime) -> float:
    return max((end - start).total_seconds() / 3600, 0)


def _avg(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 1)


def _normalize(ticket: TicketView) -> TicketView:
    opened = as_utc(ticket.opened_at)
    if opened is None:
        raise ValueError("Chamado sem data de abertura.")
    return TicketView(
        provider=ticket.provider,
        status=ticket.status,
        priority=ticket.priority,
        opened_at=opened,
        first_response_at=as_utc(ticket.first_response_at),
        closed_at=as_utc(ticket.closed_at),
        sla_hours=int(ticket.sla_hours),
    )


def is_breached(ticket: TicketView, now: datetime) -> bool:
    end = ticket.closed_at or now
    return _hours(ticket.opened_at, end) > ticket.sla_hours


def _slice(tickets: list[TicketView], start: datetime, now: datetime) -> dict:
    opened = [item for item in tickets if item.opened_at >= start]
    closed = [item for item in tickets if item.closed_at is not None and item.closed_at >= start]
    backlog = [item for item in tickets if item.status != "fechado"]
    considered = [item for item in tickets if item.opened_at >= start or item.status != "fechado"]
    breached = [item for item in considered if is_breached(item, now)]
    compliance = 0.0
    if considered:
        compliance = round((1 - len(breached) / len(considered)) * 100, 1)
    durations = [
        _hours(item.opened_at, item.closed_at)
        for item in closed
        if item.closed_at is not None
    ]
    responses = [
        _hours(item.opened_at, item.first_response_at)
        for item in opened
        if item.first_response_at is not None
    ]
    return {
        "opened": len(opened),
        "closed": len(closed),
        "backlog": len(backlog),
        "considered": len(considered),
        "breached": len(breached),
        "compliance_percent": compliance,
        "mttr_hours": _avg(durations),
        "avg_first_response_hours": _avg(responses),
    }


def build_sla(tickets: list[TicketView], now: datetime, window_days: int = 7) -> dict:
    current = as_utc(now)
    if current is None:
        raise ValueError("Relógio inválido.")
    start = current - timedelta(days=window_days)
    normalized = [_normalize(ticket) for ticket in tickets]
    overall = _slice(normalized, start, current)
    providers = []
    for name in sorted({item.provider for item in normalized}):
        subset = _slice([item for item in normalized if item.provider == name], start, current)
        providers.append(
            {
                "provider": name,
                "opened": subset["opened"],
                "closed": subset["closed"],
                "backlog": subset["backlog"],
                "breached": subset["breached"],
                "compliance_percent": subset["compliance_percent"],
            }
        )
    overall["window_days"] = window_days
    overall["by_provider"] = providers
    return overall
