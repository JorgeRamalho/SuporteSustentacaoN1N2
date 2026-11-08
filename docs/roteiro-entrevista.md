# Roteiro de entrevista — Sentinela

Tempo alvo: cinco a seis minutos. Deixe a API em `127.0.0.1:8010` e o console em `127.0.0.1:5173` antes de entrar.

## Abertura

"Sustentação N1 e N2 perde tempo em três rotinas: achar erro no meio de log, decidir se o chamado fica no N1 ou sobe, e fechar a conta de SLA da semana. O Sentinela junta as três, com uma trava: a ação perigosa nasce desligada."

## 1. Painel

Mostre os cartões e a coluna de serviços.

"O estado do serviço não é um campo digitado. Ele deriva do incidente aberto. P1 deixa o serviço indisponível. Quando eu resolvo o incidente, o serviço volta a operacional. Disco, memória e CPU são a leitura real desta máquina, não um número fixo."

## 2. Logs

Abra **Logs**. Aponte uma linha ERROR e diga que o INFO do healthcheck não está na tabela.

"O coletor aceita o formato comum de timestamp, nível e logger. Se a linha seguinte é stack trace, ela gruda no erro. A assinatura troca número por cerquilha, então 'timeout de 30s' e 'timeout de 31s' são o mesmo problema. A exportação sai em CSV, com BOM para o Excel, ou em JSON. Célula que começa com igual recebe aspas para não virar fórmula."

Clique em **Ler amostras**.

"A segunda passagem insere zero. O digest da linha impede duplicar o chamado."

## 3. Incidentes

Abra o pool do Oracle e a fila de e-mail.

"Três ocorrências da mesma assinatura, ou um FATAL, abrem incidente. P1 e P2 vão para o N2. P3 com artigo conhecido fica no N1, já com o passo a passo. O fornecedor entra por palavra do log: oracle e pool chamam o Oracle; queue frozen chama a Microsoft. O contato de escalonamento está no cadastro, e o artigo lembra o que não pode ir no chamado, como dado de cartão."

Mude um incidente para **Em análise** e depois para **Resolvido**. Volte ao painel e mostre o serviço recuperado.

## 4. Automação

Abra **Automação** e clique em **Ensaiar pressão**.

"Eu separo a leitura do cenário. A barra continua mostrando o disco real. O ensaio diz: se estivesse em 96% e 93%, eu limparia a sandbox e registraria um reinício. O alerta leva a marca SIMULADO. Os três arquivos temporários continuam em data/sandbox/temp. Mesmo com a trava real ligada, o único efeito possível é apagar arquivo dentro dessa pasta. Reiniciar serviço do sistema operacional não está acoplado. Não há subprocesso nesse módulo."

## 5. Chamados

Abra **Chamados** e clique em **Gerar relatório**.

"O relatório responde o que a gestão pergunta: quantos abriram, quantos fecharam, qual o tempo médio de atendimento, qual a primeira resposta e qual a conformidade. A janela padrão é sete dias. Jira, ServiceNow, GLPI e Zendesk têm adaptador. Sem token, o console usa um catálogo fictício para a demo não depender de VPN. Com token, o mesmo botão troca a origem. O e-mail só sai se SIMULATE estiver falso e o SMTP estiver preenchido. A cópia em texto e JSON fica em data/reports."

## 6. Pipeline

Mostre o `jenkins/Jenkinsfile` (e `jenkins/README.md` se perguntarem do caminho no job).

"O pipeline cria um virtualenv, instala o backend, roda o pytest e compila o React. O relatório semanal é um parâmetro, para não disparar no meio de um commit. No dia a dia eu mostro o mesmo caminho com scripts/verificar.ps1. O Jenkins sobe por um profile do Docker, para não pesar o compose normal."

## Se perguntarem o que você não fez

"Não coloquei login, não espalhei agente em servidor e não reinicio serviço de produção. Prefiro explicar a trava a simular um restart que o entrevistador não consegue auditar. O banco é SQLite de laboratório; a URL do SQLAlchemy é o ponto de troca para PostgreSQL."
