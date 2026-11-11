# Roadmap Sentinela (sugestões)

## Feito (nov/2026)

- API em produção: [sentinela-api-eavd.onrender.com](https://sentinela-api-eavd.onrender.com/api/health)
- `vercel.json` na raiz com proxy `/api` → Render
- Build Vercel com `SENTINELA_API_ORIGIN` (padrão = Render acima)
- Fallback modo demo + botão «Criar cadastro neste navegador e entrar»
- CI: `.github/workflows/vercel-build-check.yml`

## Próximos passos sugeridos

| Prioridade | Item | Benefício |
| --- | --- | --- |
| Alta | Disco persistente no Render (plano pago ou blueprint com disk) | SQLite não some no cold start do free tier |
| Alta | Variável `SENTINELA_API_ORIGIN` na Vercel (confirme após redeploy) | CORS direto se o proxy falhar |
| Média | Testes E2E (Playwright) login + painel | Regressão no deploy |
| Média | Health check `/api/health` no Render (dashboard) | Menos 502 no primeiro acesso |
| Média | Seed de operador demo na API (somente `SIMULATE=true`) | Demo institucional sem cadastro |
| Baixa | Alertas (e-mail/Slack) no modo simulado | Storytelling N1/N2 |

## Produção

- Console: https://suportesustentacaon1n2.vercel.app/
- API: https://sentinela-api-eavd.onrender.com/docs
- Repositório: https://github.com/JorgeRamalho/SuporteSustentacaoN1N2

Após redeploy na Vercel: **Criar cadastro** uma vez no site (conta vai para o SQLite do Render). O login local (`127.0.0.1`) e o login na Vercel passam a ser **bases distintas** até você usar o mesmo cadastro na Vercel com API ligada.
