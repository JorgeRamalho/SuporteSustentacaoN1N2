"""Entrega de alerta. Em modo seguro, só grava no banco."""

from __future__ import annotations

import httpx
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AlertRecord
from app.timeutil import utcnow


def notify(db: Session, settings: Settings, message: str) -> AlertRecord:
    channel = "simulacao"
    destination = "console"
    if settings.slack_webhook_url:
        channel = "slack"
        destination = "webhook"
    elif settings.telegram_bot_token and settings.telegram_chat_id:
        channel = "telegram"
        destination = "chat"
    simulate = settings.simulate or channel == "simulacao"
    record = AlertRecord(
        channel=channel,
        destination=destination,
        message=message,
        simulate=simulate,
        status="registrado",
        created_at=utcnow(),
    )
    if not simulate and channel == "slack":
        _post(record, settings.slack_webhook_url, {"text": message})
    elif not simulate and channel == "telegram":
        url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
        _post(record, url, {"chat_id": settings.telegram_chat_id, "text": message})
    db.add(record)
    db.flush()
    return record


def _post(record: AlertRecord, url: str, payload: dict) -> None:
    try:
        response = httpx.post(url, json=payload, timeout=10)
        response.raise_for_status()
    except httpx.HTTPError:
        record.status = "falhou"
        record.simulate = False
        return
    record.status = "enviado"
    record.simulate = False
