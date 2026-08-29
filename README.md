# Chatbot WhatsApp — Fase 3: Agendamentos
Criado por Samuel Lisboa

## Visão geral

Este projeto é um chatbot de atendimento via WhatsApp desenvolvido de forma incremental.

Roadmap atual:

```text
FASE 0
WhatsApp funcionando
        ↓
FASE 1
Motor de Conversação
        ↓
FASE 2
PostgreSQL
        ↓
FASE 3
Agendamentos
```

A **Fase 3** adiciona CRUD de agendamentos ao chatbot já persistente, preservando a integração WhatsApp e a infraestrutura PostgreSQL/Prisma das fases anteriores.

Cada agendamento representa apenas **data + horário**. Não há duração, serviço, profissional, timezone avançado ou configuração de horário comercial nesta fase.

---

## Stack

* Node.js
* TypeScript
* npm
* ESLint
* EditorConfig
* whatsapp-web.js
* PostgreSQL
* Prisma ORM
* @prisma/client

---

## Arquitetura

O WhatsApp continua sendo apenas a camada de entrada e saída.

A lógica de conversação não depende diretamente de `whatsapp-web.js` nem de Prisma.

Fluxo atual:

```text
                   ┌→ ConversationStore ─→ PrismaConversationStore ─┐
WhatsApp Events ─→ ConversationEngine                              ├→ PostgreSQL
                   └→ AppointmentService ─→ AppointmentStore        │
                                              ↓                    │
                                      PrismaAppointmentStore ──────┘
```

A persistência foi introduzida sem recriar o Motor de Conversação existente.

---

## Persistência

A base persistente da Fase 2 foi preservada e a Fase 3 adiciona `Appointment`:

### Customer

Representa a identidade externa do usuário no WhatsApp.

Principais campos:

```text
id
externalId
createdAt
updatedAt
```

O `externalId` é único, impedindo a criação duplicada de clientes para o mesmo identificador do WhatsApp.

---

### Conversation

Representa o contexto persistente utilizado pelo Motor de Conversação.

Principais campos:

```text
id
customerId
state
context
createdAt
updatedAt
```

A máquina de estados existente da Fase 1 foi preservada.

Estados atuais:

```text
INITIAL
ACTIVE
SCHEDULING_DATE
SCHEDULING_TIME
SCHEDULING_CONFIRMATION
CANCELING_SELECT
CANCELING_CONFIRMATION
RESCHEDULING_SELECT
RESCHEDULING_DATE
RESCHEDULING_TIME
RESCHEDULING_CONFIRMATION
```

O campo `context` persiste somente dados temporários controlados do fluxo (`draftDate`, `draftTime` e `selectedAppointmentId`), permitindo continuar uma operação após reiniciar a aplicação.

---


### Appointment

Representa um agendamento pertencente a um `Customer`.

Campos de negócio:

```text
id
customerId
date       // YYYY-MM-DD
time       // HH:mm
createdAt
updatedAt
```

A combinação `(date, time)` possui constraint única no PostgreSQL. Nesta fase monoempresa, um slot pode ser ocupado por somente um agendamento globalmente.

Cancelamento remove o registro e libera o slot. Remarcação atualiza o mesmo `Appointment`, preservando `id`, `customerId` e `createdAt`.

### Message

Representa o histórico textual básico da conversa.

Principais campos:

```text
id
conversationId
direction
body
createdAt
```

Direções disponíveis:

```text
INBOUND
OUTBOUND
```

Nesta fase não são persistidos:

* anexos;
* áudio;
* mídia;
* transcrição;
* status de leitura;
* analytics;
* embeddings.

---

## Estrutura relevante

```text
prisma/
├── schema.prisma
└── migrations/
    ├── 20260825000000_add_conversation_persistence/
    │   └── migration.sql
    └── 20260828000000_add_appointments_phase_3/
        └── migration.sql

src/
├── appointments/
│   ├── appointment.service.ts
│   ├── appointment.store.ts
│   └── appointment.types.ts
│
├── conversation/
│   ├── conversation.engine.ts
│   ├── conversation.store.ts
│   ├── conversation.types.ts
│   └── conversation.engine.test.ts
│
├── database/
│   ├── prisma.client.ts
│   ├── prisma-conversation.store.ts
│   └── prisma-appointment.store.ts
│
├── whatssap/
│   ├── whatsapp.client.ts
│   └── whatsapp.events.ts
│
└── index.ts
```

> O diretório `src/whatssap` mantém o nome já existente no projeto. Ele não foi renomeado nesta fase para evitar uma refatoração sem relação direta com Agendamentos.

---

## Pré-requisitos

Antes de executar o projeto, tenha instalado:

* Node.js
* npm
* PostgreSQL

Confira as versões:

```bash
node --version
npm --version
psql --version
```

---

## Instalação

Clone o projeto ou acesse o diretório existente:

```bash
cd Chatbot-whatssap
```

Instale as dependências:

```bash
npm install
```

---

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto.

Você pode usar `.env.example` como referência:

```bash
cp .env.example .env
```

Configure:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/chatbot?schema=public"
```

Exemplo:

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/chatbot?schema=public"
```

Não versione o arquivo `.env`.

O `.gitignore` deve proteger:

```text
.env
.wwebjs_auth/
.wwebjs_cache/
node_modules/
dist/
```

---

## Prisma

### Validar o schema

```bash
npx prisma validate
```

Resultado esperado:

```text
The schema at prisma/schema.prisma is valid
```

---

### Gerar Prisma Client

```bash
npx prisma generate
```

---

### Aplicar migrations

```bash
npx prisma migrate dev
```

Na primeira execução, o banco poderá ser criado automaticamente caso o usuário PostgreSQL configurado possua permissão.

Migrations:

```text
20260825000000_add_conversation_persistence
20260828000000_add_appointments_phase_3
```

---

## Scripts de banco

Scripts disponíveis:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

### Prisma Studio

Para visualizar os dados:

```bash
npm run db:studio
```

Por padrão:

```text
http://localhost:5555
```

No Prisma Studio estarão disponíveis:

```text
Customer
Conversation
Message
Appointment
```

---


## Agendamentos — Fase 3

Comandos determinísticos disponíveis em `ACTIVE`:

```text
agendar
meus agendamentos
agendamentos
cancelar agendamento
remarcar agendamento
```

Durante um fluxo de agendamento, use:

```text
sair
voltar
```

para abandonar a operação e limpar o contexto temporário.

Entrada de data:

```text
DD/MM/AAAA
```

Persistência normalizada:

```text
YYYY-MM-DD
```

Entrada e persistência de horário:

```text
HH:mm
```

Somente combinações futuras válidas são aceitas. Não há horário comercial nesta fase: qualquer slot futuro válido é permitido se `(date, time)` ainda não estiver ocupado.

### Fluxo manual básico

Criar:

```text
agendar
30/08/2030
14:30
sim
```

Listar:

```text
meus agendamentos
```

Cancelar:

```text
cancelar agendamento
1
sim
```

Remarcar:

```text
remarcar agendamento
1
07/09/2030
16:00
sim
```

## Executando o projeto

Modo desenvolvimento:

```bash
npm run dev
```

O fluxo normal do WhatsApp continua sendo utilizado.

Caso exista sessão válida em:

```text
.wwebjs_auth/
```

o cliente deverá reutilizá-la.

Caso contrário, o processo de autenticação/QR existente continua funcionando.

---

## Validação

Antes de considerar a Fase 3 concluída, execute:

```bash
npm run build
npm run lint
npm test
```

Também valide Prisma:

```bash
npx prisma validate
npx prisma generate
npx prisma migrate dev
```

---

## Testes manuais

### Teste 1 — Banco vazio

1. Garanta que PostgreSQL esteja disponível.
2. Aplique as migrations.
3. Inicie a aplicação.
4. Conecte o WhatsApp.
5. Envie a primeira mensagem.

Esperado:

```text
1 Customer
1 Conversation
1 Message INBOUND
1 resposta no WhatsApp
1 Message OUTBOUND
```

---

### Teste 2 — Mesmo usuário

Envie várias mensagens pelo mesmo número.

Esperado:

```text
Customer: 1
Conversation: 1
Messages: N
```

O mesmo usuário não deve gerar Customers duplicados.

---

### Teste 3 — Usuários diferentes

Envie mensagens utilizando dois números diferentes.

Esperado:

```text
2 Customers
2 Conversations independentes
```

O estado de uma conversa não deve afetar a outra.

---

### Teste 4 — Reinicialização

1. Inicie uma conversa.
2. Provoque uma transição real da máquina de estados.
3. Verifique no banco que o estado foi alterado.
4. Encerre a aplicação com `Ctrl+C`.
5. Execute novamente:

```bash
npm run dev
```

6. Envie nova mensagem pelo mesmo número.

Esperado:

O Motor de Conversação deve recuperar o estado existente no PostgreSQL em vez de começar novamente do estado inicial.

---

### Teste 5 — Mensagem inválida

Envie:

```text
xyzabc123
```

Esperado:

```text
Desculpe, não entendi.
```

ou o fallback equivalente já existente na Fase 1.

A mensagem deve continuar sendo persistida normalmente.

---

### Teste 6 — PostgreSQL indisponível

1. Inicie normalmente a aplicação.
2. Pare o PostgreSQL.
3. Envie uma mensagem.

Esperado:

* aplicação não encerra abruptamente;
* erro é registrado no terminal;
* credenciais ou detalhes internos não são enviados ao usuário;
* nenhuma falsa confirmação é produzida;
* o usuário recebe uma mensagem técnica genérica.

---

### Teste 7 — Regressão WhatsApp

Com PostgreSQL novamente disponível, confirme:

* autenticação WhatsApp funcionando;
* sessão existente funcionando;
* QR funcionando quando necessário;
* mensagens sendo recebidas;
* respostas sendo enviadas;
* eventos existentes funcionando;
* encerramento funcionando normalmente.

---

## Fluxo de uma mensagem

O fluxo implementado nesta fase é:

```text
1. WhatsApp recebe mensagem

2. Camada WhatsApp extrai:
   - identificador externo
   - texto

3. ConversationEngine recebe a entrada

4. ConversationStore procura/cria Customer

5. Conversation é carregada ou criada

6. Estado persistido é recuperado

7. Mensagem INBOUND é registrada

8. Motor de Conversação executa a lógica existente

9. Próximo estado é determinado

10. Estado é persistido

11. Resposta retorna para a camada WhatsApp

12. WhatsApp envia a resposta

13. Após envio bem-sucedido, Message OUTBOUND é registrada
```

A mensagem `OUTBOUND` é persistida após o envio pelo WhatsApp para evitar registrar como enviada uma resposta que apenas foi gerada internamente.

---

## Separação de responsabilidades

### WhatsApp

Responsável por:

* receber mensagens;
* extrair remetente;
* extrair conteúdo;
* chamar o Motor de Conversação;
* enviar respostas;
* tratar erros da integração.

A camada WhatsApp não acessa Prisma diretamente.

---

### Conversation

Responsável por:

* interpretar entradas;
* executar a máquina de estados;
* gerar respostas;
* solicitar carregamento e persistência através de uma abstração.

O Motor de Conversação não conhece `PrismaClient`.

---

### ConversationStore

Define o contrato entre o Motor de Conversação e a persistência.

Fluxo:

```text
ConversationEngine
       ↓
ConversationStore
       ↓
PrismaConversationStore
```

Isso mantém a regra de negócio desacoplada da implementação PostgreSQL.

---

### Database

Responsável por:

* instanciar Prisma Client;
* executar operações PostgreSQL;
* persistir Customer;
* persistir Conversation;
* persistir Message;
* persistir Appointment;
* carregar estado e contexto;
* atualizar estado e contexto;
* aplicar ownership de Appointment nas operações sensíveis;
* traduzir conflito de slot sem expor códigos internos do Prisma ao motor.

---

## Concorrência básica

`Customer.externalId` possui restrição de unicidade.

A implementação utiliza operações idempotentes do Prisma para evitar duplicação de cliente quando mensagens do mesmo identificador chegam próximas.

Não foi introduzido locking distribuído ou infraestrutura adicional.

---

## Segurança

Credenciais não devem ser armazenadas diretamente no código.

Utilize:

```env
DATABASE_URL
```

Não versione:

```text
.env
```

Também não devem ser versionados:

```text
.wwebjs_auth/
.wwebjs_cache/
```

Esses diretórios podem conter dados relacionados à sessão do WhatsApp.

---

## Observação sobre npm audit

Durante a instalação podem aparecer vulnerabilidades em dependências transitivas.

Evite executar automaticamente:

```bash
npm audit fix --force
```

Esse comando pode alterar versões principais ou introduzir regressões em dependências críticas como Prisma e `whatsapp-web.js`.

Analise atualizações de segurança separadamente e valide compatibilidade antes de aplicá-las.

---

## Git

Branch da fase:

```bash
git checkout -b feat/appointments-phase-3
```

Depois da validação:

```bash
git status
git add .
git commit -m "feat: implement appointment scheduling"
```

Para publicar:

```bash
git push -u origin feat/appointments-phase-3
```

---

## Fase 3 implementada

A persistência de conversas da Fase 2 foi preservada e agora o `ConversationEngine` também orquestra o `AppointmentService`, sem depender de Prisma ou de `whatsapp-web.js`.

A constraint global `(date, time)` deverá ser reavaliada quando Multiempresa for implementada; nenhum `companyId`/`tenantId` foi antecipado nesta fase.

---

## Fora de escopo

Esta fase não implementa:

* configuração de disponibilidade/horário comercial
* serviços/procedimentos
* duração de serviço
* profissionais/funcionários
* calendário
* Dashboard
* React
* Multiempresa
* Pagamentos
* Lembretes
* Redis
* BullMQ
* OpenAI
* LLM
* IA
* Analytics
* APIs HTTP administrativas

Esses recursos pertencem às próximas fases do projeto.

---
