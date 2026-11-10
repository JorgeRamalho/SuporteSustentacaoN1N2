# Deploy (Docker Compose e nuvem)

Orquestração local da API, do console nginx, Jenkins opcional e artefatos de publicação.

| Arquivo | Função |
| --- | --- |
| `docker-compose.yml` | Serviços `api`, `web` e perfil `jenkins`. |
| `render.yaml` | Blueprint da API no Render (disco SQLite em `/app/data`). |
| `vercel.json` | Proxy de `/api`, `/docs`, OpenAPI para a URL do Render. |

## Docker local

Na raiz do repositório:

```powershell
npm --prefix config run docker:up
npm --prefix config run docker:jenkins
```

Equivalente:

```powershell
docker compose -f deploy/docker-compose.yml up --build
docker compose -f deploy/docker-compose.yml --profile jenkins up --build
```

O **contexto de build** é a raiz do repo (`..` relativo a esta pasta). O `.dockerignore` continua na raiz.

## Render (Blueprint)

O arquivo canônico é **`deploy/render.yaml`**. O painel Render, ao importar um Blueprint, procura `render.yaml` na **raiz** do Git.

Opções:

1. **Blueprint:** copie temporariamente `deploy/render.yaml` para a raiz antes de conectar o repositório (e mantenha os dois sincronizados), ou
2. **Manual:** crie o Web Service com `backend/Dockerfile`, health check `/api/health` e disco em `/app/data` conforme este arquivo.

## Vercel (proxy da API)

O arquivo canônico é **`deploy/vercel.json`**. A Vercel lê `vercel.json` na raiz do projeto publicado.

1. Edite as URLs `SUBSTITUA-PELA-URL-DA-SUA-API` neste arquivo.
2. Para deploy Git, copie para a raiz como `vercel.json` **ou** cadastre os mesmos rewrites no dashboard da Vercel.

Guia completo: [docs/deploy-publicacao.md](../docs/deploy-publicacao.md).
