def _register_n1(http):
    _without_session(http)
    return http.post(
        "/api/auth/register",
        json={
            "name": "Operador N1",
            "email": "n1@empresa.local",
            "password": "acesso123",
            "role": "N1",
            "sector": "Suporte",
        },
    )


def _without_session(http):
    try:
        del http.headers["Authorization"]
    except KeyError:
        pass


def test_n1_liberado_para_chamados_e_incidentes(client):
    http, _root = client
    created = _register_n1(http)
    assert created.status_code == 200
    token = created.json()["token"]
    http.headers["Authorization"] = f"Bearer {token}"
    assert http.get("/api/tickets").status_code == 200
    assert http.post(
        "/api/incidents",
        json={"title": "Teste N1", "symptom": "Sintoma em produção", "severity": "baixo"},
    ).status_code == 200


def test_n1_bloqueado_fora_chamados_e_incidentes(client):
    http, _root = client
    created = _register_n1(http)
    token = created.json()["token"]
    http.headers["Authorization"] = f"Bearer {token}"
    blocked = [
        http.get("/api/dashboard"),
        http.get("/api/logs"),
        http.get("/api/kb"),
        http.get("/api/reports/options"),
        http.get("/api/reports/preview", params={"kind": "logs"}),
        http.get("/api/incidents/export", params={"format": "csv"}),
        http.post("/api/automation/run", json={"disk_percent": 50}),
        http.get("/api/automation/runs"),
    ]
    for response in blocked:
        assert response.status_code == 403


def test_n2_bloqueado_em_relatorios(client):
    http, _root = client
    _without_session(http)
    created = http.post(
        "/api/auth/register",
        json={
            "name": "Analista N2",
            "email": "n2@empresa.local",
            "password": "acesso123",
            "role": "N2",
            "sector": "Suporte",
        },
    )
    assert created.status_code == 200
    http.headers["Authorization"] = f"Bearer {created.json()['token']}"
    assert http.get("/api/dashboard").status_code == 200
    assert http.get("/api/reports/options").status_code == 403
    assert http.get("/api/incidents/export", params={"format": "csv"}).status_code == 403


def test_n3_acessa_relatorios(client):
    http, _root = client
    _without_session(http)
    created = http.post(
        "/api/auth/register",
        json={
            "name": "Coordenador N3",
            "email": "n3@empresa.local",
            "password": "acesso123",
            "role": "N3",
            "sector": "Suporte",
        },
    )
    assert created.status_code == 200
    http.headers["Authorization"] = f"Bearer {created.json()['token']}"
    assert http.get("/api/reports/options").status_code == 200
