"""Painel: leitura agregada, sem efeito colateral."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AlertRecord, Incident, LogEvent, MonitoredService, Ticket
from app.services.host import read_host
from app.services.reports import to_view
from app.services.serialize import dump_alert, dump_incident, load_maps
from app.services.sla import build_sla
from app.services.status import derive_status
from app.timeutil import utcnow


def build_dashboard(db: Session, settings: Settings) -> dict:
    articles, vendors = load_maps(db)
    incidents = db.query(Incident).order_by(Incident.code.asc()).all()
    open_incidents = [item for item in incidents if item.status != "resolvido"]
    tickets = db.query(Ticket).all()
    sla = build_sla([to_view(item) for item in tickets], utcnow(), 7)
    host = read_host(settings.root)
    host["disk_threshold"] = settings.disk_threshold
    host["memory_threshold"] = settings.memory_threshold
    services = [
        {
            "name": service.name,
            "role": service.role,
            "owner_level": service.owner_level,
            "status": derive_status(service.name, open_incidents),
        }
        for service in db.query(MonitoredService).order_by(MonitoredService.name).all()
    ]
    alerts = db.query(AlertRecord).order_by(AlertRecord.created_at.desc()).limit(6).all()
    return {
        "kpis": {
            "open_incidents": len(open_incidents),
            "p1": sum(1 for item in open_incidents if item.severity == "P1"),
            "critical_logs": db.query(LogEvent).count(),
            "open_tickets": sum(1 for item in tickets if item.status != "fechado"),
            "sla_compliance": sla["compliance_percent"],
            "mttr_hours": sla["mttr_hours"],
        },
        "host": host,
        "services": services,
        "incidents": [dump_incident(item, articles, vendors) for item in incidents[-6:][::-1]],
        "alerts": [dump_alert(item) for item in alerts],
    }
