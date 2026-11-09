"""Cliente de API com banco e logs isolados."""

from __future__ import annotations

from pathlib import Path

import pytest

SAMPLE_LOG = """2026-11-07 08:01:12 INFO [db] healthcheck oracle-erp ok
2026-11-07 08:13:44 ERROR [db] Connection pool exhausted for oracle-erp after 30s timeout
2026-11-07 08:13:45 ERROR [db] Connection pool exhausted for oracle-erp after 31s timeout
2026-11-07 08:13:46 ERROR [db] Connection pool exhausted for oracle-erp after 32s timeout
2026-11-07 08:14:02 FATAL [billing] OutOfMemoryError: Java heap space while processing lote 4491
    at com.empresa.Faturamento.process
Caused by: java.lang.OutOfMemoryError: Java heap space
2026-11-07 09:02:03 ERROR [mail] javax.mail.MessagingException: 421 4.3.2 queue frozen
"""


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    root = tmp_path / "lab"
    logs = root / "data" / "sample_logs"
    logs.mkdir(parents=True)
    (logs / "amostra.log").write_text(SAMPLE_LOG, encoding="utf-8")
    database = root / "data" / "test.db"
    monkeypatch.setenv("SENTINELA_ROOT", str(root))
    monkeypatch.setenv("DATABASE_URL", "sqlite:///" + database.resolve().as_posix())
    monkeypatch.setenv("SIMULATE", "true")
    monkeypatch.setenv("ALLOW_REAL_ACTIONS", "false")
    monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)

    from app.config import get_settings
    from app.database import reset_engine

    get_settings.cache_clear()
    reset_engine()
    from app.main import app
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        created = test_client.post(
            "/api/auth/register",
            json={
                "name": "Operador de teste",
                "email": "operador@sentinela.local",
                "password": "senha-segura",
                "role": "N3",
                "sector": "DEV",
            },
        )
        assert created.status_code == 200, created.text
        test_client.headers["Authorization"] = f"Bearer {created.json()['token']}"
        yield test_client, root
    get_settings.cache_clear()
    reset_engine()
