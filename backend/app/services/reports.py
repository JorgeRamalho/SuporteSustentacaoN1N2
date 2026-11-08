"""Grava chamados e monta o relatório semanal."""

from __future__ import annotations

import json
import smtplib
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app.config import Settings
from app.errors import SentinelaError
from app.models import Ticket
from app.services.providers import TicketDraft, fetch_all
from app.services.sla import TicketView, build_sla
from app.services.notifiers import notify
from app.timeutil import as_utc, utcnow


def to_view(row: Ticket) -> TicketView:
    opened = as_utc(row.opened_at)
    if opened is None:
        raise SentinelaError("Chamado sem data de abertura.")
    return TicketView(
        provider=row.provider,
        status=row.status,
        priority=row.priority,
        opened_at=opened,
        first_response_at=as_utc(row.first_response_at),
        closed_at=as_utc(row.closed_at),
        sla_hours=row.sla_hours,
    )


def upsert_tickets(db: Session, drafts: list[TicketDraft]) -> int:
    for draft in drafts:
        row = db.query(Ticket).filter(Ticket.external_id == draft.external_id).one_or_none()
        if row is None:
            row = Ticket(external_id=draft.external_id)
            db.add(row)
        row.provider = draft.provider
        row.title = draft.title
        row.status = draft.status
        row.priority = draft.priority
        row.opened_at = draft.opened_at
        row.first_response_at = draft.first_response_at
        row.closed_at = draft.closed_at
        row.sla_hours = draft.sla_hours
        row.queue = draft.queue
    db.flush()
    return len(drafts)


def sync_tickets(db: Session, settings: Settings) -> int:
    return upsert_tickets(db, fetch_all(settings))


def render_report(metrics: dict) -> str:
    lines = [
        "SENTINELA · Relatório semanal de chamados",
        f"Gerado em: {metrics['generated_at']}",
        f"Janela: últimos {metrics['window_days']} dias",
    ]
    if metrics.get("provider_filter"):
        lines.append(f"Ferramenta: {metrics['provider_filter']}")
    lines.extend(
        [
        "",
        f"Abertos no período: {metrics['opened']}",
        f"Fechados no período: {metrics['closed']}",
        f"Backlog atual: {metrics['backlog']}",
        f"Tempo médio de atendimento (MTTR): {metrics['mttr_hours']} h",
        f"Tempo médio de primeira resposta: {metrics['avg_first_response_hours']} h",
        f"Conformidade de SLA: {metrics['compliance_percent']}%",
        f"Chamados fora do SLA: {metrics['breached']}",
        "",
        "Por ferramenta:",
        ]
    )
    for row in metrics["by_provider"]:
        lines.append(
            f"- {row['provider']}: abertos {row['opened']}, fechados {row['closed']}, "
            f"conformidade {row['compliance_percent']}%"
        )
    lines.extend(
        [
            "",
            "Uso interno da sustentação. Conferir o chamado antes de acionar fornecedor.",
            "",
        ]
    )
    return "\n".join(lines)


def send_email(settings: Settings, body: str) -> bool:
    if settings.simulate or not settings.smtp_host:
        return False
    message = EmailMessage()
    message["Subject"] = "Sentinela · relatório semanal de SLA"
    message["From"] = settings.smtp_from
    message["To"] = settings.report_email_to
    message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
    return True


def collect_metrics(db: Session, days: int, provider: str | None = None) -> dict:
    now = utcnow()
    rows = db.query(Ticket).all()
    if provider:
        rows = [row for row in rows if row.provider == provider]
    metrics = build_sla([to_view(row) for row in rows], now, days)
    metrics["generated_at"] = now.astimezone().strftime("%d/%m/%Y %H:%M")
    if provider:
        metrics["provider_filter"] = provider
    return metrics


def weekly_report(db: Session, settings: Settings, days: int = 7, provider: str | None = None) -> dict:
    metrics = collect_metrics(db, days, provider)
    body = render_report(metrics)
    folder = settings.root / "data" / "reports"
    folder.mkdir(parents=True, exist_ok=True)
    stamp = utcnow().strftime("%Y%m%d-%H%M%S")
    path = folder / f"sla-{stamp}.txt"
    json_path = folder / f"sla-{stamp}.json"
    path.write_text(body, encoding="utf-8")
    json_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    delivered = False
    try:
        delivered = send_email(settings, body)
    except Exception as exc:
        raise SentinelaError("Falha ao entregar o e-mail. O arquivo ficou salvo no laboratório.") from exc
    prefix = "[SENTINELA][SIMULADO]" if not delivered else "[SENTINELA]"
    notify(
        db,
        settings,
        f"{prefix} Relatório semanal de SLA para {settings.report_email_to}. Arquivo {path.name}.",
    )
    db.commit()
    return {
        "preview": body,
        "simulate": not delivered,
        "delivered": delivered,
        "files": {"txt": path.name, "json": json_path.name},
        "metrics": metrics,
    }
