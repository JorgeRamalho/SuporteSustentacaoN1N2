"""Rotas do console. A regra de negócio fica nos serviços."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.errors import SentinelaError
from app.models import AutomationRun, Incident, KnowledgeArticle, LogEvent, Ticket, Vendor
from app.schemas import AutomationRequest, IncidentCreate, IncidentUpdate, ReportRequest, ScanRequest
from app.services.access import require_min_role, require_operational_console
from app.services.auth import require_user
from app.services.automation import run_check
from app.services.dashboard import build_dashboard
from app.services.exporters import incidents_csv, incidents_json, logs_csv, logs_json
from app.services.report_queries import filter_incidents, filter_logs, report_filter_options
from app.services.host import read_host
from app.services.incident_engine import detect_incidents, register_incident
from app.services.log_collector import ingest_directory
from app.services.matching import tokens
from app.services.paths import resolve_api_log_dir
from app.services.reports import collect_metrics, sync_tickets, weekly_report
from app.services.seed import reprocess_samples
from app.services.serialize import (
    dump_article,
    dump_incident,
    dump_log,
    dump_run,
    dump_ticket,
    dump_vendor,
    load_maps,
)
from app.services.status import refresh_statuses
from app.timeutil import utcnow

public_router = APIRouter()
router = APIRouter(dependencies=[Depends(require_user)])


@public_router.get("/health", tags=["Painel"], summary="Saúde da API", description="Confirma se o serviço está no ar e se o modo seguro está ligado.")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "app": "Sentinela",
        "version": "1.0.0",
        "simulate": settings.simulate,
        "allow_real_actions": settings.allow_real_actions,
    }


@router.get(
    "/dashboard",
    tags=["Painel"],
    summary="Painel operacional",
    description="KPIs, leitura do host, serviços, incidentes recentes e alertas.",
    dependencies=[Depends(require_operational_console)],
)
def dashboard(db: Session = Depends(get_db)) -> dict:
    return build_dashboard(db, get_settings())


@router.get(
    "/logs",
    tags=["Logs"],
    summary="Listar eventos críticos",
    description="Devolve ERROR, FATAL e CRITICAL já coletados. INFO e DEBUG ficam de fora.",
    dependencies=[Depends(require_operational_console)],
)
def list_logs(limit: int = Query(default=100, ge=1, le=500), db: Session = Depends(get_db)) -> dict:
    total = db.query(LogEvent).count()
    rows = db.query(LogEvent).order_by(LogEvent.logged_at.desc()).limit(limit).all()
    return {"total": total, "items": [dump_log(row) for row in rows]}


@router.post(
    "/logs/scan",
    tags=["Logs"],
    summary="Ler pasta de logs",
    description="Varre a pasta informada e grava só linhas novas de erro.",
    dependencies=[Depends(require_operational_console)],
)
def scan_logs(payload: ScanRequest, db: Session = Depends(get_db)) -> dict:
    directory = resolve_api_log_dir(payload.directory, get_settings())
    stats = ingest_directory(db, directory)
    db.commit()
    return {"directory": directory.name, **stats}


@router.get(
    "/logs/export",
    tags=["Logs"],
    summary="Exportar erros",
    description="Gera CSV ou JSON dos eventos críticos, com filtro opcional de nível e serviço.",
    dependencies=[Depends(require_min_role("N3"))],
)
def export_logs(
    fmt: str = Query(default="csv", alias="format"),
    level: str | None = None,
    service: str | None = None,
    db: Session = Depends(get_db),
):
    if fmt not in {"csv", "json"}:
        raise SentinelaError("Formato aceito: csv ou json.")
    try:
        rows = filter_logs(db, level, service).all()
    except ValueError as exc:
        raise SentinelaError(str(exc)) from exc
    if fmt == "json":
        content = logs_json(rows)
        media = "application/json; charset=utf-8"
        filename = "erros-sentinela.json"
    else:
        content = logs_csv(rows)
        media = "text/csv; charset=utf-8"
        filename = "erros-sentinela.csv"
    return Response(
        content=content,
        media_type=media,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post(
    "/demo/reprocess",
    tags=["Logs"],
    summary="Relêr amostras",
    description="Volta a processar as amostras locais e reabre a fila de incidentes de demonstração.",
    dependencies=[Depends(require_operational_console)],
)
def reprocess(db: Session = Depends(get_db)) -> dict:
    return reprocess_samples(db, get_settings())


@router.get("/incidents", tags=["Incidentes"], summary="Listar incidentes", description="Fila N1/N2 com procedimento e fornecedor associados.")
def list_incidents(db: Session = Depends(get_db)) -> dict:
    articles, vendors = load_maps(db)
    rows = db.query(Incident).order_by(Incident.code.desc()).all()
    return {"items": [dump_incident(row, articles, vendors) for row in rows]}


@router.post("/incidents", tags=["Incidentes"], summary="Registrar incidente", description="Abre um incidente a partir de título, sintoma e severidade.")
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)) -> dict:
    row = register_incident(db, payload.title, payload.symptom, payload.severity)
    db.commit()
    articles, vendors = load_maps(db)
    return dump_incident(row, articles, vendors)


@router.post("/incidents/detect", tags=["Incidentes"], summary="Detectar pela assinatura", description="Agrupa logs repetidos e abre incidente quando a assinatura ainda não existe.")
def detect(db: Session = Depends(get_db)) -> dict:
    created = detect_incidents(db)
    db.commit()
    articles, vendors = load_maps(db)
    return {"created": len(created), "items": [dump_incident(row, articles, vendors) for row in created]}


@router.patch("/incidents/{incident_id}", tags=["Incidentes"], summary="Atualizar status", description="Muda o status do incidente para aberto, em análise ou resolvido.")
def update_incident(incident_id: int, payload: IncidentUpdate, db: Session = Depends(get_db)) -> dict:
    row = db.get(Incident, incident_id)
    if row is None:
        raise SentinelaError("Incidente não encontrado.")
    row.status = payload.status
    row.updated_at = utcnow()
    refresh_statuses(db)
    db.commit()
    articles, vendors = load_maps(db)
    return dump_incident(row, articles, vendors)


@router.get(
    "/automation/host",
    tags=["Automação"],
    summary="Leitura do host",
    description="Disco, memória e CPU desta máquina, com os limiares configurados.",
    dependencies=[Depends(require_operational_console)],
)
def host() -> dict:
    settings = get_settings()
    payload = read_host(settings.root)
    payload["disk_threshold"] = settings.disk_threshold
    payload["memory_threshold"] = settings.memory_threshold
    payload["simulate"] = settings.simulate
    payload["allow_real_actions"] = settings.allow_real_actions
    return payload


@router.get(
    "/automation/runs",
    tags=["Automação"],
    summary="Histórico de ensaios",
    description="Últimas ações de automação. No modo seguro só há ensaio.",
    dependencies=[Depends(require_min_role("N2"))],
)
def runs(db: Session = Depends(get_db)) -> dict:
    rows = db.query(AutomationRun).order_by(AutomationRun.created_at.desc()).limit(30).all()
    return {"items": [dump_run(row) for row in rows]}


@router.post(
    "/automation/run",
    tags=["Automação"],
    summary="Ensaio de disco e memória",
    description="Compara os percentuais com os limiares. Limpeza real só com as duas travas desligadas.",
    dependencies=[Depends(require_min_role("N2"))],
)
def automate(payload: AutomationRequest, db: Session = Depends(get_db)) -> dict:
    return run_check(db, get_settings(), payload.disk_percent, payload.memory_percent)


@router.get("/tickets", tags=["Chamados"], summary="Listar chamados", description="Chamados das quatro ferramentas de service desk.")
def list_tickets(db: Session = Depends(get_db)) -> dict:
    rows = db.query(Ticket).order_by(Ticket.opened_at.desc()).all()
    return {"items": [dump_ticket(row) for row in rows]}


@router.get("/tickets/sla", tags=["Chamados"], summary="Métricas de SLA", description="Cumprimento de SLA na janela informada, em dias, com filtro opcional por ferramenta.")
def ticket_sla(
    days: int = Query(default=7, ge=1, le=90),
    provider: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    if provider and provider not in {"jira", "servicenow", "glpi", "zendesk"}:
        raise SentinelaError("Ferramenta aceita: jira, servicenow, glpi ou zendesk.")
    return collect_metrics(db, days, provider)


@router.post("/tickets/sync", tags=["Chamados"], summary="Sincronizar ferramentas", description="Puxa Jira, ServiceNow, GLPI e Zendesk. Sem token, usa o catálogo de demonstração.")
def sync(db: Session = Depends(get_db)) -> dict:
    count = sync_tickets(db, get_settings())
    db.commit()
    return {"synced": count}


@router.post(
    "/tickets/report",
    tags=["Chamados"],
    summary="Relatório semanal",
    description="Compila o relatório da janela e grava em data/reports.",
    dependencies=[Depends(require_min_role("N3"))],
)
def report(payload: ReportRequest, db: Session = Depends(get_db)) -> dict:
    return weekly_report(db, get_settings(), payload.days, payload.provider)


@router.get(
    "/reports/options",
    tags=["Relatórios"],
    summary="Opções de filtro",
    description="Listas de nível, serviço, fila e ferramenta para montar relatórios.",
    dependencies=[Depends(require_min_role("N3"))],
)
def report_options(db: Session = Depends(get_db)) -> dict:
    return report_filter_options(db)


@router.get(
    "/reports/preview",
    tags=["Relatórios"],
    summary="Pré-visualizar contagem",
    description="Conta quantos registros entram no relatório com os filtros escolhidos.",
    dependencies=[Depends(require_min_role("N3"))],
)
def report_preview(
    kind: str = Query(..., pattern="^(logs|incidents|sla)$"),
    level: str | None = None,
    service: str | None = None,
    queue: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    provider: str | None = None,
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
) -> dict:
    if kind == "logs":
        try:
            count = filter_logs(db, level, service).count()
        except ValueError as exc:
            raise SentinelaError(str(exc)) from exc
        return {"kind": kind, "count": count}
    if kind == "incidents":
        try:
            count = filter_incidents(db, queue, severity, status).count()
        except ValueError as exc:
            raise SentinelaError(str(exc)) from exc
        return {"kind": kind, "count": count}
    if provider and provider not in {"jira", "servicenow", "glpi", "zendesk"}:
        raise SentinelaError("Ferramenta aceita: jira, servicenow, glpi ou zendesk.")
    metrics = collect_metrics(db, days, provider)
    return {"kind": kind, "count": metrics["considered"], "metrics": metrics}


@router.get(
    "/incidents/export",
    tags=["Relatórios"],
    summary="Exportar incidentes",
    description="CSV ou JSON da fila com filtros de fila, severidade e status.",
    dependencies=[Depends(require_min_role("N3"))],
)
def export_incidents(
    fmt: str = Query(default="csv", alias="format"),
    queue: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    if fmt not in {"csv", "json"}:
        raise SentinelaError("Formato aceito: csv ou json.")
    try:
        rows = filter_incidents(db, queue, severity, status).all()
    except ValueError as exc:
        raise SentinelaError(str(exc)) from exc
    if fmt == "json":
        content = incidents_json(rows)
        media = "application/json; charset=utf-8"
        filename = "incidentes-sentinela.json"
    else:
        content = incidents_csv(rows)
        media = "text/csv; charset=utf-8"
        filename = "incidentes-sentinela.csv"
    return Response(
        content=content,
        media_type=media,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/kb",
    tags=["Conhecimento"],
    summary="Buscar procedimentos",
    description="Artigos de procedimento que o N1 executa antes de escalar.",
    dependencies=[Depends(require_operational_console)],
)
def knowledge(q: str = "", db: Session = Depends(get_db)) -> dict:
    _, vendors = load_maps(db)
    articles = db.query(KnowledgeArticle).order_by(KnowledgeArticle.title).all()
    query = q.strip()
    if query:
        wanted = tokens(query)
        ranked = []
        for article in articles:
            blob = " ".join([article.title, article.symptoms, article.cause, article.resolution, article.tags])
            score = len(wanted & tokens(blob))
            if score:
                ranked.append((score, article))
        ranked.sort(key=lambda item: (-item[0], item[1].title))
        articles = [item[1] for item in ranked]
    return {"items": [dump_article(article, vendors) for article in articles]}


@router.get(
    "/vendors",
    tags=["Fornecedores"],
    summary="Listar fornecedores",
    description="Contrato, contato de escalonamento e sinais de log de cada fornecedor.",
    dependencies=[Depends(require_operational_console)],
)
def vendors(db: Session = Depends(get_db)) -> dict:
    rows = db.query(Vendor).order_by(Vendor.name).all()
    return {"items": [dump_vendor(row) for row in rows]}
