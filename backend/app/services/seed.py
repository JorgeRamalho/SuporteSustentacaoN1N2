"""Carga inicial e reprocessamento das amostras do laboratório."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import KnowledgeArticle, MonitoredService, Vendor
from app.services.automation import ensure_sandbox
from app.services.incident_engine import detect_incidents
from app.services.log_collector import ingest_directory
from app.services.reports import sync_tickets
from app.models import Incident, LogEvent, Ticket


def _prepare(settings: Settings) -> None:
    (settings.root / "data" / "sample_logs").mkdir(parents=True, exist_ok=True)
    (settings.root / "data" / "reports").mkdir(parents=True, exist_ok=True)
    ensure_sandbox(settings)


def seed_if_empty(db: Session, settings: Settings | None = None) -> None:
    current = settings or get_settings()
    _prepare(current)
    if db.query(Vendor).count() == 0:
        vendors = [
            Vendor(
                name="Oracle",
                product="Oracle Database",
                category="banco",
                contract_sla_hours=4,
                escalation_contact="plantao.banco@exemplo.local",
                keywords="oracle,pool,listener",
                notes="Escalar com horário, serviço e trecho do log. Não reiniciar o banco pelo N1.",
            ),
            Vendor(
                name="PagNorte",
                product="Gateway de pagamento",
                category="aplicacao",
                contract_sla_hours=2,
                escalation_contact="noc@pagnorte.exemplo",
                keywords="pagnorte,capture",
                notes="Não colar PAN, CVV ou trilha do cartão no chamado do fornecedor.",
            ),
            Vendor(
                name="Microsoft",
                product="Microsoft 365",
                category="comunicacao",
                contract_sla_hours=8,
                escalation_contact="mensageria@exemplo.local",
                keywords="queue frozen,messagingexception,javax.mail",
                notes="Fila de correio. Evitar reenvio em massa.",
            ),
            Vendor(
                name="Plataforma interna",
                product="Pedidos, faturamento e portal",
                category="aplicacao",
                contract_sla_hours=4,
                escalation_contact="sustentacao@exemplo.local",
                keywords="deadlock,pedidos,heap,outofmemory,nginx,certificate,sslhandshake,no space",
                notes="Time interno. Mudança de certificado passa pelo fluxo de infraestrutura.",
            ),
        ]
        db.add_all(vendors)
        db.flush()
        by_name = {item.name: item.id for item in vendors}
        db.add_all(
            [
                KnowledgeArticle(
                    title="Pool de conexões do Oracle esgotado",
                    symptoms="A aplicação responde timeout e o log repete connection pool exhausted no oracle.",
                    cause="O pool chegou no limite ou ficaram sessões presas em transação aberta.",
                    resolution="\n".join(
                        [
                            "1. Confirmar se o erro segue por mais de 5 minutos.",
                            "2. Anotar serviço, horário e a assinatura normalizada.",
                            "3. Anexar 20 linhas em volta do evento, sem senha de conexão.",
                            "4. Se houver mudança em andamento, avisar o N2 antes de qualquer restart.",
                            "5. Escalar ao N2 de banco se passar de 10 minutos. Não reiniciar o Oracle.",
                        ]
                    ),
                    level="N1",
                    tags="connection,pool,exhausted,oracle,timeout",
                    vendor_id=by_name["Oracle"],
                ),
                KnowledgeArticle(
                    title="Heap esgotado no faturamento",
                    symptoms="OutOfMemoryError Java heap space durante o processamento do lote.",
                    cause="O lote excedeu a memória do processo.",
                    resolution="\n".join(
                        [
                            "1. Tratar como P1 se o lote parou.",
                            "2. Guardar o identificador do lote que aparece na primeira linha.",
                            "3. Escalar ao N2 de aplicação com o horário e o tamanho do lote.",
                            "4. Não gerar heap dump em produção sem acordo do plantão.",
                        ]
                    ),
                    level="N2",
                    tags="outofmemoryerror,heap,faturamento,fatal",
                    vendor_id=by_name["Plataforma interna"],
                ),
                KnowledgeArticle(
                    title="Timeout na captura do PagNorte",
                    symptoms="SocketTimeoutException no capture do gateway PagNorte.",
                    cause="O fornecedor não respondeu dentro do tempo do gateway.",
                    resolution="\n".join(
                        [
                            "1. Ver se o erro é de um pedido ou de todos.",
                            "2. Conferir o horário e o código do pedido.",
                            "3. Abrir chamado no PagNorte sem dados de cartão.",
                            "4. N1 acompanha. N2 decide contingência.",
                        ]
                    ),
                    level="N2",
                    tags="sockettimeoutexception,pagnorte,capture,timeout",
                    vendor_id=by_name["PagNorte"],
                ),
                KnowledgeArticle(
                    title="Disco sem espaço para gravar log",
                    symptoms="No space left on device ao abrir ou gravar arquivo de log.",
                    cause="O volume de log ou de temporários encheu o disco.",
                    resolution="\n".join(
                        [
                            "1. Identificar o volume citado no alerta.",
                            "2. No laboratório, a única limpeza permitida é data/sandbox, primeiro em modo seguro.",
                            "3. Em servidor real, não apagar o log do próprio incidente.",
                            "4. Acima de 95%, escalar o N2 de infraestrutura.",
                        ]
                    ),
                    level="N1",
                    tags="space,device,disco,nginx,access",
                    vendor_id=by_name["Plataforma interna"],
                ),
                KnowledgeArticle(
                    title="Fila de e-mail congelada",
                    symptoms="MessagingException 421 queue frozen no serviço de correio.",
                    cause="A fila parou de entregar mensagens.",
                    resolution="\n".join(
                        [
                            "1. Confirmar se já há chamado de usuário ou só o alerta.",
                            "2. Anotar o horário da última mensagem aceita.",
                            "3. Escalar ao N2 se a fila não andar em 15 minutos.",
                            "4. Não reenviar em massa.",
                        ]
                    ),
                    level="N1",
                    tags="messagingexception,queue,frozen,correio,mail",
                    vendor_id=by_name["Microsoft"],
                ),
                KnowledgeArticle(
                    title="Certificado TLS expirado",
                    symptoms="SSLHandshakeException certificate expired no acesso ao portal ou ao IdP.",
                    cause="O certificado do serviço ou do fornecedor venceu.",
                    resolution="\n".join(
                        [
                            "1. Anotar o host citado na mensagem.",
                            "2. Se o host for interno, abrir mudança para troca do certificado.",
                            "3. Se for fornecedor, acionar o contrato com horário e nome do host.",
                            "4. N1 avisa os usuários com a mensagem padrão de indisponibilidade.",
                        ]
                    ),
                    level="N2",
                    tags="sslhandshakeexception,certificate,expired",
                    vendor_id=by_name["Plataforma interna"],
                ),
                KnowledgeArticle(
                    title="Deadlock na tabela de pedidos",
                    symptoms="deadlock detected ao atualizar a tabela pedidos.",
                    cause="Duas transações alteraram as mesmas linhas em ordens diferentes.",
                    resolution="\n".join(
                        [
                            "1. Ver se a API devolveu erro ao usuário ou se o banco refez a transação.",
                            "2. Contar as ocorrências da mesma assinatura em 10 minutos.",
                            "3. Escalar ao N2 de banco a partir de 5 ocorrências.",
                            "4. Não encerrar sessão no banco sem o procedimento de plantão.",
                        ]
                    ),
                    level="N2",
                    tags="deadlock,pedidos,psqlexception",
                    vendor_id=by_name["Plataforma interna"],
                ),
            ]
        )
    if db.query(MonitoredService).count() == 0:
        db.add_all(
            [
                MonitoredService(name="oracle-erp", role="Banco do ERP", owner_level="N2", status="operacional"),
                MonitoredService(name="api-pedidos", role="API de pedidos", owner_level="N2", status="operacional"),
                MonitoredService(name="faturamento", role="Lote de faturamento", owner_level="N2", status="operacional"),
                MonitoredService(name="gateway-pagamentos", role="Captura no PagNorte", owner_level="N2", status="operacional"),
                MonitoredService(name="correio", role="Fila de e-mail", owner_level="N1", status="operacional"),
                MonitoredService(name="portal-colaborador", role="Portal e borda web", owner_level="N1", status="operacional"),
            ]
        )
    if db.query(Ticket).count() == 0:
        sync_tickets(db, current)
    if db.query(LogEvent).count() == 0:
        ingest_directory(db, current.root / "data" / "sample_logs")
        detect_incidents(db)
    db.commit()


def reprocess_samples(db: Session, settings: Settings | None = None) -> dict:
    current = settings or get_settings()
    _prepare(current)
    db.query(Incident).delete(synchronize_session=False)
    db.query(LogEvent).delete(synchronize_session=False)
    db.commit()
    stats = ingest_directory(db, current.root / "data" / "sample_logs")
    created = detect_incidents(db)
    db.commit()
    return {"inserted": stats["inserted"], "incidents": len(created), "files": stats["files"]}
