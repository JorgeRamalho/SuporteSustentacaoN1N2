"""Cadastro, sessão e senha do operador. Sem biblioteca extra: PBKDF2 da stdlib."""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import timedelta

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import SentinelaError
from app.models import AuthSession, User
from app.timeutil import as_utc, utcnow

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_ROLES = frozenset({"N1", "N2", "N3"})
_SECTORS = frozenset({"Suporte", "DEV", "Segurança", "IA"})
_ITERATIONS = 120_000
_SESSION_DAYS = 7
bearer = HTTPBearer(auto_error=False)


def normalize_email(value: str) -> str:
    return value.strip().lower()


def validate_credentials(name: str | None, email: str, password: str) -> tuple[str | None, str]:
    cleaned_name = " ".join((name or "").split()) or None
    if name is not None:
        if not cleaned_name:
            raise SentinelaError("Informe o nome.")
        if len(cleaned_name) < 2 or len(cleaned_name) > 120:
            raise SentinelaError("O nome deve ter entre 2 e 120 caracteres.")
    address = normalize_email(email)
    if not _EMAIL.match(address) or len(address) > 180:
        raise SentinelaError("Informe um e-mail válido.")
    if len(password) < 8:
        raise SentinelaError("A senha deve ter pelo menos 8 caracteres.")
    if len(password) > 128:
        raise SentinelaError("A senha aceita até 128 caracteres.")
    return cleaned_name, address


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt, digest = stored.split("$", 3)
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    try:
        rounds = int(iterations)
        expected = bytes.fromhex(digest)
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), rounds)
    except ValueError:
        return False
    return hmac.compare_digest(candidate, expected)


def validate_profile(role: str, sector: str) -> tuple[str, str]:
    cleaned_role = (role or "").strip().upper()
    cleaned_sector = (sector or "").strip()
    if cleaned_role not in _ROLES:
        raise SentinelaError("Selecione a função: N1, N2 ou N3.")
    if cleaned_sector not in _SECTORS:
        raise SentinelaError("Selecione o setor: Suporte, DEV, Segurança ou IA.")
    return cleaned_role, cleaned_sector


def dump_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "sector": user.sector,
    }


def dump_session(user: User, token: str) -> dict:
    return {"token": token, "user": dump_user(user)}


def _issue_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            token=token,
            user_id=user.id,
            created_at=utcnow(),
            expires_at=utcnow() + timedelta(days=_SESSION_DAYS),
        )
    )
    return token


def _drop_sessions(db: Session, user_id: int) -> None:
    db.query(AuthSession).filter(AuthSession.user_id == user_id).delete()


def register_user(db: Session, name: str, email: str, password: str, role: str, sector: str) -> dict:
    cleaned_name, address = validate_credentials(name, email, password)
    cleaned_role, cleaned_sector = validate_profile(role, sector)
    if db.query(User).filter(User.email == address).first() is not None:
        raise SentinelaError("Este e-mail já está cadastrado. Entre com login e senha.")
    user = User(
        name=cleaned_name,
        email=address,
        password_hash=hash_password(password),
        role=cleaned_role,
        sector=cleaned_sector,
        created_at=utcnow(),
    )
    db.add(user)
    db.flush()
    token = _issue_session(db, user)
    db.commit()
    db.refresh(user)
    return dump_session(user, token)


def login_user(db: Session, email: str, password: str) -> dict:
    address = normalize_email(email)
    user = db.query(User).filter(User.email == address).first()
    if user is None:
        raise SentinelaError("Usuário não cadastrado. Verifique o e-mail ou crie um cadastro.")
    if not verify_password(password, user.password_hash):
        raise SentinelaError("Senha incorreta.")
    token = _issue_session(db, user)
    db.commit()
    return dump_session(user, token)


def recover_password(db: Session, email: str, password: str) -> dict:
    _, address = validate_credentials(None, email, password)
    user = db.query(User).filter(User.email == address).first()
    if user is None:
        raise SentinelaError("Usuário não cadastrado. Verifique o e-mail ou crie um cadastro.")
    user.password_hash = hash_password(password)
    _drop_sessions(db, user.id)
    token = _issue_session(db, user)
    db.commit()
    db.refresh(user)
    return dump_session(user, token)


def change_password(db: Session, user: User, current_password: str, new_password: str) -> dict:
    if not verify_password(current_password, user.password_hash):
        raise SentinelaError("Senha atual incorreta.")
    validate_credentials(None, user.email, new_password)
    user.password_hash = hash_password(new_password)
    db.commit()
    return {"ok": True}


def logout_user(db: Session, token: str | None) -> dict:
    if token:
        db.query(AuthSession).filter(AuthSession.token == token).delete()
        db.commit()
    return {"ok": True}


def user_by_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    row = db.query(AuthSession).filter(AuthSession.token == token).first()
    if row is None:
        return None
    if as_utc(row.expires_at) <= utcnow():
        db.delete(row)
        db.commit()
        return None
    return db.get(User, row.user_id)


def _token_from(creds: HTTPAuthorizationCredentials | None) -> str | None:
    if creds is None or creds.scheme.lower() != "bearer":
        return None
    token = creds.credentials.strip()
    return token or None


def require_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    user = user_by_token(db, _token_from(creds))
    if user is None:
        raise HTTPException(status_code=401, detail="Entre com login e senha para acessar o Sentinela.")
    return user


def optional_token(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str | None:
    return _token_from(creds)
