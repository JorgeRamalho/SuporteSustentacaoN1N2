"""Adaptadores de chamados. Sem token, entra o catálogo de demonstração."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timedelta

import httpx

from app.config import Settings
from app.errors import ProviderError
from app.timeutil import parse_dt

SLA_BY_PRIORITY = {"critica": 4, "alta": 8, "media": 16, "baixa": 40}
PROVIDERS = ("jira", "servicenow", "glpi", "zendesk")


@dataclass
class TicketDraft:
    external_id: str
    provider: str
    title: str
    status: str
    priority: str
    opened_at: datetime
    first_response_at: datetime | None
    closed_at: datetime | None
    sla_hours: int
    queue: str


def normalize_priority(raw: str) -> str:
    value = raw.strip().lower()
    if value in {"highest", "urgent", "critical", "critica", "crítica", "1"}:
        return "critica"
    if value in {"high", "alta", "2"}:
        return "alta"
    if value in {"low", "baixa", "4", "5"}:
        return "baixa"
    return "media"


def normalize_status(raw: str) -> str:
    value = raw.strip().lower()
    if value in {"done", "closed", "fechado", "resolvido", "resolved", "solved", "5", "6", "7"}:
        return "fechado"
    if value in {"pending", "pendente", "on hold", "hold", "4"}:
        return "pendente"
    return "aberto"


def _draft(
    external_id: str,
    provider: str,
    title: str,
    status: str,
    priority: str,
    opened_at: datetime,
    first_response_at: datetime | None,
    closed_at: datetime | None,
    queue: str,
) -> TicketDraft:
    return TicketDraft(
        external_id=external_id,
        provider=provider,
        title=title[:200],
        status=status,
        priority=priority,
        opened_at=opened_at,
        first_response_at=first_response_at,
        closed_at=closed_at,
        sla_hours=SLA_BY_PRIORITY[priority],
        queue=queue,
    )


def mock_catalog(now: datetime | None = None) -> list[TicketDraft]:
    current = now or datetime.now().astimezone()
    rows = [
        ("GLPI-14021", "glpi", "Disco do servidor de aplicação acima de 90%", "aberto", "alta", current - timedelta(hours=30), current - timedelta(hours=29), None, "Infraestrutura"),
        ("JIRA-552", "jira", "Heap esgotado no lote de faturamento", "aberto", "critica", current - timedelta(hours=6), current - timedelta(hours=5, minutes=30), None, "Aplicações"),
        ("SN-90012", "servicenow", "Timeout na captura do PagNorte", "pendente", "alta", current - timedelta(hours=3), current - timedelta(hours=2, minutes=40), None, "Fornecedores"),
        ("ZD-331", "zendesk", "Fila de e-mail parada para o colaborador", "aberto", "media", current - timedelta(hours=20), current - timedelta(hours=18), None, "Comunicação"),
        ("GLPI-14088", "glpi", "Certificado do portal expirado", "fechado", "alta", current - timedelta(hours=50), current - timedelta(hours=49), current - timedelta(hours=30), "Infraestrutura"),
        ("JIRA-540", "jira", "Deadlock na atualização de pedidos", "fechado", "critica", current - timedelta(hours=10), current - timedelta(hours=9, minutes=30), current - timedelta(hours=6), "Banco"),
        ("SN-88441", "servicenow", "VPN da filial lenta no horário de pico", "fechado", "media", current - timedelta(days=5), current - timedelta(days=5) + timedelta(minutes=20), current - timedelta(days=5) + timedelta(hours=6), "Infraestrutura"),
        ("ZD-298", "zendesk", "Usuário sem acesso ao portal", "fechado", "baixa", current - timedelta(days=2), current - timedelta(days=2) + timedelta(minutes=15), current - timedelta(days=2) + timedelta(hours=1), "Acesso"),
    ]
    return [_draft(*row) for row in rows]


def map_jira(payload: dict) -> list[TicketDraft]:
    issues = payload.get("issues")
    if not isinstance(issues, list):
        raise ProviderError("Resposta do Jira sem a lista issues.")
    rows: list[TicketDraft] = []
    for issue in issues:
        fields = issue.get("fields") or {}
        priority = normalize_priority(str((fields.get("priority") or {}).get("name", "medium")))
        status = normalize_status(str((fields.get("status") or {}).get("name", "Aberto")))
        opened = parse_dt(fields.get("created"))
        if opened is None:
            raise ProviderError("Chamado do Jira sem data de abertura.")
        rows.append(
            _draft(
                str(issue.get("key") or issue.get("id")),
                "jira",
                str(fields.get("summary") or "Sem título"),
                status,
                priority,
                opened,
                parse_dt(fields.get("customfield_10015")),
                parse_dt(fields.get("resolutiondate")),
                str((fields.get("project") or {}).get("name") or "Jira"),
            )
        )
    return rows


def map_servicenow(payload: dict) -> list[TicketDraft]:
    result = payload.get("result")
    if not isinstance(result, list):
        raise ProviderError("Resposta do ServiceNow sem a lista result.")
    states = {"1": "aberto", "2": "aberto", "3": "pendente", "6": "fechado", "7": "fechado"}
    rows: list[TicketDraft] = []
    for item in result:
        state = str(item.get("state", "1"))
        status = states.get(state, normalize_status(state))
        priority = normalize_priority(str(item.get("priority", "3")))
        opened = parse_dt(item.get("opened_at") or item.get("sys_created_on"))
        if opened is None:
            raise ProviderError("Chamado do ServiceNow sem data de abertura.")
        rows.append(
            _draft(
                str(item.get("number") or item.get("sys_id")),
                "servicenow",
                str(item.get("short_description") or "Sem título"),
                status,
                priority,
                opened,
                parse_dt(item.get("first_response_time")),
                parse_dt(item.get("resolved_at") or item.get("closed_at")),
                str(item.get("assignment_group") or "ServiceNow"),
            )
        )
    return rows


def map_glpi(payload: list) -> list[TicketDraft]:
    if not isinstance(payload, list):
        raise ProviderError("Resposta do GLPI sem a lista de chamados.")
    statuses = {1: "aberto", 2: "aberto", 3: "aberto", 4: "pendente", 5: "fechado", 6: "fechado"}
    priorities = {1: "baixa", 2: "baixa", 3: "media", 4: "alta", 5: "critica"}
    rows: list[TicketDraft] = []
    for item in payload:
        status_code = int(item.get("status") or 1)
        priority_code = int(item.get("priority") or 3)
        opened = parse_dt(item.get("date") or item.get("date_creation"))
        if opened is None:
            raise ProviderError("Chamado do GLPI sem data de abertura.")
        rows.append(
            _draft(
                f"GLPI-{item.get('id')}",
                "glpi",
                str(item.get("name") or "Sem título"),
                statuses.get(status_code, "aberto"),
                priorities.get(priority_code, "media"),
                opened,
                parse_dt(item.get("takeintoaccountdate")),
                parse_dt(item.get("solvedate") or item.get("closedate")),
                "GLPI",
            )
        )
    return rows


def map_zendesk(payload: dict) -> list[TicketDraft]:
    tickets = payload.get("tickets")
    if not isinstance(tickets, list):
        raise ProviderError("Resposta do Zendesk sem a lista tickets.")
    statuses = {
        "new": "aberto",
        "open": "aberto",
        "pending": "pendente",
        "hold": "pendente",
        "solved": "fechado",
        "closed": "fechado",
    }
    priorities = {"urgent": "critica", "high": "alta", "normal": "media", "low": "baixa"}
    rows: list[TicketDraft] = []
    for item in tickets:
        opened = parse_dt(item.get("created_at"))
        if opened is None:
            raise ProviderError("Chamado do Zendesk sem data de abertura.")
        metrics = item.get("metric_set") or {}
        reply = (metrics.get("reply_time_in_minutes") or {}).get("calendar")
        first = None
        if isinstance(reply, int):
            first = opened + timedelta(minutes=reply)
        rows.append(
            _draft(
                f"ZD-{item.get('id')}",
                "zendesk",
                str(item.get("subject") or "Sem título"),
                statuses.get(str(item.get("status", "open")), "aberto"),
                priorities.get(str(item.get("priority") or "normal"), "media"),
                opened,
                first,
                parse_dt(metrics.get("solved_at")),
                "Zendesk",
            )
        )
    return rows


def configured(settings: Settings, name: str) -> bool:
    pairs = {
        "jira": (settings.jira_base_url, settings.jira_token),
        "servicenow": (settings.servicenow_base_url, settings.servicenow_token),
        "glpi": (settings.glpi_base_url, settings.glpi_token),
        "zendesk": (settings.zendesk_base_url, settings.zendesk_token),
    }
    base, token = pairs[name]
    return bool(base.strip() and token.strip())


def _request_json(url: str, headers: dict):
    try:
        response = httpx.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ProviderError("Falha ao consultar a ferramenta de chamados.") from exc


def fetch_provider(name: str, settings: Settings, now: datetime | None = None) -> list[TicketDraft]:
    if name not in PROVIDERS:
        raise ProviderError("Ferramenta de chamados desconhecida.")
    if not configured(settings, name):
        return [item for item in mock_catalog(now) if item.provider == name]
    if name == "jira":
        headers = {"Accept": "application/json"}
        if settings.jira_email:
            raw = f"{settings.jira_email}:{settings.jira_token}".encode()
            headers["Authorization"] = "Basic " + base64.b64encode(raw).decode()
        else:
            headers["Authorization"] = f"Bearer {settings.jira_token}"
        payload = _request_json(settings.jira_base_url.rstrip("/") + "/rest/api/3/search", headers)
        return map_jira(payload)
    if name == "servicenow":
        headers = {"Accept": "application/json", "Authorization": f"Bearer {settings.servicenow_token}"}
        url = settings.servicenow_base_url.rstrip("/") + "/api/now/table/incident?sysparm_limit=100"
        return map_servicenow(_request_json(url, headers))
    if name == "glpi":
        headers = {
            "Accept": "application/json",
            "App-Token": settings.glpi_token,
            "Session-Token": settings.glpi_token,
        }
        payload = _request_json(settings.glpi_base_url.rstrip("/") + "/apirest.php/Ticket", headers)
        return map_glpi(payload)
    headers = {"Accept": "application/json"}
    if settings.zendesk_email:
        raw = f"{settings.zendesk_email}/token:{settings.zendesk_token}".encode()
        headers["Authorization"] = "Basic " + base64.b64encode(raw).decode()
    else:
        headers["Authorization"] = f"Bearer {settings.zendesk_token}"
    payload = _request_json(settings.zendesk_base_url.rstrip("/") + "/api/v2/tickets.json", headers)
    return map_zendesk(payload)


def fetch_all(settings: Settings, now: datetime | None = None) -> list[TicketDraft]:
    current = now or datetime.now().astimezone()
    if not any(configured(settings, name) for name in PROVIDERS):
        return mock_catalog(current)
    rows: list[TicketDraft] = []
    for name in PROVIDERS:
        rows.extend(fetch_provider(name, settings, current))
    return rows
