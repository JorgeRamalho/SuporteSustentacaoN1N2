# Jenkins (laboratório)

| Arquivo | Função |
| --- | --- |
| `Dockerfile` | Imagem LTS com Python 3 e Node para executar o pipeline. |
| `Jenkinsfile` | Pipeline: pytest, build do frontend, relatório SLA opcional. |

## Configurar o job

1. **Nova item** → Pipeline.
2. **Pipeline script from SCM** → repositório Git (ou cópia em `/workspace` no Compose).
3. **Script Path:** `jenkins/Jenkinsfile` (não deixe o padrão `Jenkinsfile` na raiz).

Subir o Jenkins com Docker:

```powershell
npm run docker:jenkins
```

A senha inicial: `docker compose -f deploy/docker-compose.yml logs jenkins`.
