# Estrutura do repositório Sentinela

Padrão: **raiz com um único arquivo web** (`index.html`), **configuração em pastas nomeadas** e **`README.md` em cada área**.

Mapa de princípios: [organizacao-e-padroes.md](./organizacao-e-padroes.md).

## Raiz (`/`)

| Item | Função |
| --- | --- |
| `index.html` | Entrada do console (Live Server `:5500`, Pages, Vercel estático). |
| `.gitignore` | Exclusões de versionamento. |
| `.dockerignore` | Contexto Docker (build a partir da raiz). |
| `.editorconfig` | UTF-8, fins de linha e indentação base. |
| `.env` | Variáveis locais (cópia de `config/.env.example`; não versionado). |

| Pasta oculta | Função |
| --- | --- |
| `.github/workflows/` | CI (bundle GitHub Pages). |
| `.vscode/` | Live Server, extensões recomendadas. |

Não há outros arquivos soltos na raiz — documentação em `docs/`, npm em `config/`, deploy em `deploy/`.

---

## `config/`

Ver [config/README.md](../config/README.md).

| Arquivo | Função |
| --- | --- |
| `.env.example` | Variáveis de ambiente documentadas. |
| `package.json` | Atalhos npm (`start`, `docker:up`, …) — use `npm --prefix config`. |
| `Suporte-N1N2.code-workspace` | Workspace Cursor com este repo + projeto Python irmão. |
| `README.md` | Como copiar `.env` e rodar npm. |

---

## `deploy/`

Ver [deploy/README.md](../deploy/README.md).

| Arquivo | Função |
| --- | --- |
| `docker-compose.yml` | Serviços `api`, `web`, perfil `jenkins`. |
| `render.yaml` | Blueprint Render (API + disco SQLite). |
| `vercel.json` | Rewrites `/api` → URL do Render. |
| `README.md` | Compose, Render e Vercel. |

---

## `jenkins/`

Ver [jenkins/README.md](../jenkins/README.md).

| Arquivo | Função |
| --- | --- |
| `Dockerfile` | Agente LTS + Python + Node. |
| `Jenkinsfile` | Pipeline CI (`Script Path` = `jenkins/Jenkinsfile`). |
| `README.md` | Job Jenkins e Compose. |

---

## `scripts/`

Ver [scripts/README.md](../scripts/README.md).

| Arquivo | Função |
| --- | --- |
| `config.ps1` | Portas e URL do console. |
| `garantir-ambiente.ps1` | API + bundle + live-server. |
| `garantir-api.ps1` / `subir-api.ps1` | Backend uvicorn. |
| `iniciar.ps1` / `abrir.ps1` | Mensagens e abertura do navegador. |
| `verificar.ps1` | pytest + build (espelho do Jenkins). |
| `export-demo.ps1` | Snapshot para GitHub Pages demo. |
| `live-console.cjs` | Utilitário do bundle live. |
| `Abrir-Sentinela.cmd` | Atalho Windows → `abrir.ps1`. |
| `Abrir-Lista-Chats.bat` | Abre a pasta do projeto no Cursor. |

---

## `docs/`

Ver [docs/README.md](./README.md).

| Arquivo | Função |
| --- | --- |
| `PROJETO.md` | Visão geral técnica (antigo README da raiz). |
| `organizacao-e-padroes.md` | Regras de pastas e raiz enxuta. |
| `estrutura-do-projeto.md` | Este mapa. |
| `deploy-publicacao.md` | Vercel, Render, persistência. |
| `COMO-USAR.txt` | Passos mínimos no editor. |
| `roteiro-entrevista.md` | Demonstração guiada. |
| `arquivo/` | Notas e relatórios auxiliares (não operacionais). |

---

## `backend/`

Ver [backend/README.md](../backend/README.md).

| Caminho | Função |
| --- | --- |
| `requirements.txt` | Dependências Python. |
| `pytest.ini` | Configuração pytest. |
| `Dockerfile` | Imagem `api` no Compose. |
| `app/main.py` | FastAPI, rotas e estáticos do build. |
| `app/routes.py` / `auth_routes.py` | Endpoints REST e auth. |
| `app/models.py` / `schemas.py` | ORM e validação. |
| `app/config.py` / `database.py` | Settings (lê `.env` na raiz) e DB. |
| `app/cli.py` | Comandos `logs`, `monitor`, `report`. |
| `app/services/*.py` | Domínio (logs, SLA, providers, automação, …). |
| `tests/` | Suíte pytest. |

---

## `frontend/`

Ver [frontend/README.md](../frontend/README.md).

| Caminho | Função |
| --- | --- |
| `package.json` | Vite, `live-server`, bundles. |
| `vite.config.js` | Dev/build (índice HTML na raiz do repo). |
| `vite.live.config.js` | Bundle estático `live-dist/`. |
| `live-bootstrap.js` | Loader Live Server vs Vite dev. |
| `index.html` | Redireciona para `../index.html`. |
| `sentinela-config.example.js` | Modelo de URL da API em produção. |
| `nginx.conf` / `Dockerfile` | Container `web`. |
| `demo/api-snapshot.json` | Modo demo (Pages). |
| `src/main.jsx`, `App.jsx` | Entrada React. |
| `src/panels/` | Abas do console. |
| `src/components/` | Formulários compartilhados. |
| `live-dist/` | Saída `npm run live:bundle` (versionada para Pages). |
| `dist/` | Saída `npm run build`. |

---

## `data/`

Ver [data/README.md](../data/README.md).

| Caminho | Função |
| --- | --- |
| `sentinela.db` | SQLite do laboratório. |
| `sample_logs/*.log` | Amostras para coleta. |
| `reports/` | Exportações e relatórios SLA. |
| `sandbox/temp/` | Alvo único de limpeza (com travas). |

---

## `.vscode/`

Ver [.vscode/README.md](../.vscode/README.md).

| Arquivo | Função |
| --- | --- |
| `settings.json` | Live Server na raiz (`/`) e porta 5500. |
| `extensions.json` | Recomenda Live Server. |

---

## Fluxos principais

```text
npm --prefix config start | scripts\Abrir-Sentinela.cmd
    → scripts/*.ps1
    → http://127.0.0.1:5500/index.html

npm --prefix config run docker:up
    → deploy/docker-compose.yml

Job Jenkins
    → jenkins/Jenkinsfile
```

---

## Onde colocar arquivo novo

| Tipo | Pasta |
| --- | --- |
| Código API | `backend/app/` |
| Código UI | `frontend/src/` |
| Dado gerado ou amostra | `data/` |
| Documentação | `docs/` |
| Script local | `scripts/` |
| Docker / Compose / nuvem | `deploy/` |
| CI Jenkins | `jenkins/` |
| Variável de ambiente documentada | `config/.env.example` |
| Entrada HTML do operador | só `index.html` na raiz |
