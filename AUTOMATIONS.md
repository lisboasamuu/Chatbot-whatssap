# Automações configuráveis

Esta fase adiciona duas capacidades ao Código NS existente sem substituir agenda, lembretes ou o `ConversationEngine`.

## Arquitetura

- `Automation`: configuração tenant-scoped, status e próxima execução persistida.
- `AutomationVariation`: textos normalizados das regras de entrada (máximo 10).
- `AutomationRecipient`: associação entre automação programada e `Customer` existente.
- `AutomationRun`: uma ocorrência persistida da programação. A chave `automationId + scheduleVersion + scheduledFor` impede materialização duplicada.
- `AutomationDelivery`: resultado e tentativas de cada destinatário. A chave `runId + customerId` impede duplicidade dentro da execução.

O worker usa polling de 30 segundos, `FOR UPDATE SKIP LOCKED`, lote de 20 itens e envio sequencial. Há até três tentativas por destinatário: a primeira, outra após 1 minuto e a última após 5 minutos. Um envio interrompido antes do despacho é recolocado na fila; quando o processo reinicia depois do despacho começar, o item é marcado como falha incerta para evitar reenvio automático.

Automações semanais aceitam qualquer combinação dos sete dias e até três horários. A data/hora é interpretada no timezone IANA da `Company` e persistida em UTC. Alterar, desativar ou excluir uma programação incrementa `scheduleVersion`; entregas antigas ainda pendentes são ignoradas, e execuções já concluídas permanecem como histórico.

## Matching inbound

A entrada e as variações são transformadas em lowercase, sem acentos, pontuação irrelevante ou espaços repetidos. A decisão segue:

1. correspondência normalizada exata;
2. frase normalizada contida em limites de palavras;
3. variação mais longa/específica;
4. data de criação, id da automação e id da variação como desempate estável.

Fluxos com `ConversationState` ativo e intenções nativas (`agendar`, consultar, cancelar e remarcar) são avaliados antes das regras configuráveis.

## Limite operacional inicial

Cada automação programada aceita até 200 contatos. É uma proteção explícita e conservadora para o runtime atual, que mantém uma sessão `whatsapp-web.js` por empresa e processa os destinatários em série. O valor deve ser revisto com métricas reais de duração, falhas, memória e estabilidade da sessão antes de ser ampliado.

## Aplicação segura

No repositório real, partindo de uma árvore limpa:

```bash
git status
git branch --show-current
git log --oneline --decorate -10
git checkout main
git pull origin main
git checkout -b feature/automations

npm ci
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run lint
npm run build
npm test

npm --prefix dashboard ci
npm --prefix dashboard run lint
npm --prefix dashboard run build
npm --prefix dashboard run test
```

Revise especialmente `prisma/migrations/20260909000000_add_configurable_automations/migration.sql` antes de executar `prisma migrate deploy`. Não use `prisma migrate reset` em produção.

Commits sugeridos:

```text
feat: add configurable company automations
feat: add recurring scheduled customer messages
test: cover automation scheduling and tenant isolation
```
