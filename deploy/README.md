# Deploy (Docker Compose)

Orquestração local da API, do console nginx e do Jenkins opcional.

| Arquivo | Função |
| --- | --- |
| `docker-compose.yml` | Serviços `api`, `web` e perfil `jenkins`. |

## Comandos

Na raiz do repositório:

```powershell
npm run docker:up
npm run docker:jenkins
```

Equivalente:

```powershell
docker compose -f deploy/docker-compose.yml up --build
docker compose -f deploy/docker-compose.yml --profile jenkins up --build
```

O **contexto de build** é a raiz do repo (`..` relativo a esta pasta). O `.dockerignore` continua na raiz.
