from datetime import datetime, timezone

from app.services.exporters import logs_csv
from app.services.log_collector import list_log_files, parse_log_text
from app.services.signatures import signature_of


def test_assinatura_ignora_numeros():
    first = signature_of("Connection pool exhausted for oracle-erp after 30s timeout")
    second = signature_of("Connection pool exhausted for oracle-erp after 31s timeout")
    assert first == second


def test_parser_guarda_so_o_que_importa():
    text = """2026-11-07 08:01:12 INFO [db] healthcheck ok
2026-11-07 08:13:44 ERROR [db] Connection pool exhausted after 30s timeout
2026-11-07 08:14:02 FATAL [billing] OutOfMemoryError: Java heap space
    at com.empresa.Faturamento.process
Caused by: java.lang.OutOfMemoryError: Java heap space
2026-11-07 09:00:00 WARN [api] fila grande
"""
    events = parse_log_text(text)
    assert [event.level for event in events] == ["ERROR", "FATAL"]
    assert "Caused by" in events[1].message
    assert events[1].service_name == "faturamento"
    assert events[0].service_name == "oracle-erp"


def test_lista_apenas_arquivos_de_log(tmp_path):
    (tmp_path / "notas.csv").write_text("a,b", encoding="utf-8")
    (tmp_path / "app.log").write_text("ok", encoding="utf-8")
    (tmp_path / "enorme.log").write_text("x" * 30, encoding="utf-8")
    found = list_log_files(tmp_path, max_bytes=10)
    assert [path.name for path in found] == ["app.log"]


def test_csv_neutraliza_formula():
    class Row:
        logged_at = datetime(2026, 11, 7, tzinfo=timezone.utc)
        level = "ERROR"
        service_name = "api-pedidos"
        source = "a.log"
        signature = "sig"
        message = "=cmd()"

    assert "'=cmd()" in logs_csv([Row()])
