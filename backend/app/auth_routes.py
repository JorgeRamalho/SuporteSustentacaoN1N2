"""Rotas públicas de cadastro, login e recuperação de senha."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import LoginRequest, RecoverRequest, RegisterRequest
from app.services.auth import (
    dump_user,
    login_user,
    logout_user,
    optional_token,
    recover_password,
    register_user,
    require_user,
)

router = APIRouter(prefix="/auth", tags=["Acesso"])


@router.post("/register", summary="Cadastrar operador", description="Cria o cadastro e já abre a sessão do Sentinela.")
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    return register_user(db, payload.name, payload.email, payload.password, payload.role, payload.sector)


@router.post("/login", summary="Entrar", description="Libera o console só para quem já está cadastrado.")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    return login_user(db, payload.email, payload.password)


@router.post("/recover", summary="Redefinir senha", description="Troca a senha do e-mail cadastrado e encerra as sessões anteriores.")
def recover(payload: RecoverRequest, db: Session = Depends(get_db)) -> dict:
    return recover_password(db, payload.email, payload.password)


@router.post("/logout", summary="Sair", description="Encerra a sessão atual.")
def logout(db: Session = Depends(get_db), token: str | None = Depends(optional_token)) -> dict:
    return logout_user(db, token)


@router.get("/me", summary="Quem está na sessão", description="Confirma o operador autenticado.")
def me(user=Depends(require_user)) -> dict:
    return dump_user(user)
