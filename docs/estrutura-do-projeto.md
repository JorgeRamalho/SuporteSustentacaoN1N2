# Estrutura do repositório Sentinela

Padrão: **raiz enxuta** (entrada web + índice do projeto), com **cada arquivo na pasta da sua responsabilidade** e um `README.md` nas áreas de infraestrutura.

## Raiz (`/`)

Apenas o essencial.

| Arquivo | Função |
| --- | --- |
| `index.html` | Entrada do console (Live Server `:5500` e build Vite). |
| `README.md` | Visão geral, arquitetura e primeiros passos. |
| `package.json` | Atalhos npm (`start`, `docker:up`, …). |
| `.gitignore` | Exclusões de versionamento. |
| `.dockerignore` | Contexto Docker (raiz do repo). |
| `.editorconfig` | Estilo básico (UTF-8, fins de linha por tipo). |

| Pasta | Responsabilidade |
| --- | --- |
| `backend/` | API FastAPI e testes Python. |
| `config/` | Modelo `.env.example` (cópia vira `.env` na raiz). |
| `data/` | SQLite, amostras, relatórios, sandbox. |
| `deploy/` | `docker-compose.yml` e notas de orquestração. |
| `docs/` | Documentação e roteiros. |
| `frontend/` | Console React, Vite, nginx e bundles. |
| `jenkins/` | Imagem Jenkins + `Jenkinsfile`. |
| `scripts/` | Automação PowerShell e `Abrir-Sentinela.cmd`. |
| `.vscode/` | Tarefas ao abrir a pasta e Live Server. |

---

## `config/`

Ver [config/README.md](../config/README.md).

| Arquivo | Função |
| --- | --- |
| `.env.example` | Variáveis de ambiente documentadas. |
| `README.md` | Como copiar para `.env` na raiz. |

---

## `deploy/`

Ver [deploy/README.md](../deploy/README.md).

| Arquivo | Função |
| --- | --- |
| `docker-compose.yml` | Serviços `api`, `web`, perfil `jenkins`. |
| `README.md` | Comandos `npm run docker:*`. |

---

## `jenkins/`

Ver [jenkins/README.md](../jenkins/README.md).

| Arquivo | Função |
| --- | --- |
| `Dockerfile` | Agente LTS + Python + Node. |
| `Jenkinsfile` | Pipeline CI (`Script Path` = `jenkins/Jenkinsfile`). |
| `README.md` | Como criar o job e subir com Compose. |

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
| `Abrir-Sentinela.cmd` | Atalho Windows (equivalente a `npm run abrir`). |

---

## `docs/`

Ver [docs/README.md](./README.md).

| Arquivo | Função |
| --- | --- |
| `estrutura-do-projeto.md` | Este mapa. |
| `COMO-USAR.txt` | Passos mínimos no editor. |
| `roteiro-entrevista.md` | Demonstração guiada. |
| `README.md` | Índice da pasta. |

---

## `backend/`

| Caminho | Função |
| --- | --- |
| `requirements.txt` | Dependências Python. |
| `pytest.ini` | Configuração pytest. |
| `Dockerfile` | Imagem `api` no Compose. |
| `app/main.py` | FastAPI, rotas e estáticos do build. |
| `app/routes.py` | Endpoints REST. |
| `app/models.py` / `schemas.py` | ORM e validação. |
| `app/config.py` / `database.py` | Settings (lê `.env` na raiz) e DB. |
| `app/cli.py` | Comandos `logs`, `monitor`, `report`. |
| `app/services/*.py` | Domínio (logs, SLA, providers, automação, …). |
| `tests/` | Suíte pytest. |

---

## `frontend/`

| Caminho | Função |
| --- | --- |
| `package.json` | Vite, `live-server`, bundles. |
| `vite.config.js` | Dev/build (índice HTML na raiz do repo). |
| `vite.live.config.js` | Bundle estático `live-dist/`. |
| `live-bootstrap.js` | Loader Live Server vs Vite dev. |
| `nginx.conf` / `Dockerfile` | Container `web`. |
| `src/main.jsx`, `App.jsx` | Entrada React. |
| `src/api.js`, `format.js`, `ui.jsx`, `useResource.js` | Base da UI. |
| `src/components/` | Formulários compartilhados. |
| `src/panels/` | Abas do console. |
| `public/` | Arquivos públicos no dev. |
| `live-dist/` | Saída `npm run live:bundle`. |
| `dist/` | Saída `npm run build`. |

---

## `data/`

| Caminho | Função |
| --- | --- |
| `sentinela.db` | SQLite do laboratório. |
| `sample_logs/*.log` | Amostras para coleta. |
| `reports/` | Exportações e relatórios SLA. |
| `sandbox/temp/` | Alvo único de limpeza (com travas). |

---

## `.vscode/`

| Arquivo | Função |
| --- | --- |
| `settings.json` | Live Server na raiz (`/`) e porta 5500. |
| `tasks.json` | Garantir ambiente ao abrir + atalhos de build/API. |
| `extensions.json` | Recomenda extensão Live Server. |

---

## Fluxos principais

```text
npm start | npm run abrir
    → scripts/*.ps1
    → http://127.0.0.1:5500/index.html

npm run docker:up
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
| Docker / Compose | `deploy/` |
| CI Jenkins | `jenkins/` |
| Variável de ambiente documentada | `config/.env.example` |
| Entrada HTML do operador | só `index.html` na raiz |
