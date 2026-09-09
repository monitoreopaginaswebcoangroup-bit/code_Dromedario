# Execution Plan - Dromedario Pedidos MVP

## Detailed Analysis Summary

### Change Impact Assessment
- **User-facing changes**: Yes. New internal web app for admin, commercial, invoicing and dispatch users.
- **Structural changes**: Yes. Greenfield Next.js frontend plus Supabase backend schema.
- **Data model changes**: Yes. New tables for profiles, customers, contacts, products, orders, order items and events.
- **API changes**: No custom API for MVP. Frontend uses Supabase client and RLS directly.
- **NFR impact**: Yes. Auth, role-based access, deployability and mobile usability are required.

### Risk Assessment
- **Risk Level**: Medium.
- **Rollback Complexity**: Easy for frontend, moderate for database if data has been entered.
- **Testing Complexity**: Simple to moderate.

## Workflow Visualization
Text representation used to keep documentation parser-safe:

```text
Workspace Detection: completed
Reverse Engineering: skipped, greenfield project
Requirements Analysis: completed at MVP depth
User Stories: skipped due 8-hour MVP timebox, requirements capture personas and flows
Workflow Planning: completed
Application Design: skipped as separate phase, covered by implementation plan
Units Generation: skipped, single MVP unit
Functional Design: skipped as separate phase, encoded in workflow logic and SQL schema
NFR Requirements/Design: skipped as separate phases, core NFRs captured in requirements
Infrastructure Design: skipped as separate phase, Supabase plus Vercel/Netlify is fixed by request
Code Generation: execute
Build and Test: execute
Operations: placeholder
```

## Phases To Execute
- [x] Workspace Detection - completed.
- [x] Requirements Analysis - completed.
- [x] Workflow Planning - completed.
- [ ] Code Generation - execute for one MVP unit.
- [ ] Build and Test - execute local build/tests and generate deployment instructions.

## Phases To Skip
- [x] Reverse Engineering - skipped because no existing source code exists.
- [x] User Stories - skipped to preserve 8-hour MVP timebox; roles and acceptance criteria are embedded in requirements.
- [x] Application Design - skipped as a standalone gate; architecture is simple and implementation-oriented.
- [x] Units Generation - skipped because one unit is enough.
- [x] Functional Design - skipped as standalone gate; workflow is encoded in schema and transition utility.
- [x] NFR Requirements - skipped as standalone gate; essential NFRs are already fixed.
- [x] NFR Design - skipped as standalone gate.
- [x] Infrastructure Design - skipped as standalone gate; deployment target is known.

## Implementation Unit
- **Unit name**: mvp.
- **Scope**: Next.js app, Supabase schema, workflow screens, role-aware data access, traceability, tests and deployment docs.

## Estimated Timeline
- Supabase schema and seed data: 45-60 minutes.
- Next.js project setup and layout: 45-60 minutes.
- Auth and data services: 60-90 minutes.
- Dashboard, forms and workflow actions: 3-4 hours.
- Testing, build and deployment docs: 60-90 minutes.
- Total target: under 8 hours.

## Success Criteria
- App builds locally.
- Tests for workflow transitions pass.
- Supabase SQL can be applied in a new project.
- Frontend works with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
