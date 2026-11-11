# Publicar o Sentinela com incidentes que persistem

## Login falha na Vercel mas funciona em `127.0.0.1:5500`

| Ambiente | Onde ficam os usuários |
| --- | --- |
| `http://127.0.0.1:5500` + API `8010` | SQLite em `data/sentinela.db` no seu PC |
| `https://suportesustentacaon1n2.vercel.app/` (hoje) | **localStorage deste navegador** (modo demonstração) |

Não é bug de senha: é **outro cadastro**. O mesmo e-mail/senha do laboratório **não existe** no site público até você publicar a API e ligar o domínio.

**Opções:**

1. **Rápido:** em `https://suportesustentacaon1n2.vercel.app/`, use **Criar cadastro** (conta só neste navegador).
2. **Produção:** suba a API no Render (seção B abaixo), troque a URL em `deploy/vercel.json` **ou** crie `frontend/sentinela-config.js` a partir do exemplo — depois **redeploy** na Vercel.

Confirme: `curl https://suportesustentacaon1n2.vercel.app/api/health` → hoje **404** = modo demo ativo (não há API atrás do domínio).

**Atalho no console (modo demo):** após a mensagem vermelha, use o botão **「Criar cadastro neste navegador e entrar」** com o mesmo e-mail e senha.

**Login único (produção):** publique a API no Render, depois na Vercel → **Settings → Environment Variables** → `SENTINELA_API_ORIGIN` = `https://sua-api.onrender.com` → **Redeploy**. O build gera `frontend/sentinela-config.js` automaticamente (`scripts/prepare-vercel-deploy.cjs`). O `vercel.json` na **raiz** do repositório passa a ser lido pelo deploy.

---

## O que acontecia

O site na Vercel (`https://suportesustentacaon1n2.vercel.app/`) é **só o console estático**. Não há API Python publicada.

- `GET /api/health` na Vercel → **404**
- O navegador entra em **modo demonstração** (`frontend/demo/api-snapshot.json`)
- Antes da correção, registrar ou mudar situação **não gravava** nada
- Depois do deploy com o código novo: grava em **`localStorage` no navegador** (cada usuário vê a própria fila)

## Três jeitos de resolver

| Objetivo | O que fazer | Persistência |
| --- | --- | --- |
| **A. Rápido** (só parar de “perder” ao recarregar a página) | Publicar o frontend atual na Vercel | Só neste navegador (`localStorage`) |
| **B. Produção de verdade** | API no Render + proxy no `deploy/vercel.json` | SQLite em disco no Render (compartilhado) |
| **C. Laboratório local** | `npm --prefix config start` no Windows | SQLite em `data/sentinela.db` no seu PC |

---

## A. Deploy rápido na Vercel (modo demo persistido)

1. Na pasta `frontend`:

   ```powershell
   npm run live:bundle
   ```

2. Commit e push para o GitHub conectado à Vercel.

3. Na Vercel, dispare **Redeploy** do projeto `suportesustentacaon1n2`.

4. Teste em **Incidentes**: mude a situação, recarregue (F5). Deve manter o valor.

> Limite: outro computador ou outro navegador não vê os mesmos incidentes.

---

## B. API real + Vercel (recomendado para apresentação “com banco”)

### 1. Subir a API no Render

1. Conta em [Render](https://render.com).
2. **New → Blueprint** e aponte para este repositório. O modelo está em `deploy/render.yaml` (o Render exige o arquivo na raiz — veja `deploy/README.md`).
3. Aguarde o deploy. Anote a URL, por exemplo `https://sentinela-api-xxxx.onrender.com`.
4. Confirme no navegador: `https://SUA-URL.onrender.com/api/health` → JSON `{"status":"ok",...}`.

O disco em `/app/data` guarda o SQLite entre reinícios (plano com disco persistente).

### 2. Proxy na Vercel

Edite `deploy/vercel.json` (e copie para a raiz no deploy Git, se a Vercel não ler subpastas): troque **todas** as ocorrências de

`https://SUBSTITUA-PELA-URL-DA-SUA-API.onrender.com`

pela URL real do Render (sem barra no final).

Commit, push e redeploy na Vercel.

### 3. Comportamento do console

Na primeira chamada, o console faz `GET /api/health` **no mesmo domínio** da Vercel (graças ao rewrite).

- Se responder OK → usa a **API real** (incidentes no SQLite do Render).
- Se 404 → cai no **modo demo** com `localStorage`.

### 4. Alternativa sem proxy (API em outro domínio)

1. Copie `frontend/sentinela-config.example.js` para `frontend/sentinela-config.js`.
2. Defina `window.SENTINELA_API_ORIGIN = "https://SUA-URL.onrender.com";`
3. Em `index.html`, antes do `live-bootstrap.js`, adicione:

   ```html
   <script src="./frontend/sentinela-config.js"></script>
   ```

4. O CORS da API já permite `*.vercel.app` e `suportesustentacaon1n2.vercel.app`.

---

## C. Laboratório no Windows (referência)

```powershell
npm --prefix config start
```

Console: `http://127.0.0.1:5500/index.html` — API na porta **8010**.

---

## Checklist depois do deploy

| Teste | Esperado |
| --- | --- |
| `curl https://suportesustentacaon1n2.vercel.app/api/health` | `200` + JSON (só com proxy/API) ou `404` (só frontend) |
| Registrar incidente | Código `INC-2026-xxxx` |
| F5 na aba Incidentes | Dados mantidos |
| Outro navegador (modo A) | Snapshot original |
| Outro navegador (modo B) | Mesma fila da API |

---

## Atualizar o snapshot de demonstração

Com a API local na 8010:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-demo.ps1
```

Isso regera `frontend/demo/api-snapshot.json` antes de publicar o GitHub Pages ou a Vercel em modo demo.
