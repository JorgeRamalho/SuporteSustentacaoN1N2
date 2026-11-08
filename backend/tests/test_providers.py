from types import SimpleNamespace

from app.config import Settings
from app.services.matching import best_article, match_vendor
from app.services.providers import fetch_provider, map_jira
from app.services.reports import send_email


def test_artigo_e_fornecedor_do_pool():
    vendors = [
        SimpleNamespace(name="Oracle", keywords="oracle,pool"),
        SimpleNamespace(name="PagNorte", keywords="pagnorte,capture"),
    ]
    articles = [
        SimpleNamespace(
            title="Pool Oracle",
            symptoms="connection pool exhausted",
            cause="",
            tags="oracle,pool,timeout",
        ),
        SimpleNamespace(
            title="Outro",
            symptoms="fila de impressao",
            cause="",
            tags="impressora",
        ),
    ]
    text = "Connection pool exhausted for oracle-erp after 30s timeout"
    assert match_vendor(text, vendors).name == "Oracle"
    assert best_article(text, articles).title == "Pool Oracle"


def test_jira_mapper():
    rows = map_jira(
        {
            "issues": [
                {
                    "key": "SUP-1",
                    "fields": {
                        "summary": "Fila parada",
                        "status": {"name": "Done"},
                        "priority": {"name": "High"},
                        "created": "2026-11-01T10:00:00.000+0000",
                        "resolutiondate": "2026-11-01T12:00:00.000+0000",
                        "project": {"name": "Sustentação"},
                    },
                }
            ]
        }
    )
    assert rows[0].external_id == "SUP-1"
    assert rows[0].status == "fechado"
    assert rows[0].priority == "alta"
    assert rows[0].sla_hours == 8


def test_sem_token_usa_catalogo(tmp_path):
    settings = Settings(sentinela_root=str(tmp_path), jira_base_url="", jira_token="", simulate=True)
    rows = fetch_provider("jira", settings)
    assert rows
    assert {item.provider for item in rows} == {"jira"}


def test_glpi_live_mapeia_status(monkeypatch, tmp_path):
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return [
                {
                    "id": 9,
                    "name": "VPN",
                    "status": 6,
                    "priority": 5,
                    "date": "2026-11-01 10:00:00",
                    "solvedate": "2026-11-01 12:00:00",
                    "takeintoaccountdate": "2026-11-01 10:10:00",
                }
            ]

    def fake_get(url, headers, timeout):
        captured["url"] = url
        captured["headers"] = headers
        return Response()

    monkeypatch.setattr("app.services.providers.httpx.get", fake_get)
    settings = Settings(
        sentinela_root=str(tmp_path),
        glpi_base_url="https://glpi.example",
        glpi_token="secret",
        simulate=True,
    )
    rows = fetch_provider("glpi", settings)
    assert captured["headers"]["App-Token"] == "secret"
    assert captured["url"].endswith("/apirest.php/Ticket")
    assert rows[0].external_id == "GLPI-9"
    assert rows[0].status == "fechado"
    assert rows[0].priority == "critica"


def test_email_simulado_nao_abre_smtp(monkeypatch, tmp_path):
    def boom(*_args, **_kwargs):
        raise AssertionError("smtp nao deveria abrir")

    monkeypatch.setattr("app.services.reports.smtplib.SMTP", boom)
    settings = Settings(sentinela_root=str(tmp_path), simulate=True, smtp_host="smtp.exemplo.local")
    assert send_email(settings, "oi") is False


def test_email_real_usa_smtp(monkeypatch, tmp_path):
    sent = {}

    class Fake:
        def __init__(self, host, port, timeout):
            sent["host"] = host

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def starttls(self):
            sent["tls"] = True

        def login(self, user, password):
            sent["user"] = user

        def send_message(self, message):
            sent["subject"] = message["Subject"]

    monkeypatch.setattr("app.services.reports.smtplib.SMTP", Fake)
    settings = Settings(
        sentinela_root=str(tmp_path),
        simulate=False,
        smtp_host="smtp.exemplo.local",
        smtp_user="lab",
        smtp_password="segredo",
        report_email_to="sustentacao@exemplo.local",
    )
    assert send_email(settings, "corpo") is True
    assert sent["host"] == "smtp.exemplo.local"
    assert sent["tls"] is True
    assert sent["subject"].startswith("Sentinela")
