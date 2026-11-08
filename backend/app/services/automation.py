"""Limpeza só dentro da sandbox. Reinício de SO não é acoplado."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import Settings
from app.errors import RealActionBlocked, UnsafePathError
from app.models import AutomationRun, Incident
from app.services.host import read_host
from app.services.notifiers import notify
from app.timeutil import utcnow


@dataclass
class CleanupResult:
    planned: int
    removed: int
    executed: bool


@dataclass
class RestartResult:
    service: str
    executed: bool
    detail: str


def assert_inside(path: Path, root: Path) -> Path:
    resolved = path.resolve()
    try:
        resolved.relative_to(root.resolve())
    except ValueError as exc:
        raise UnsafePathError(f"Caminho fora da sandbox: {resolved}") from exc
    return resolved


def _temp_files(sandbox: Path) -> list[Path]:
    if not sandbox.exists():
        return []
    files: list[Path] = []
    for path in sandbox.rglob("*"):
        if path.is_file() and path.name != ".gitkeep":
            files.append(path)
    return files


def execute_cleanup(sandbox: Path, simulate: bool, allow_real: bool) -> CleanupResult:
    root = sandbox.resolve()
    if not root.exists() or not root.is_dir():
        raise UnsafePathError("A sandbox de temporários não existe.")
    safe = [assert_inside(path, root) for path in _temp_files(root)]
    if simulate:
        return CleanupResult(planned=len(safe), removed=0, executed=False)
    if not allow_real:
        raise RealActionBlocked(
            "Limpeza real bloqueada. O laboratório permanece em SIMULATE=true."
        )
    for path in safe:
        assert_inside(path, root)
        path.unlink(missing_ok=True)
    return CleanupResult(planned=len(safe), removed=len(safe), executed=True)


def execute_restart(service: str, simulate: bool, allow_real: bool) -> RestartResult:
    if simulate:
        return RestartResult(
            service=service,
            executed=False,
            detail="Reinício apenas registrado. Nenhum processo foi alterado.",
        )
    if not allow_real:
        raise RealActionBlocked("Reinício real bloqueado pela trava do laboratório.")
    return RestartResult(
        service=service,
        executed=False,
        detail="O executor não envia comando ao sistema operacional. O registro fica para o operador.",
    )


def service_for_restart(db: Session) -> tuple[str, str]:
    order = {"P1": 0, "P2": 1, "P3": 2, "P4": 3}
    incidents = db.query(Incident).filter(Incident.status != "resolvido").all()
    incidents.sort(key=lambda item: (order.get(item.severity, 9), item.code))
    if incidents:
        chosen = incidents[0]
        return chosen.service_name, f"Serviço com incidente {chosen.severity} ainda aberto."
    return "api-pedidos", "Não há incidente aberto. O ensaio usa api-pedidos como candidato."


def _alert_text(disk_high: bool, mem_high: bool, disk: float, memory: float, actions: list[dict], simulate: bool) -> str:
    prefix = "[SENTINELA][SIMULADO]" if simulate else "[SENTINELA]"
    pieces = []
    if disk_high:
        pieces.append(f"disco em {disk:.0f}%")
    if mem_high:
        pieces.append(f"memória em {memory:.0f}%")
    steps = "; ".join(f"{item['kind']} -> {item['target']}" for item in actions)
    return (
        f"{prefix} {' e '.join(pieces)} acima do limiar. "
        f"Ações: {steps}. Nenhum serviço do sistema operacional foi alterado."
    )


def run_check(db: Session, settings: Settings, disk_percent: float | None, memory_percent: float | None) -> dict:
    ensure_sandbox(settings)
    host = read_host(settings.root)
    scenario_disk = host["disk_percent"] if disk_percent is None else float(disk_percent)
    scenario_mem = host["memory_percent"] if memory_percent is None else float(memory_percent)
    pressure = disk_percent is not None or memory_percent is not None
    disk_high = scenario_disk >= settings.disk_threshold
    mem_high = scenario_mem >= settings.memory_threshold
    sandbox = settings.root / "data" / "sandbox"
    actions: list[dict] = []

    if disk_high:
        cleanup = execute_cleanup(sandbox, settings.simulate, settings.allow_real_actions)
        actions.append(
            {
                "kind": "limpar_temporarios",
                "target": "data/sandbox",
                "status": "executado" if cleanup.executed else "simulado",
                "detail": (
                    f"{cleanup.planned} {'arquivo' if cleanup.planned == 1 else 'arquivos'} na sandbox. "
                    f"Removidos: {cleanup.removed}. A limpeza não sai de data/sandbox."
                ),
            }
        )
    if mem_high:
        service, reason = service_for_restart(db)
        restart = execute_restart(service, settings.simulate, settings.allow_real_actions)
        actions.append(
            {
                "kind": "reiniciar_servico",
                "target": service,
                "status": "simulado" if settings.simulate else "nao_acoplado",
                "detail": f"{reason} {restart.detail}",
            }
        )

    alert = None
    if actions:
        message = _alert_text(disk_high, mem_high, scenario_disk, scenario_mem, actions, settings.simulate)
        alert = notify(db, settings, message)
        detail = message
        status = "acao"
    else:
        detail = "Host dentro dos limiares. Nenhuma limpeza ou reinício foi proposto."
        status = "ok"

    db.add(
        AutomationRun(
            kind="verificacao",
            target=str(host["mount"]),
            simulate=settings.simulate,
            status=status,
            detail=detail,
            created_at=utcnow(),
        )
    )
    for action in actions:
        db.add(
            AutomationRun(
                kind=action["kind"],
                target=action["target"],
                simulate=settings.simulate,
                status=action["status"],
                detail=action["detail"],
                created_at=utcnow(),
            )
        )
    db.commit()
    return {
        "simulate": settings.simulate,
        "pressure": pressure,
        "host": host,
        "scenario": {"disk_percent": scenario_disk, "memory_percent": scenario_mem},
        "thresholds": {
            "disk_percent": settings.disk_threshold,
            "memory_percent": settings.memory_threshold,
        },
        "actions": actions,
        "alert": None
        if alert is None
        else {
            "channel": alert.channel,
            "simulate": alert.simulate,
            "status": alert.status,
            "message": alert.message,
        },
    }


def ensure_sandbox(settings: Settings) -> Path:
    folder = settings.root / "data" / "sandbox" / "temp"
    folder.mkdir(parents=True, exist_ok=True)
    keep = folder / ".gitkeep"
    if not keep.exists():
        keep.write_text("", encoding="utf-8")
    for name in ("cache-sessao.tmp", "export-parcial.tmp", "thumb-old.tmp"):
        path = folder / name
        if not path.exists():
            path.write_text("temporario de laboratorio\n", encoding="utf-8")
    return folder.parent
