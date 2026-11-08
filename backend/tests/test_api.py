def test_saude_e_modo_seguro(client):
    http, _root = client
    response = http.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["app"] == "Sentinela"
    assert body["simulate"] is True
    assert body["allow_real_actions"] is False
    assert http.get("/docs").status_code == 200


def test_cors_aceita_live_server(client):
    http, _root = client
    origin = "http://127.0.0.1:5500"
    response = http.get("/api/health", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin
    preflight = http.options(
        "/api/dashboard",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert preflight.status_code in {200, 204}
    assert preflight.headers.get("access-control-allow-origin") == origin


def test_logs_viram_incidentes_n1_e_n2(client):
    http, _root = client
    logs = http.get("/api/logs")
    assert logs.status_code == 200
    levels = {item["level"] for item in logs.json()["items"]}
    assert "INFO" not in levels
    assert "ERROR" in levels
    assert "FATAL" in levels

    incidents = http.get("/api/incidents").json()["items"]
    assert {item["level"] for item in incidents} >= {"N1", "N2"}
    pool = next(item for item in incidents if "pool" in item["title"].lower())
    assert pool["vendor"]["name"] == "Oracle"
    assert pool["level"] == "N2"
    assert pool["article"]["title"]
    mail = next(item for item in incidents if "queue frozen" in item["title"].lower())
    assert mail["level"] == "N1"
    assert mail["vendor"]["name"] == "Microsoft"
    fatal = next(item for item in incidents if item["severity"] == "P1")
    assert "Caused by" in http.get("/api/logs/export", params={"format": "json"}).text or fatal["evidence_count"] >= 1


def test_registro_manual_de_incidente(client):
    http, _root = client
    created = http.post(
        "/api/incidents",
        json={
            "title": "Portal lento no login",
            "symptom": "Usuários esperam mais de um minuto na tela inicial.",
            "severity": "media",
        },
    )
    assert created.status_code == 200
    body = created.json()
    assert body["title"] == "Portal lento no login"
    assert body["severity"] == "P2"
    assert body["level"] == "N2"
    assert body["status"] == "aberto"
    assert "severidade media" in body["summary"]
    empty = http.post("/api/incidents", json={"title": "   ", "symptom": "tela parada", "severity": "baixa"})
    assert empty.status_code == 422


def test_relatorios_com_filtros(client):
    http, _root = client
    options = http.get("/api/reports/options")
    assert options.status_code == 200
    assert "log_levels" in options.json()
    preview = http.get("/api/reports/preview", params={"kind": "logs", "level": "ERROR"})
    assert preview.status_code == 200
    assert preview.json()["count"] >= 0
    export_inc = http.get("/api/incidents/export", params={"format": "csv", "queue": "N2"})
    assert export_inc.status_code == 200
    assert "code" in export_inc.text.lower()
    sla = http.get("/api/reports/preview", params={"kind": "sla", "days": 7, "provider": "jira"})
    assert sla.status_code == 200
    assert "metrics" in sla.json()


def test_exportacao_e_releitura_idempotente(client):
    http, _root = client
    exported = http.get("/api/logs/export", params={"format": "csv"})
    assert exported.status_code == 200
    assert "ERROR" in exported.text
    assert "pool" in exported.text.lower()
    again = http.post("/api/logs/scan", json={})
    assert again.status_code == 200
    assert again.json()["inserted"] == 0
    blocked = http.post("/api/logs/scan", json={"directory": "C:/Windows"})
    assert blocked.status_code == 400


def test_pressao_de_disco_nao_apaga_a_sandbox(client):
    http, root = client
    marker = root / "data" / "sandbox" / "temp" / "cache-sessao.tmp"
    assert marker.exists()
    response = http.post("/api/automation/run", json={"disk_percent": 96, "memory_percent": 93})
    assert response.status_code == 200
    body = response.json()
    assert body["simulate"] is True
    assert body["pressure"] is True
    assert marker.exists()
    kinds = {item["kind"] for item in body["actions"]}
    assert kinds == {"limpar_temporarios", "reiniciar_servico"}
    assert body["alert"]["simulate"] is True
    assert "sistema operacional" in body["alert"]["message"]


def test_conhecimento_relatorio_e_resolucao(client):
    http, root = client
    articles = http.get("/api/kb", params={"q": "oracle pool"}).json()["items"]
    assert articles
    assert "pool" in articles[0]["title"].lower()
    vendors = http.get("/api/vendors").json()["items"]
    assert any(item["name"] == "PagNorte" for item in vendors)

    report = http.post("/api/tickets/report", json={"days": 7})
    assert report.status_code == 200
    assert "Conformidade de SLA" in report.json()["preview"]
    assert list((root / "data" / "reports").glob("sla-*.txt"))

    incidents = http.get("/api/incidents").json()["items"]
    for item in incidents:
        updated = http.patch(f"/api/incidents/{item['id']}", json={"status": "resolvido"})
        assert updated.status_code == 200
    dashboard = http.get("/api/dashboard").json()
    assert dashboard["kpis"]["open_incidents"] == 0
    assert dashboard["kpis"]["open_tickets"] > 0
    assert 0 <= dashboard["kpis"]["sla_compliance"] <= 100
    assert all(service["status"] == "operacional" for service in dashboard["services"])
