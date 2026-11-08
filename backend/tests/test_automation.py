import os
from pathlib import Path

import pytest

from app.config import Settings
from app.errors import RealActionBlocked, UnsafePathError
from app.services.automation import execute_cleanup, execute_restart
from app.services.paths import resolve_cli_log_dir


def test_simulacao_nao_apaga(tmp_path: Path):
    sandbox = tmp_path / "sandbox"
    sandbox.mkdir()
    target = sandbox / "cache.tmp"
    target.write_text("x", encoding="utf-8")
    result = execute_cleanup(sandbox, simulate=True, allow_real=False)
    assert result.removed == 0
    assert result.planned == 1
    assert target.exists()


def test_real_so_apaga_dentro_da_sandbox(tmp_path: Path):
    sandbox = tmp_path / "sandbox"
    inner = sandbox / "temp"
    inner.mkdir(parents=True)
    target = inner / "cache.tmp"
    target.write_text("x", encoding="utf-8")
    outside = tmp_path / "segredo.tmp"
    outside.write_text("y", encoding="utf-8")
    result = execute_cleanup(sandbox, simulate=False, allow_real=True)
    assert result.removed == 1
    assert not target.exists()
    assert outside.exists()


def test_real_bloqueado_sem_a_segunda_trava(tmp_path: Path):
    sandbox = tmp_path / "sandbox"
    sandbox.mkdir()
    target = sandbox / "cache.tmp"
    target.write_text("x", encoding="utf-8")
    with pytest.raises(RealActionBlocked):
        execute_cleanup(sandbox, simulate=False, allow_real=False)
    assert target.exists()


def test_reinicio_nao_chama_o_sistema_operacional():
    source = Path(execute_restart.__code__.co_filename).read_text(encoding="utf-8")
    assert "subprocess" not in source
    assert "os.system" not in source
    simulated = execute_restart("api-pedidos", simulate=True, allow_real=False)
    assert simulated.executed is False
    with pytest.raises(RealActionBlocked):
        execute_restart("Spooler", simulate=False, allow_real=False)
    recorded = execute_restart("api-pedidos", simulate=False, allow_real=True)
    assert recorded.executed is False


def test_cli_recusa_raiz_e_system32(tmp_path: Path):
    settings = Settings(sentinela_root=str(tmp_path), simulate=True)
    with pytest.raises(UnsafePathError):
        resolve_cli_log_dir(str(Path(tmp_path.anchor)), settings)
    if os.name == "nt":
        with pytest.raises(UnsafePathError):
            resolve_cli_log_dir(r"C:\Windows\System32", settings)


def test_arquivo_fora_nao_e_sandbox(tmp_path: Path):
    outside = tmp_path / "segredo.tmp"
    outside.write_text("x", encoding="utf-8")
    with pytest.raises(UnsafePathError):
        execute_cleanup(outside, simulate=False, allow_real=True)
    assert outside.exists()
