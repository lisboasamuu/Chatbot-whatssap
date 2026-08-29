# Architecture Decision Log

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
