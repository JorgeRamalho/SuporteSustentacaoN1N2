# Configuração de ambiente

| Arquivo | Função |
| --- | --- |
| `.env.example` | Modelo de variáveis (SMTP, integrações, travas de automação). |

A API lê **`.env` na raiz do repositório** (`backend/app/config.py`). O exemplo fica aqui para não poluir a raiz.

```powershell
copy config\.env.example .env
```
