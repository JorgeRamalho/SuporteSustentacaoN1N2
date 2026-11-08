"""Configuração do laboratório. O padrão é não agir no sistema."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def detect_root() -> Path:
    env = os.getenv("SENTINELA_ROOT")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    repo = here.parents[2]
    if (repo / "backend" / "app").exists():
        return repo
    return here.parents[1]


def default_root() -> str:
    return str(detect_root())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    sentinela_root: str = Field(default_factory=default_root)
    database_url: str | None = None
    simulate: bool = True
    allow_real_actions: bool = False
    disk_threshold: float = 85
    memory_threshold: float = 90
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    slack_webhook_url: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "sentinela@empresa.local"
    report_email_to: str = "sustentacao@empresa.local"
    jira_base_url: str = ""
    jira_email: str = ""
    jira_token: str = ""
    servicenow_base_url: str = ""
    servicenow_token: str = ""
    glpi_base_url: str = ""
    glpi_token: str = ""
    zendesk_base_url: str = ""
    zendesk_email: str = ""
    zendesk_token: str = ""

    @property
    def root(self) -> Path:
        return Path(self.sentinela_root)


@lru_cache
def get_settings() -> Settings:
    return Settings()
