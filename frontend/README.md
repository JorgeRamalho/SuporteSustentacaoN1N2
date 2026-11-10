# Frontend (console React)

| Arquivo / pasta | Função |
| --- | --- |
| `package.json` / `package-lock.json` | Dependências Node (Vite, React, live-server). |
| `vite.config.js` | Dev server (5173); `root` = raiz do repo (`index.html`). |
| `vite.live.config.js` | Build do bundle estático em `live-dist/`. |
| `live-bootstrap.js` | Escolhe bundle (5500) ou fontes Vite (5173). |
| `index.html` | Redireciona para `../index.html` (entrada única na raiz). |
| `sentinela-config.example.js` | Modelo: URL da API em produção → copiar para `sentinela-config.js`. |
| `Dockerfile` / `nginx.conf` | Imagem `web` no Compose. |
| `demo/api-snapshot.json` | Dados fixos para GitHub Pages / demo sem API. |
| `live-dist/` | Bundle versionado (`live-bundle.js`, `.css`). |
| `dist/` | Build de produção Vite (não versionado). |
| `public/` | Assets servidos no dev. |
| `src/main.jsx` | Monta React em `#root`. |
| `src/App.jsx` | Layout e abas. |
| `src/api.js` | Cliente HTTP `/api`. |
| `src/auth.js` / `AuthScreen.jsx` | Sessão do operador. |
| `src/access.js` | Papéis e permissões na UI. |
| `src/demoStore.js` | Persistência local em modo demo. |
| `src/ui.jsx` / `styles.css` | Componentes base e tema. |
| `src/format.js` | Formatação de datas e números. |
| `src/useResource.js` | Hook de fetch com estados. |
| `src/components/` | Peças reutilizáveis (menus, formulários). |
| `src/panels/` | Uma aba por arquivo (Painel, Logs, Incidentes, …). |

## Comandos

```powershell
cd frontend
npm install
npm run dev
npm run build
npm run live:bundle
```

O operador abre sempre `index.html` na **raiz** do repositório (`http://127.0.0.1:5500/index.html`).
