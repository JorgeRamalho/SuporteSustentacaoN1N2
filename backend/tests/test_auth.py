def _without_session(http):
    try:
        del http.headers["Authorization"]
    except KeyError:
        pass


def test_saude_continua_publica(client):
    http, _root = client
    _without_session(http)
    response = http.get("/api/health")
    assert response.status_code == 200
    assert response.json()["app"] == "Sentinela"


def test_console_exige_sessao(client):
    http, _root = client
    _without_session(http)
    blocked = http.get("/api/dashboard")
    assert blocked.status_code == 401
    assert "login" in blocked.json()["detail"].lower()


def test_cadastro_login_e_recuperacao(client):
    http, _root = client
    _without_session(http)
    created = http.post(
        "/api/auth/register",
        json={
            "name": "Ana N1",
            "email": "ana@empresa.local",
            "password": "acesso123",
            "role": "N1",
            "sector": "Suporte",
        },
    )
    assert created.status_code == 200
    body = created.json()
    assert body["user"]["email"] == "ana@empresa.local"
    assert body["token"]

    duplicate = http.post(
        "/api/auth/register",
        json={"name": "Ana", "email": "ana@empresa.local", "password": "acesso123"},
    )
    assert duplicate.status_code == 400

    http.headers["Authorization"] = f"Bearer {body['token']}"
    me = http.get("/api/auth/me")
    assert me.status_code == 200
    profile = me.json()
    assert profile["name"] == "Ana N1"
    assert profile["role"] == "N1"
    assert profile["sector"] == "Suporte"

    _without_session(http)
    denied = http.post("/api/auth/login", json={"email": "ana@empresa.local", "password": "errada123"})
    assert denied.status_code == 400
    assert denied.json()["detail"] == "Senha incorreta."

    missing = http.post("/api/auth/login", json={"email": "ausente@empresa.local", "password": "acesso123"})
    assert missing.status_code == 400
    assert "não cadastrado" in missing.json()["detail"].lower()

    recovered = http.post(
        "/api/auth/recover",
        json={"email": "ana@empresa.local", "password": "novaSenha1"},
    )
    assert recovered.status_code == 200
    old_session = http.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert old_session.status_code == 401

    entered = http.post(
        "/api/auth/login",
        json={"email": "ana@empresa.local", "password": "novaSenha1"},
    )
    assert entered.status_code == 200
    http.headers["Authorization"] = f"Bearer {entered.json()['token']}"
    assert http.get("/api/incidents").status_code == 200

    wrong_pw = http.patch(
        "/api/auth/me/password",
        json={"current_password": "errada", "new_password": "outraSenha1"},
    )
    assert wrong_pw.status_code == 400
    assert "atual" in wrong_pw.json()["detail"].lower()

    changed = http.patch(
        "/api/auth/me/password",
        json={"current_password": "novaSenha1", "new_password": "maisUmaSenha1"},
    )
    assert changed.status_code == 200

    assert http.post("/api/auth/logout").status_code == 200
    _without_session(http)
    assert http.get("/api/dashboard").status_code == 401
