# Scripts (Windows / PowerShell)

Automação local: API, bundle Live Server e verificação antes de demonstração.

| Arquivo | Função |
| --- | --- |
| `config.ps1` | Host/porta do console e variáveis compartilhadas. |
| `garantir-ambiente.ps1` | API (8010) + bundle + live-server (5500). |
| `garantir-api.ps1` | Somente uvicorn se a API não estiver escutando. |
| `subir-api.ps1` | API em primeiro plano (terminal dedicado). |
| `iniciar.ps1` | Fluxo após ambiente pronto (mensagens e URLs). |
| `abrir.ps1` | Garante ambiente e abre o navegador. |
| `verificar.ps1` | Espelho do `jenkins/Jenkinsfile` (pytest + build). |
| `Abrir-Sentinela.cmd` | Atalho duplo clique: chama `abrir.ps1`. |

Na raiz, prefira `npm start` ou `npm run abrir`. O `.cmd` fica aqui para agrupar tudo em `scripts/`.
