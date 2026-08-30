# Fase 5 — Multiempresa

A aplicação usa **shared database + shared schema + tenant key**. O tenant ativo é
resolvido exclusivamente no backend pela variável `COMPANY_ID`; quando ela não
está definida, a instalação legada usa `default-company`, criada pela migration da
Fase 5. O frontend não envia `companyId` como mecanismo de autorização.

Cada processo atende uma empresa. A API administrativa, os stores Prisma e a
sessão WhatsApp usam o mesmo tenant. O `LocalAuth.clientId` do WhatsApp recebe o
`companyId`, separando as sessões por empresa dentro de `.wwebjs_auth`.

Para uma empresa adicional:

1. crie o registro `Company` por um fluxo administrativo controlado no banco;
2. configure `COMPANY_ID` com o `id` dessa empresa no processo correspondente;
3. inicialize o WhatsApp desse processo para gerar a sessão própria da empresa.

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
