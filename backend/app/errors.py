"""Erros de domínio exibidos ao operador, sem detalhe interno."""


class SentinelaError(Exception):
    """Falha prevista, com mensagem segura para a interface."""


class UnsafePathError(SentinelaError):
    """O caminho pedido sai da área permitida."""


class RealActionBlocked(SentinelaError):
    """A ação alteraria o ambiente e as travas não autorizam isso."""


class ProviderError(SentinelaError):
    """A ferramenta de chamados não devolveu um payload utilizável."""
