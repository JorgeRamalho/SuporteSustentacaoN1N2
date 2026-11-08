"""Linha de comando da operação."""

from __future__ import annotations

import argparse
import sys

from app.bootstrap import bootstrap
from app.config import get_settings
from app.database import session_scope
from app.services.automation import run_check
from app.services.exporters import logs_csv, logs_json
from app.services.incident_engine import detect_incidents
from app.services.log_collector import ingest_directory
from app.services.paths import resolve_cli_log_dir
from app.services.reports import weekly_report
from app.services.seed import reprocess_samples
from app.models import LogEvent


def _stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                continue


def _logs(directory: str | None, export: str | None) -> None:
    settings = get_settings()
    target = resolve_cli_log_dir(directory, settings)
    with session_scope() as db:
        stats = ingest_directory(db, target)
        print(f"Diretório: {target}")
        print(f"Arquivos: {stats['files']}")
        print(f"Linhas lidas: {stats['read_lines']}")
        print(f"Eventos críticos: {stats['kept']}")
        print(f"Novos: {stats['inserted']}")
        if export:
            rows = db.query(LogEvent).order_by(LogEvent.logged_at).all()
            folder = settings.root / "data" / "reports"
            folder.mkdir(parents=True, exist_ok=True)
            if export == "json":
                path = folder / "erros-sentinela.json"
                path.write_text(logs_json(rows), encoding="utf-8")
            else:
                path = folder / "erros-sentinela.csv"
                path.write_text(logs_csv(rows), encoding="utf-8")
            print(f"Exportado: {path}")


def main(argv: list[str] | None = None) -> int:
    _stdio()
    parser = argparse.ArgumentParser(prog="sentinela", description="Sustentação N1/N2")
    commands = parser.add_subparsers(dest="command", required=True)

    logs = commands.add_parser("logs", help="Lê logs e guarda ERROR, FATAL e Exception")
    logs.add_argument("--dir", default=None)
    logs.add_argument("--export", choices=("csv", "json"), default=None)

    monitor = commands.add_parser("monitor", help="Lê disco e memória. O padrão é simular.")
    monitor.add_argument("--disk", type=float, default=None)
    monitor.add_argument("--memory", type=float, default=None)

    commands.add_parser("detect", help="Agrupa erros repetidos em incidentes")
    commands.add_parser("reprocess", help="Relê as amostras e reabre os incidentes")
    report = commands.add_parser("report", help="Gera o relatório semanal de SLA")
    report.add_argument("--days", type=int, default=7)

    args = parser.parse_args(argv)
    bootstrap()
    settings = get_settings()
    print(f"Modo seguro: {'sim' if settings.simulate else 'não'}")

    if args.command == "logs":
        _logs(args.dir, args.export)
        return 0
    if args.command == "monitor":
        with session_scope() as db:
            result = run_check(db, settings, args.disk, args.memory)
        print(f"Disco no cenário: {result['scenario']['disk_percent']}%")
        print(f"Memória no cenário: {result['scenario']['memory_percent']}%")
        if not result["actions"]:
            print("Nenhuma ação proposta.")
        for action in result["actions"]:
            print(f"{action['status']}: {action['kind']} -> {action['detail']}")
        return 0
    if args.command == "detect":
        with session_scope() as db:
            created = detect_incidents(db)
            print(f"Incidentes novos: {len(created)}")
        return 0
    if args.command == "reprocess":
        with session_scope() as db:
            result = reprocess_samples(db, settings)
        print(f"Eventos novos: {result['inserted']}")
        print(f"Incidentes: {result['incidents']}")
        return 0
    with session_scope() as db:
        result = weekly_report(db, settings, args.days)
    print(result["preview"])
    print(f"Arquivo: {result['files']['txt']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
