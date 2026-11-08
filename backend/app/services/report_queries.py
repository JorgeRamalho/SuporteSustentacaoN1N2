"""Consultas compartilhadas para exportação e pré-visualização de relatórios."""

from __future__ import annotations

from sqlalchemy.orm import Query, Session

from app.models import Incident, LogEvent, Ticket

LOG_LEVELS = {"ERROR", "FATAL", "CRITICAL"}
INCIDENT_LEVELS = {"N1", "N2"}
INCIDENT_SEVERITIES = {"P1", "P2", "P3"}
INCIDENT_STATUSES = {"aberto", "em_analise", "resolvido"}


def filter_logs(db: Session, level: str | None, service: str | None) -> Query:
    query = db.query(LogEvent).order_by(LogEvent.logged_at.desc())
    if level:
        normalized = level.upper()
        if normalized not in LOG_LEVELS:
            raise ValueError("Nível aceito: ERROR, FATAL ou CRITICAL.")
        query = query.filter(LogEvent.level == normalized)
    if service:
        query = query.filter(LogEvent.service_name == service.strip())
    return query


def filter_incidents(
    db: Session,
    queue: str | None,
    severity: str | None,
    status: str | None,
) -> Query:
    query = db.query(Incident).order_by(Incident.opened_at.desc())
    if queue:
        normalized = queue.upper()
        if normalized not in INCIDENT_LEVELS:
            raise ValueError("Fila aceita: N1 ou N2.")
        query = query.filter(Incident.level == normalized)
    if severity:
        normalized = severity.upper()
        if normalized not in INCIDENT_SEVERITIES:
            raise ValueError("Severidade aceita: P1, P2 ou P3.")
        query = query.filter(Incident.severity == normalized)
    if status:
        if status not in INCIDENT_STATUSES:
            raise ValueError("Status aceito: aberto, em_analise ou resolvido.")
        query = query.filter(Incident.status == status)
    return query


def report_filter_options(db: Session) -> dict:
    services = [
        row[0]
        for row in db.query(LogEvent.service_name).distinct().order_by(LogEvent.service_name).all()
        if row[0]
    ]
    providers = sorted({row.provider for row in db.query(Ticket).all() if row.provider})
    return {
        "log_levels": sorted(LOG_LEVELS),
        "log_services": services,
        "incident_queues": sorted(INCIDENT_LEVELS),
        "incident_severities": sorted(INCIDENT_SEVERITIES),
        "incident_statuses": sorted(INCIDENT_STATUSES),
        "ticket_providers": providers,
    }
