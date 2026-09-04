# Fase 7 — Lembretes automáticos de agendamento

Cada empresa pode ativar lembretes e selecionar exclusivamente os presets de 24h,
12h, 4h, 1h e 30 minutos no Platform Admin. A mensagem usa o `MessageTemplate`
existente com tipo `REMINDER`, fallback da plataforma e os placeholders permitidos
`{{customerName}}`, `{{date}}`, `{{time}}` e `{{companyName}}`.

O scheduling usa PostgreSQL como fonte de verdade. Um worker periódico por processo
e por tenant reconcilia os agendamentos, persiste `AppointmentReminder` e reivindica
jobs vencidos com `FOR UPDATE SKIP LOCKED`. O timer apenas acorda o worker; restart ou
deploy não apagam a programação. A constraint composta por empresa, agendamento,
offset e instante programado impede criação duplicada.

Antes de enviar, o worker relê empresa, configuração, template, agendamento,
destinatário e disponibilidade do WhatsApp. Cancelamentos, remarcações, empresa
inativa e offsets desabilitados resultam em `SKIPPED`. Falhas explicitamente
retornadas pelo provider têm no máximo três tentativas, com esperas de 1 e 5
minutos; depois disso ficam `FAILED` com erro operacional persistido.

`scheduledFor` é persistido em UTC. O instante é calculado a partir dos campos
locais `Appointment.date` + `Appointment.time` usando o timezone IANA da Company.
O worker e o provider são vinculados ao mesmo `companyId`, preservando o modelo da
Fase 5 de uma empresa operacional por processo.

Se o processo parar depois de registrar o início do dispatch, mas antes de salvar a
confirmação do WhatsApp, o resultado é tratado como incerto e finalizado como
`FAILED`, sem reenvio automático. Essa escolha conservadora evita mensagens
duplicadas porque `whatsapp-web.js` não oferece uma chave idempotente externa.

Esta fase não implementa pagamentos, IA, login empresarial, QR administrativo ou
qualquer item de Company Access / Production Readiness da Fase 7.5.

# Fase 5.5 — Platform Admin & Company Configuration

O Platform Admin privado está disponível em `/platform`. As operações cross-tenant
são autorizadas exclusivamente no backend por uma sessão administrativa criada após
login com `PLATFORM_ADMIN_PASSWORD`. A senha nunca é enviada ao frontend fora do
POST de login, não é persistida no banco e deve ter pelo menos 16 caracteres.

A sessão usa token aleatório de 256 bits armazenado somente em memória no processo,
cookie `HttpOnly` + `SameSite=Strict` (`Secure` quando `NODE_ENV=production`),
30 minutos de inatividade, duração máxima de 8 horas, rate limit de login e validação
de origem para operações mutáveis. Reiniciar o backend encerra todas as sessões.

O Platform Admin permite criar, listar, configurar, ativar e desativar empresas sem
alteração manual de código ou banco. Novas empresas começam `INACTIVE` para que
horários e mensagens sejam configurados antes da ativação. Cada Company possui timezone IANA, horários
semanais, templates opcionais com fallback e configuração Pix/antecipação apenas
persistida. Esta fase não gera cobranças, QR Codes ou confirma pagamentos.

Horários são persistidos como períodos por dia. A ausência de períodos em um dia
significa fechado; múltiplos períodos representam intervalos naturais. A migration
preserva o comportamento legado de `default-company` criando períodos 00:00–23:59
nos sete dias. Novas empresas começam sem horários e, portanto, sem slots disponíveis
até serem configuradas.

`Company.status = INACTIVE` preserva todo o histórico. O processo não inicializa
WhatsApp quando já inicia com a empresa inativa e o ConversationEngine também
bloqueia novas mensagens em tempo de execução após desativação. Criação e remarcação
de agendamentos validam status e Business Hours no backend.

Valores de antecipação nunca usam `Float`: `FIXED` é armazenado em centavos e
`PERCENTAGE` em basis points (100 = 1%). `NONE` não possui valor.

Variáveis relevantes:

```text
DATABASE_URL
COMPANY_ID
ADMIN_HTTP_PORT
PLATFORM_ADMIN_PASSWORD
NODE_ENV
```

Em produção, publique o backend somente por HTTPS para que o cookie administrativo
seja enviado com `Secure`.

# Fase 5 — Multiempresa

A aplicação usa **shared database + shared schema + tenant key**. O tenant ativo é
resolvido exclusivamente no backend pela variável `COMPANY_ID`; quando ela não
está definida, a instalação legada usa `default-company`, criada pela migration da
Fase 5. O frontend não envia `companyId` como mecanismo de autorização.

Cada processo atende uma empresa. A API administrativa, os stores Prisma e a
sessão WhatsApp usam o mesmo tenant. O `LocalAuth.clientId` do WhatsApp recebe o
`companyId`, separando as sessões por empresa dentro de `.wwebjs_auth`.

Para uma empresa adicional, cadastre e configure a Company pelo Platform Admin.
O processo WhatsApp continua usando `COMPANY_ID` como identificador operacional da
instância, conforme a arquitetura da Fase 5; não é necessário editar código ou banco.

A migration `20260830050000_add_multi_tenant_architecture` preserva os registros
anteriores, associa Customer/Conversation/Appointment a `default-company` e só
depois torna as relações obrigatórias.

A API expõe `GET /api/company/current` apenas para informar ao Dashboard qual
empresa o backend já selecionou. Esse endpoint não troca tenant.

# Fase 4 — Dashboard React

## Arquitetura

```text
React dashboard
  -> HTTP /api
  -> AdminService
  -> AdminRepository
  -> PrismaAdminRepository
  -> PostgreSQL

WhatsApp
  -> ConversationEngine
  -> ConversationStore / AppointmentService
  -> Prisma stores
  -> PostgreSQL
```

O adapter HTTP administrativo é separado do adapter WhatsApp. O dashboard não importa Prisma e as rotas HTTP não dependem de `whatsapp-web.js`.

## API administrativa

Base local padrão: `http://localhost:3001`. A porta pode ser configurada com `ADMIN_HTTP_PORT`.

- `GET /api/health`
  - `200`: `{ "status": "ok" }`
- `GET /api/dashboard/summary?limit=5`
  - `200`: `{ totalCustomers, appointmentsToday, upcomingAppointments, nextAppointments }`
  - `limit`: inteiro de 1 a 20
- `GET /api/appointments/upcoming?limit=100`
  - `200`: `{ "appointments": [...] }`
  - `limit`: inteiro de 1 a 100
- `GET /api/customers`
  - `200`: `{ "customers": [...] }`
- `GET /api/customers/:customerId`
  - `200`: `{ "customer": { ..., appointments: [...] } }`
  - `404`: cliente inexistente
- `GET /api/customers/:customerId/conversation`
  - `200`: `{ "conversation": null }` quando o cliente existe sem conversa
  - `200`: `{ "conversation": { ..., messages: [...] } }`
  - `404`: cliente inexistente

Erros usam `{ "error": { "code": "...", "message": "..." } }`. Erros internos retornam mensagem genérica.

Agendamentos futuros usam o formato persistido da Fase 3 (`YYYY-MM-DD` + `HH:mm`) e são ordenados por data e hora. `appointmentsToday` contabiliza todos os registros da data local corrente; `upcomingAppointments` considera slots da data corrente a partir do minuto atual e datas posteriores.

## Execução

Backend/WhatsApp:

```bash
npm install
npm run db:generate
npm run build
npm run dev
```

Dashboard, em outro terminal:

```bash
cd dashboard
npm install
npm run dev
```

O Vite encaminha `/api` para `http://localhost:3001`.

## Validação

```bash
npm run build
npm run lint
npm test
npm run dashboard:build
npm run dashboard:lint
npm run dashboard:test
npx prisma validate
```
