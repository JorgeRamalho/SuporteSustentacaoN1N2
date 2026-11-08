"""Sobe o banco e a carga de demonstração."""

from __future__ import annotations

import logging

from app.database import init_db, session_scope
from app.services.seed import seed_if_empty


def bootstrap() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    init_db()
    with session_scope() as db:
        seed_if_empty(db)
