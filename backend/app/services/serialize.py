"""Forma de incidente, artigo e fornecedor para a API."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import KnowledgeArticle, Vendor
from app.timeutil import iso


def load_maps(db: Session) -> tuple[dict, dict]:
    articles = {item.id: item for item in db.query(KnowledgeArticle).all()}
    vendors = {item.id: item for item in db.query(Vendor).all()}
    return articles, vendors


def dump_log(row) -> dict:
    return {
        "id": row.id,
        "source": row.source,
        "logged_at": iso(row.logged_at),
        "level": row.level,
        "logger_name": row.logger_name,
        "service_name": row.service_name,
        "signature": row.signature,
        "message": row.message,
    }


def dump_incident(row, articles: dict, vendors: dict) -> dict:
    article = articles.get(row.kb_article_id)
    vendor = vendors.get(row.vendor_id)
    return {
        "id": row.id,
        "code": row.code,
        "title": row.title,
        "severity": row.severity,
        "status": row.status,
        "level": row.level,
        "service_name": row.service_name,
        "signature": row.signature,
        "summary": row.summary,
        "evidence_count": row.evidence_count,
        "opened_at": iso(row.opened_at),
        "updated_at": iso(row.updated_at),
        "article": None
        if article is None
        else {
            "id": article.id,
            "title": article.title,
            "level": article.level,
            "cause": article.cause,
            "resolution": article.resolution,
        },
        "vendor": None
        if vendor is None
        else {
            "id": vendor.id,
            "name": vendor.name,
            "product": vendor.product,
            "escalation_contact": vendor.escalation_contact,
            "contract_sla_hours": vendor.contract_sla_hours,
        },
    }


def dump_article(row, vendors: dict) -> dict:
    vendor = vendors.get(row.vendor_id)
    return {
        "id": row.id,
        "title": row.title,
        "symptoms": row.symptoms,
        "cause": row.cause,
        "resolution": row.resolution,
        "level": row.level,
        "tags": row.tags,
        "vendor": None if vendor is None else vendor.name,
    }


def dump_vendor(row) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "product": row.product,
        "category": row.category,
        "contract_sla_hours": row.contract_sla_hours,
        "escalation_contact": row.escalation_contact,
        "keywords": row.keywords,
        "notes": row.notes,
    }


def dump_ticket(row) -> dict:
    return {
        "id": row.id,
        "external_id": row.external_id,
        "provider": row.provider,
        "title": row.title,
        "status": row.status,
        "priority": row.priority,
        "queue": row.queue,
        "sla_hours": row.sla_hours,
        "opened_at": iso(row.opened_at),
        "first_response_at": iso(row.first_response_at),
        "closed_at": iso(row.closed_at),
    }


def dump_run(row) -> dict:
    return {
        "id": row.id,
        "kind": row.kind,
        "target": row.target,
        "simulate": row.simulate,
        "status": row.status,
        "detail": row.detail,
        "created_at": iso(row.created_at),
    }


def dump_alert(row) -> dict:
    return {
        "id": row.id,
        "channel": row.channel,
        "message": row.message,
        "simulate": row.simulate,
        "status": row.status,
        "created_at": iso(row.created_at),
    }
