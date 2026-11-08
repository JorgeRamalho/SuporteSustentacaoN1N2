"""Leitura do host. Não dispara limpeza nem reinício."""

from __future__ import annotations

import time
from pathlib import Path

import psutil

_cache: dict[str, object] = {"key": None, "at": 0.0, "value": None}


def disk_mount(root: Path) -> Path:
    resolved = root.resolve()
    if resolved.drive:
        return Path(resolved.drive + "\\")
    return Path(resolved.anchor or "/")


def read_host(root: Path) -> dict:
    mount = disk_mount(root)
    key = str(mount)
    now = time.monotonic()
    cached = _cache["value"]
    if isinstance(cached, dict) and _cache["key"] == key and now - float(_cache["at"]) < 3:
        return dict(cached)
    try:
        disk = psutil.disk_usage(str(mount))
        memory = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=0.1)
        data = {
            "mount": key,
            "disk_percent": round(float(disk.percent), 1),
            "memory_percent": round(float(memory.percent), 1),
            "cpu_percent": round(float(cpu), 1),
        }
    except Exception:
        data = {
            "mount": "indisponivel",
            "disk_percent": 0.0,
            "memory_percent": 0.0,
            "cpu_percent": 0.0,
        }
    _cache["key"] = key
    _cache["at"] = now
    _cache["value"] = dict(data)
    return dict(data)
