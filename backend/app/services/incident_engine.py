"""Abre incidente quando a evidência deixa de ser ruído isolado."""

from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.models import Incident, KnowledgeArticle, LogEvent, Vendor
from app.services.matching import best_article, match_vendor
from app.services.signatures import signature_of
from app.services.status import refresh_statuses
from app.timeutil import as_utc, utcnow

MANUAL_SEVERITY = {
    "critico": ("P1", "N2"),
    "alto": ("P2", "N2"),
    "medio": ("P3", "N2"),
    "baixo": ("P3", "N1"),
    "alta": ("P1", "N2"),
    "media": ("P2", "N2"),
    "baixa": ("P3", "N1"),
}

P2_TOKENS = ("deadlock", "timeout", "certificate", "expired", "sslhandshake")
P1_TOKENS = ("no space left", "outofmemory", "out of memory")


def classify(levels: set[str], count: int, message: str) -> str:
    text = message.lower()
    if levels & {"FATAL", "CRITICAL"} or any(token in text for token in P1_TOKENS):
        return "P1"
    if count >= 3 or any(token in text for token in P2_TOKENS):
        return "P2"
    return "P3"


def queue_level(severity: str, article) -> str:
    if severity in {"P1", "P2"}:
        return "N2"
    if article is not None:
        return "N1"
    return "N2"


def _should_open(levels: set[str], count: int, message: str) -> bool:
    text = message.lower()
    if levels & {"FATAL", "CRITICAL"}:
        return True
    if count >= 2:
        return True
    triggers = ("exception", "deadlock", "no space left", "expired", "queue frozen", "timeout")
    return any(token in text for token in triggers)


def _next_number(db: Session) -> int:
    year = utcnow().year
    prefix = f"INC-{year}-"
    codes = [row[0] for row in db.query(Incident.code).filter(Incident.code.like(f"{prefix}%")).all()]
    highest = 0
    for code in codes:
        try:
            highest = max(highest, int(code.rsplit("-", 1)[-1]))
        except ValueError:
            continue
    return highest + 1


def register_incident(db: Session, title: str, symptom: str, severity_label: str) -> Incident:
    severity, level = MANUAL_SEVERITY[severity_label]
    blob = f"{title}\n{symptom}"
    articles = db.query(KnowledgeArticle).all()
    vendors = db.query(Vendor).all()
    article = best_article(blob, articles)
    vendor = match_vendor(blob, vendors)
    year = utcnow().year
    incident = Incident(
        code=f"INC-{year}-{_next_number(db):04d}",
        title=title[:180],
        severity=severity,
        status="aberto",
        level=level,
        service_name="registro-n1",
        signature=f"registro manual {signature_of(symptom)}"[:180],
        summary=f"{symptom} Registro manual do N1, severidade {severity_label}. Fila recomendada: {level}.",
        evidence_count=1,
        kb_article_id=None if article is None else article.id,
        vendor_id=None if vendor is None else vendor.id,
        opened_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(incident)
    db.flush()
    refresh_statuses(db)
    return incident


def detect_incidents(db: Session) -> list[Incident]:
    grouped: dict[str, list[LogEvent]] = {}
    for event in db.query(LogEvent).all():
        grouped.setdefault(event.signature, []).append(event)
    open_signatures = {
        row[0]
        for row in db.query(Incident.signature).filter(Incident.status != "resolvido").all()
    }
    articles = db.query(KnowledgeArticle).all()
    vendors = db.query(Vendor).all()
    created: list[Incident] = []
    number = _next_number(db)
    year = utcnow().year
    for signature in sorted(grouped):
        if signature in open_signatures:
            continue
        items = grouped[signature]
        levels = {item.level for item in items}
        latest = max(items, key=lambda item: as_utc(item.logged_at))
        blob = "\n".join(item.message for item in items)
        if not _should_open(levels, len(items), blob):
            continue
        article = best_article(blob + " " + latest.service_name, articles)
        vendor = match_vendor(f"{blob} {latest.service_name}", vendors)
        severity = classify(levels, len(items), blob)
        level = queue_level(severity, article)
        service_name = Counter(item.service_name for item in items).most_common(1)[0][0]
        opened = as_utc(latest.logged_at)
        incident = Incident(
            code=f"INC-{year}-{number:04d}",
            title=latest.message.splitlines()[0].strip()[:180],
            severity=severity,
            status="aberto",
            level=level,
            service_name=service_name,
            signature=signature,
            summary=(
                f"{len(items)} {'ocorrência' if len(items) == 1 else 'ocorrências'} "
                f"com a mesma assinatura em {service_name}. Fila recomendada: {level}."
            ),
            evidence_count=len(items),
            kb_article_id=None if article is None else article.id,
            vendor_id=None if vendor is None else vendor.id,
            opened_at=opened,
            updated_at=utcnow(),
        )
        db.add(incident)
        created.append(incident)
        number += 1
    db.flush()
    refresh_statuses(db)
    return created
