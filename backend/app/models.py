"""Tabelas da operação: catálogo, evidência, incidente e chamado."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.timeutil import utcnow


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    product: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(40))
    contract_sla_hours: Mapped[int] = mapped_column(Integer)
    escalation_contact: Mapped[str] = mapped_column(String(160))
    keywords: Mapped[str] = mapped_column(String(300))
    notes: Mapped[str] = mapped_column(Text, default="")


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(180))
    symptoms: Mapped[str] = mapped_column(Text)
    cause: Mapped[str] = mapped_column(Text)
    resolution: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(4))
    tags: Mapped[str] = mapped_column(String(300), default="")
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"))


class MonitoredService(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    role: Mapped[str] = mapped_column(String(160))
    owner_level: Mapped[str] = mapped_column(String(4))
    status: Mapped[str] = mapped_column(String(32), default="operacional")
    last_check: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LogEvent(Base):
    __tablename__ = "log_events"
    __table_args__ = (UniqueConstraint("digest", name="uq_log_digest"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(240))
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    level: Mapped[str] = mapped_column(String(16), index=True)
    logger_name: Mapped[str] = mapped_column(String(80), default="")
    message: Mapped[str] = mapped_column(Text)
    signature: Mapped[str] = mapped_column(String(180), index=True)
    service_name: Mapped[str] = mapped_column(String(80), index=True)
    digest: Mapped[str] = mapped_column(String(40))


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    title: Mapped[str] = mapped_column(String(180))
    severity: Mapped[str] = mapped_column(String(4), index=True)
    status: Mapped[str] = mapped_column(String(20), index=True, default="aberto")
    level: Mapped[str] = mapped_column(String(4))
    service_name: Mapped[str] = mapped_column(String(80), index=True)
    signature: Mapped[str] = mapped_column(String(180), index=True)
    summary: Mapped[str] = mapped_column(Text)
    evidence_count: Mapped[int] = mapped_column(Integer, default=1)
    kb_article_id: Mapped[int | None] = mapped_column(ForeignKey("knowledge_articles.id"))
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str] = mapped_column(String(40), unique=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), index=True)
    priority: Mapped[str] = mapped_column(String(20))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sla_hours: Mapped[int] = mapped_column(Integer)
    queue: Mapped[str] = mapped_column(String(80), default="")


class AutomationRun(Base):
    __tablename__ = "automation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(40))
    target: Mapped[str] = mapped_column(String(240))
    simulate: Mapped[bool] = mapped_column(default=True)
    status: Mapped[str] = mapped_column(String(32))
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class AlertRecord(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel: Mapped[str] = mapped_column(String(32))
    destination: Mapped[str] = mapped_column(String(160))
    message: Mapped[str] = mapped_column(Text)
    simulate: Mapped[bool] = mapped_column(default=True)
    status: Mapped[str] = mapped_column(String(20), default="registrado")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(4), default="N1")
    sector: Mapped[str] = mapped_column(String(32), default="Suporte")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
