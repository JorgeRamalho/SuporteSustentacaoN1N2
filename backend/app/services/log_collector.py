"""Coleta linhas críticas e ignora o ruído de INFO/DEBUG."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import LogEvent
from app.services.signatures import signature_of
from app.timeutil import as_utc, parse_dt

KEEP_LEVELS = {"ERROR", "FATAL", "CRITICAL"}
LINE_RE = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})"
    r"(?P<tz>Z|[+-]\d{2}:?\d{2})?"
    r"\s+"
    r"(?P<level>DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)"
    r"\s+"
    r"(?:\[(?P<logger>[^\]]+)\]\s+)?"
    r"(?P<msg>.+)$",
    re.IGNORECASE,
)

LOGGER_SERVICE = {
    "db": "oracle-erp",
    "orders": "api-pedidos",
    "api": "api-pedidos",
    "billing": "faturamento",
    "payments": "gateway-pagamentos",
    "mail": "correio",
    "nginx": "portal-colaborador",
    "gateway": "portal-colaborador",
}


@dataclass(frozen=True)
class ParsedLog:
    logged_at: datetime
    level: str
    logger_name: str
    message: str
    signature: str
    service_name: str


def list_log_files(directory: Path, max_bytes: int = 5_000_000, limit: int = 200) -> list[Path]:
    found: list[Path] = []
    if not directory.exists():
        return found
    for path in sorted(directory.rglob("*")):
        if not path.is_file():
            continue
        name = path.name.lower()
        if path.suffix.lower() not in {".log", ".txt", ".out"} and "log" not in name:
            continue
        if path.stat().st_size > max_bytes:
            continue
        found.append(path)
        if len(found) >= limit:
            break
    return found


def _service_name(logger_name: str) -> str:
    return LOGGER_SERVICE.get(logger_name.lower(), logger_name.lower() or "nao-identificado")


def _interesting(level: str, message: str) -> bool:
    return level in KEEP_LEVELS or "exception" in message.lower()


def parse_log_text(text: str, now: datetime | None = None) -> list[ParsedLog]:
    events: list[ParsedLog] = []
    current: dict | None = None
    clock = as_utc(now) if now else as_utc(datetime.now().astimezone())

    def flush() -> None:
        nonlocal current
        if current is None:
            return
        message = str(current["message"]).strip()
        level = str(current["level"]).upper()
        if _interesting(level, message):
            if level not in KEEP_LEVELS:
                level = "ERROR"
            logger_name = str(current["logger"])
            events.append(
                ParsedLog(
                    logged_at=current["logged_at"],
                    level=level,
                    logger_name=logger_name,
                    message=message,
                    signature=signature_of(message),
                    service_name=_service_name(logger_name),
                )
            )
        current = None

    for raw in text.splitlines():
        if not raw.strip():
            continue
        match = LINE_RE.match(raw.strip())
        if match:
            flush()
            stamp = match.group("ts").replace(" ", "T")
            tz = match.group("tz") or ""
            if tz and len(tz) == 5 and tz[0] in "+-":
                tz = tz[:3] + ":" + tz[3:]
            current = {
                "logged_at": parse_dt(stamp + tz),
                "level": match.group("level"),
                "logger": match.group("logger") or "",
                "message": match.group("msg").strip(),
            }
            continue
        stripped = raw.strip()
        if current is not None and (
            raw.startswith((" ", "\t"))
            or stripped.startswith(("at ", "Caused by", "..."))
        ):
            current["message"] += "\n" + stripped
            continue
        upper = stripped.upper()
        if "EXCEPTION" in upper or re.search(r"\b(ERROR|FATAL|CRITICAL)\b", stripped):
            flush()
            level = "ERROR"
            if "FATAL" in upper:
                level = "FATAL"
            elif "CRITICAL" in upper:
                level = "CRITICAL"
            current = {
                "logged_at": clock,
                "level": level,
                "logger": "",
                "message": stripped,
            }
    flush()
    return events


def _digest(source: str, event: ParsedLog) -> str:
    raw = f"{source}|{event.logged_at.isoformat()}|{event.message}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]


def ingest_directory(db: Session, directory: Path) -> dict:
    files = list_log_files(directory)
    read_lines = 0
    kept = 0
    inserted = 0
    known = {row[0] for row in db.query(LogEvent.digest).all()}
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        read_lines += len(text.splitlines())
        try:
            source = str(path.relative_to(directory))
        except ValueError:
            source = path.name
        for event in parse_log_text(text):
            kept += 1
            digest = _digest(source, event)
            if digest in known:
                continue
            known.add(digest)
            db.add(
                LogEvent(
                    source=source,
                    logged_at=event.logged_at,
                    level=event.level,
                    logger_name=event.logger_name,
                    message=event.message,
                    signature=event.signature,
                    service_name=event.service_name,
                    digest=digest,
                )
            )
            inserted += 1
    db.flush()
    return {"files": len(files), "read_lines": read_lines, "kept": kept, "inserted": inserted}
