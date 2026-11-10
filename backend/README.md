# Backend (API FastAPI)

| Arquivo / pasta | Função |
| --- | --- |
| `requirements.txt` | Dependências pip. |
| `pytest.ini` | Descoberta e opções do pytest. |
| `Dockerfile` | Imagem `api` usada em `deploy/docker-compose.yml` e Render. |
| `app/main.py` | Aplicação FastAPI, middleware, montagem de estáticos. |
| `app/routes.py` | Rotas REST do domínio. |
| `app/auth_routes.py` | Login, cadastro, sessão. |
| `app/models.py` | Modelos SQLAlchemy. |
| `app/schemas.py` | Schemas Pydantic. |
| `app/config.py` | Settings (`.env` na raiz do repo). |
| `app/database.py` | Engine e sessão SQLite/Postgres. |
| `app/bootstrap.py` | Inicialização na subida. |
| `app/cli.py` | CLI `logs`, `monitor`, `report`. |
| `app/errors.py` | Exceções HTTP padronizadas. |
| `app/timeutil.py` | Helpers de data/hora. |
| `app/services/` | Regras de negócio (ver tabela abaixo). |
| `tests/` | Testes automatizados. |

## `app/services/`

| Módulo | Função |
| --- | --- |
| `log_collector.py` | Coleta e filtro de logs. |
| `incident_engine.py` | Classificação e roteamento N1/N2. |
| `automation.py` | Ensaio de limpeza (sandbox). |
| `providers.py` | Integrações ITSM (demo + real). |
| `sla.py` | Métricas e conformidade. |
| `reports.py` / `report_queries.py` | Relatórios e consultas. |
| `dashboard.py` | Agregados do painel. |
| `auth.py` / `access.py` | Autenticação e autorização. |
| `seed.py` | Dados iniciais do laboratório. |
| `paths.py` | Caminhos seguros em `data/`. |
| `host.py` / `status.py` | Saúde do host e serviços. |
| `notifiers.py` | Alertas simulados (e-mail, chat). |
| `exporters.py` / `serialize.py` | Exportação CSV/JSON. |
| `matching.py` / `signatures.py` | Agrupamento de incidentes. |

## Testes

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```
