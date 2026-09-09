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

Não houve mudança no `prisma/schema.prisma` e não há migration da Fase 4.
