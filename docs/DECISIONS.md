# Architecture Decision Log

## ADR-002 — PostgreSQL-backed appointment reminder worker

**Status:** Accepted

**Date:** 2026-09-04

### Context

Phase 7 needs durable, retryable and tenant-isolated reminder scheduling without
losing state on restart. PostgreSQL is already required by the application, while
Redis and BullMQ are not part of the current runtime.

### Decision

Persist each reminder in `AppointmentReminder` and run a periodic worker bound to
the process tenant. Reconciliation creates only temporally valid jobs. Atomic
claims use PostgreSQL row locking with `FOR UPDATE SKIP LOCKED`; a domain unique
constraint prevents duplicate jobs. Every dispatch reloads current Company,
settings, Appointment and recipient state.

### Why

This provides durable scheduling, bounded retry, observability and safe concurrent
claims using infrastructure that already exists. Redis/BullMQ would add an
operational dependency without being necessary for the current one-process-per-
tenant architecture.

### Consequences

- The polling timer is not authoritative; all lifecycle state is stored in PostgreSQL.
- Cancellation can keep reminder history because `appointmentId` is a historical
  reference rather than a cascading foreign key.
- An interrupted dispatch with uncertain external outcome is not resent, because
  the current WhatsApp provider has no external idempotency key.
- A future move to a dedicated queue can retain `AppointmentReminder` as the audit
  and idempotency ledger.

## ADR-001 — Separate administrative HTTP and WhatsApp adapters

**Status:** Accepted

**Date:** 2026-08-29

### Context
Phase 4 introduces an administrative HTTP API and React dashboard while the existing WhatsApp integration remains responsible for conversational messaging.

### Decision
Keep HTTP and WhatsApp as separate adapters. The HTTP layer depends on `AdminService`, which reads operational data through `AdminRepository`. The Prisma implementation lives in the database layer. `ConversationEngine` and `AppointmentService` remain unchanged and do not depend on HTTP or React.

### Why
This preserves the approved Phase 3 boundaries, prevents `whatsapp-web.js` from leaking into administrative routes, and ensures the frontend only reaches PostgreSQL through the backend API.

### Consequences
- HTTP routes cannot depend on `whatsapp-web.js`.
- React never imports Prisma.
- Dashboard-specific read queries are isolated in `PrismaAdminRepository`.
- Existing conversational behavior remains independently testable.

### Alternatives considered
- Put administrative reads directly in `ConversationEngine`: rejected because HTTP concerns do not belong to the conversation state machine.
- Access Prisma from React: rejected because database access must remain server-side.
