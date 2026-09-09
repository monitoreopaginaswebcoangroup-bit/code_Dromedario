# Code Summary - MVP

## Created Application Files
- `package.json`: scripts and dependencies for Next.js, Supabase and Vitest.
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`: app shell, routing entry and responsive visual design.
- `components/mvp-app.tsx`: authenticated MVP UI, dashboard, forms, Supabase mutations, workflow transitions and file uploads.
- `types/domain.ts`: domain types for profiles, customers, contacts, products, orders, items and events.
- `lib/supabase.ts`: browser Supabase client factory.
- `lib/workflow.ts`: role/status workflow rules.
- `lib/format.ts`: formatting and file-name sanitation helpers.
- `supabase/schema.sql`: `dromedario` database schema, RLS, storage and seed setup.
- `tests/workflow.test.ts`: unit tests for workflow rules.
- `README.md`: setup, deploy and scope documentation.

## Implementation Notes
- The frontend uses Supabase directly from the browser with RLS as the authorization layer.
- The Supabase browser client uses `db.schema = dromedario`, so `.from(...)` points to application tables outside `public`.
- Service-role keys are not used in the frontend.
- Commercial users are limited by RLS to created/assigned entities; backoffice roles can see operational orders.
- File uploads are stored in a private `order-documents` bucket and opened through short-lived signed URLs.
- New sign-ups are created as `comercial`; RLS also prevents self-inserting privileged roles. Admin/facturacion/despacho roles are assigned from Supabase, not from the public UI.
