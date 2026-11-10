# Configuração de ambiente

| Arquivo | Função |
| --- | --- |
| `.env.example` | Modelo de variáveis (SMTP, integrações, travas de automação). |
| `package.json` | Atalhos npm do monorepo (a raiz visível só tem `index.html`). |
| `Suporte-N1N2.code-workspace` | Abre este repo + projeto Python relacionado no Cursor. |

A API lê **`.env` na raiz do repositório** (`backend/app/config.py`). O exemplo fica aqui para não poluir a raiz.

```powershell
copy config\.env.example .env
```

## Atalhos npm

Sempre a partir da **raiz do repositório**:

```powershell
npm --prefix config start
npm --prefix config run abrir
npm --prefix config run api
npm --prefix config run docker:up
```
