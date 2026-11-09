"""Corpos de entrada da API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, field_validator


class ScanRequest(BaseModel):
    directory: str | None = None


class AutomationRequest(BaseModel):
    disk_percent: float | None = None
    memory_percent: float | None = None

    @field_validator("disk_percent", "memory_percent")
    @classmethod
    def bounded(cls, value: float | None) -> float | None:
        if value is None:
            return None
        if not 0 <= value <= 100:
            raise ValueError("Informe um percentual entre 0 e 100.")
        return value


class IncidentCreate(BaseModel):
    title: str
    symptom: str
    severity: Literal["critico", "alto", "medio", "baixo", "baixa", "media", "alta"] = "medio"

    @field_validator("title", "symptom")
    @classmethod
    def filled(cls, value: str) -> str:
        text = " ".join(value.split())
        if not text:
            raise ValueError("Preencha título e sintoma.")
        return text

    @field_validator("title")
    @classmethod
    def title_length(cls, value: str) -> str:
        if len(value) > 180:
            raise ValueError("O título aceita até 180 caracteres.")
        return value


class IncidentUpdate(BaseModel):
    status: Literal["aberto", "em_analise", "resolvido"]


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Literal["N1", "N2", "N3"] = "N1"
    sector: Literal["Suporte", "DEV", "Segurança", "IA"] = "Suporte"

    @field_validator("name")
    @classmethod
    def name_filled(cls, value: str) -> str:
        text = " ".join(value.split())
        if not text:
            raise ValueError("Informe o nome.")
        return text

    @field_validator("email")
    @classmethod
    def email_filled(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Informe o e-mail.")
        return text

    @field_validator("password")
    @classmethod
    def password_filled(cls, value: str) -> str:
        if not value:
            raise ValueError("Informe a senha.")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email_filled(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Informe o e-mail.")
        return text

    @field_validator("password")
    @classmethod
    def password_filled(cls, value: str) -> str:
        if not value:
            raise ValueError("Informe a senha.")
        return value


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("current_password", "new_password")
    @classmethod
    def password_filled(cls, value: str) -> str:
        if not value:
            raise ValueError("Informe a senha.")
        return value


class RecoverRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email_filled(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Informe o e-mail.")
        return text

    @field_validator("password")
    @classmethod
    def password_filled(cls, value: str) -> str:
        if not value:
            raise ValueError("Informe a nova senha.")
        return value


class ReportRequest(BaseModel):
    days: int = 7
    provider: Literal["jira", "servicenow", "glpi", "zendesk"] | None = None

    @field_validator("days")
    @classmethod
    def window(cls, value: int) -> int:
        if not 1 <= value <= 90:
            raise ValueError("A janela deve ficar entre 1 e 90 dias.")
        return value
