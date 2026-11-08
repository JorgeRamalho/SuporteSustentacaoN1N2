"""Saída CSV/JSON do coletor, pronta para o chamado."""

from __future__ import annotations

import csv
import io
import json

from app.timeutil import iso


def _cell(value: str) -> str:
    text = value.replace("\r", " ").replace("\n", " | ")
    if text.startswith(("=", "+", "-", "@")):
        return "'" + text
    return text


def logs_csv(rows: list) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["logged_at", "level", "service_name", "source", "signature", "message"])
    for row in rows:
        writer.writerow(
            [
                iso(row.logged_at) or "",
                row.level,
                row.service_name,
                row.source,
                row.signature,
                _cell(row.message),
            ]
        )
    return "\ufeff" + buffer.getvalue()


def logs_json(rows: list) -> str:
    payload = [
        {
            "logged_at": iso(row.logged_at),
            "level": row.level,
            "service_name": row.service_name,
            "source": row.source,
            "signature": row.signature,
            "message": row.message,
        }
        for row in rows
    ]
    return json.dumps(payload, ensure_ascii=False, indent=2)


def incidents_csv(rows: list) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(
        ["code", "title", "severity", "status", "level", "service_name", "opened_at", "summary", "signature"]
    )
    for row in rows:
        writer.writerow(
            [
                row.code,
                _cell(row.title),
                row.severity,
                row.status,
                row.level,
                row.service_name,
                iso(row.opened_at) or "",
                _cell(row.summary),
                row.signature,
            ]
        )
    return "\ufeff" + buffer.getvalue()


def incidents_json(rows: list) -> str:
    payload = [
        {
            "code": row.code,
            "title": row.title,
            "severity": row.severity,
            "status": row.status,
            "level": row.level,
            "service_name": row.service_name,
            "opened_at": iso(row.opened_at),
            "summary": row.summary,
            "signature": row.signature,
        }
        for row in rows
    ]
    return json.dumps(payload, ensure_ascii=False, indent=2)
