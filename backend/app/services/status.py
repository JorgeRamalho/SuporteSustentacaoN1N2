"""Estado do serviço derivado dos incidentes ainda abertos."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Incident, MonitoredService
from app.timeutil import utcnow


def derive_status(name: str, incidents: list[Incident]) -> str:
    related = [item for item in incidents if item.service_name == name]
    if any(item.severity == "P1" for item in related):
        return "indisponivel"
    if any(item.severity == "P2" for item in related):
        return "degradado"
    if related:
        return "atencao"
    return "operacional"


def refresh_statuses(db: Session) -> None:
    open_items = db.query(Incident).filter(Incident.status != "resolvido").all()
    now = utcnow()
    for service in db.query(MonitoredService).all():
        service.status = derive_status(service.name, open_items)
        service.last_check = now
    db.flush()
