# AI-DLC State Tracking

## Project Information
- **Project Type**: Greenfield
- **Start Date**: 2026-08-14T16:50:17Z
- **Current Stage**: OPERATIONS - Deployment Configuration Complete
- **Project Name**: Dromedario pedidos MVP

## Workspace State
- **Existing Code**: No
- **Reverse Engineering Needed**: No
- **Workspace Root**: /home/vicman/Enterdev/Proyectos/10X/Anpala SAS/dromedario/code
- **Programming Languages**: TypeScript, SQL, CSS
- **Build System**: npm / Next.js
- **Project Structure**: Greenfield Next.js app with Supabase backend schema
- **Supabase Application Schema**: dromedario

## Code Location Rules
- **Application Code**: Workspace root (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: Next.js application at workspace root.

## Extension Configuration
| Extension | Enabled | Decided At | Rationale |
|---|---|---|---|
| property-based-testing | No | Requirements Analysis | CRUD/workflow MVP with limited pure algorithmic complexity. |
| resiliency-baseline | No | Requirements Analysis | Prototype timebox prioritizes demo speed over production hardening. |
| security-baseline | No | Requirements Analysis | Extension skipped, basic Auth/RLS still implemented. |
| owasp-top10 | No | Requirements Analysis | Extension skipped for MVP, basic OWASP-aware safeguards still applied. |

## Stage Progress
- [x] INCEPTION - Workspace Detection
- [x] INCEPTION - Requirements Analysis
- [x] INCEPTION - Workflow Planning
- [x] CONSTRUCTION - Code Generation
- [x] CONSTRUCTION - Build and Test
- [x] OPERATIONS - Deployment Configuration

## Execution Plan Summary
- **Total Stages**: 5
- **Stages to Execute**: Workspace Detection, Requirements Analysis, Workflow Planning, Code Generation, Build and Test
- **Stages to Skip**: Reverse Engineering, User Stories, Application Design, Units Generation, Functional Design, NFR Requirements, NFR Design, Infrastructure Design

## Current Status
- **Lifecycle Phase**: OPERATIONS
- **Current Stage**: Deployment Configuration Complete
- **Next Stage**: Client executes deployment (push to GitHub, connect Vercel or Netlify, set env vars, run post-deploy checklist)
- **Status**: MVP generated, verified locally, and now has full deployment configuration and documentation for Vercel (recommended) and Netlify

## Verification Results
- **npm install**: Success
- **npm audit**: 0 vulnerabilities after Next.js upgrade to 16.3.1
- **npm run test**: 5 passed / 0 failed
- **npm run typecheck**: Success
- **npm run build**: Success
- **Supabase schema change**: Application database objects moved from `public` to `dromedario`; Supabase client uses `db.schema = dromedario`.
- **Role visibility change**: RLS and frontend read-only behavior updated; `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-08-14T22:26:53Z.
- **Friendly URL navigation**: Added `/resumen`, `/pedidos`, `/pedidos/nuevo`, `/clientes`, `/productos`, `/reportes`, `/configuracion`; browser back/forward now changes modules inside the app. `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-08-14T22:33:37Z.
- **Role closure and attachments**: `Nuevo pedido` restricted to admin/comercial in UI and SQL; order detail now lists uploaded attachments by workflow stage. `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-08-15T00:33:05Z.
- **Customer-specific pricing (R3 demo feedback)**: Added `dromedario.customer_product_prices` table/RLS, `CustomerProductPrice` type, a "Precios" drawer in Clientes to set a client's negotiated price per product, and auto-fill of that price (with catalog default fallback) in Nuevo pedido. `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-09-08T15:14:00Z.
- **Login bootstrap error surfacing**: Fixed a bug where any failure loading profile/app data after a successful sign-in silently bounced the user back to an unlabeled login screen; added a `BootstrapErrorPanel` with the real error and Reintentar/Cerrar sesion actions. Root cause of the reported gerencia@dromedario.co login issue is very likely that `supabase/schema.sql` (with the new `customer_product_prices` table added this session) has not been re-run yet against the live Supabase project — pending user action. `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-09-08T15:22:00Z.
- **Live schema migration applied via CLI**: Linked the Supabase CLI to the project referenced in `.env.local` (qqvcsxglkobqucxsjcwo) and ran `supabase/schema.sql` against it directly (`supabase db query --linked -f ...`), confirmed `dromedario.customer_product_prices` now exists, reloaded PostgREST's schema cache, and confirmed `gerencia@dromedario.co` has `role=admin`/`active=true`. Resolves the reported login error.
- **Product editing added**: Products could only ever be created, never edited, in the frontend (Acciones column always showed "-") even though RLS already allowed admin/facturacion updates. Added `updateProduct` mutation, an "Editar" button per row, and an edit drawer (name/sku/unit/precio base + active toggle). `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-09-08T15:41:00Z.
- **Critical RLS bug fixed - order creation was broken for all roles**: the `orders select by role` policy re-fetched the row by id inside a SECURITY DEFINER function, which cannot see a row still being inserted in the same statement, causing every `INSERT ... RETURNING` (the pattern `createOrder()` uses) to fail with "new row violates row-level security policy for table orders". Fixed by evaluating `order_row_visible_to_current_user(orders.*)` directly against the row instead of re-querying, matching the safe pattern already used by the update policy. Applied live via CLI and reproduced-then-verified the fix directly against the database. `npm run typecheck` and `npm run test` passed on 2026-09-08T16:30:00Z.
- **Deployment configuration (Operations)**: Added `netlify.toml` (build command, `@netlify/plugin-nextjs`, Node 20) and `DEPLOYMENT.md` (prerequisites, env vars table, Supabase setup steps, Vercel and Netlify step-by-step, post-deploy checklist) at the workspace root; README now links to `DEPLOYMENT.md`. Vercel recommended as primary target for native Next.js 16 support; Netlify documented as a fully-configured alternative. Repo still has no `origin` remote configured - pending before either platform can be connected via Git.
- **Schema portability (production shared with Lovable Cloud)**: Client's production Supabase project is managed via Lovable Cloud, which only exposes the `public` schema through the Data API, so the dedicated `dromedario` schema was never reachable and login failed with "Invalid schema: dromedario". Split into two variants: `supabase/schema.sql` (production/shared projects - tables in `public`, prefixed `dromedario_*`) and `supabase/schema.dromedario.sql` (dedicated projects, e.g. local dev - original dedicated-schema design, unprefixed). Frontend and the `admin-create-user` Edge Function now resolve table/schema names at runtime from `NEXT_PUBLIC_SUPABASE_DB_SCHEMA` / the `SUPABASE_DB_SCHEMA` secret (default `public`+prefix). `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-09-10T11:00:00Z.
- **Self-service "Mi cuenta" + fixed a Lovable-injected security trigger blocking admin actions**: any logged-in user can now edit their own Nombre completo and change their own password from a new "Mi cuenta" drawer (sidebar footer, available regardless of role/forced view, e.g. digitador). While diagnosing this, found the real cause of the earlier "No autorizado para modificar rol o estado del perfil" error when creating a digitador user: a Lovable Cloud-auto-generated trigger (`private.dromedario_prevent_profile_escalation`, not something we wrote) that blocked role/active changes without exempting calls made with the `service_role` key - exactly what the `admin-create-user` Edge Function uses. Replaced it with our own `public.dromedario_prevent_self_role_escalation()` (exempts `service_role`; otherwise only allows a role/active/email change when the acting session is itself an admin) plus a new "profiles update own" RLS policy scoped to the row only - the trigger is what actually stops a self-edit from sneaking in a role change, since RLS alone can't restrict which columns change. `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-09-10T12:36:00Z.
- **Admin can now edit an order's line items too, with traceability**: `order_items` previously had no update/delete RLS policy at all (only select/insert), so products/quantities/prices could never change after an order was created. Added admin-only insert/update/delete policies on `dromedario_order_items` (same "admin always" pattern), and extended the same "Editar pedido" form with an editable line-items list (change product/quantity/price per line, remove a line, add a new one) reusing the line-item-grid UI from Nuevo pedido. Saving computes a diff against the current lines and logs it into the same `edited` order_event alongside the field-level changes (e.g. `"Leche de coco: cantidad 2 -> 3, precio $10.000 -> $12.000"`, `"Agregado: ..."`, `"Eliminado: ..."`). `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-09-10T12:11:00Z.
- **Admin can now fully edit an order's factura/remision/despacho, with traceability**: extended the "Editar" form on the order panel (previously only direccion/fecha/observaciones) to also cover Numero de factura, Numero de remision, Guia de envio, and replacing the factura/remision attachment or the guia attachment - all admin-only, on any order regardless of status. Every save computes a field-by-field diff against the previous values and logs it as an `edited` order_event (`"Factura: \"123\" -> \"456\""`, etc.) instead of a generic message, and only fires when something actually changed. Added a matching "admin always" INSERT policy on the storage bucket (`dromedario-order-documents`), since the existing "admin always" UPDATE policy on `dromedario_orders` covered the text fields but file uploads (always a fresh insert, never an in-place update) were still blocked by the actionable-status-only policy on closed orders. `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-09-10T11:55:00Z.
- **New role "Digitador" added**: a fifth, fixed role (not the granular per-menu ACL deferred earlier) restricted to the Clientes module only - can create/edit customers, contacts and customer-specific pricing (reused `current_user_is_backoffice()`, now also covering digitador, for full customer-base visibility instead of only self-created records), but has no access anywhere else. Enforced at the render level (`view` is forced to `"customers"` for this role regardless of URL/back-button/stale links, with the address bar silently corrected to `/clientes`), not just by hiding the sidebar links, so it cannot be bypassed by typing a URL. Added `digitador` to `UserRole`, `ROLE_LABELS`/`ROLE_DESCRIPTIONS`, `ROLE_OPTIONS` (so admin can assign it from Configuracion), the Edge Function's `VALID_ROLES`, and the `profiles.role` check constraint (via `alter table ... drop/add constraint`, since `create table if not exists` does not retrofit a constraint change onto an already-provisioned database) in both schema variants. `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-09-10T11:35:00Z.
- **Full-screen reload on tab refocus / token refresh fixed**: `supabase.auth.onAuthStateChange` treated every event carrying a session (including silent token refreshes and the re-emit that fires when the browser tab regains focus - e.g. after alt-tabbing to look something up, exactly the R4 complaint) as a fresh sign-in, forcing `loading=true` and remounting the whole app behind the "Cargando Dromedario" full-page message - discarding any open drawer or in-progress form not yet covered by sessionStorage draft persistence. Added a `bootstrappedUserIdRef` to only re-run the full bootstrap (and show the loading screen) when the authenticated user actually changes; same-user events now just update the session token silently. `npm run typecheck` and `npm run test` passed on 2026-09-10T11:26:00Z.
- **R4 client feedback (2026-09-10 call with Guillermo Del Rio) implemented**: (1) "Nuevo cliente" and "Nuevo pedido" drafts now persist to `sessionStorage` and restore automatically, so navigating away no longer loses unsaved input. (2) Added an optional "Solicitado por" (nombre/celular/correo) record on the order - informational only, does not create a Contact. (3) "Nuevo pedido" now accepts an initial attachment (orden de compra / captura de WhatsApp), uploaded after order creation and stored as `orders.source_attachment_path`; visible to every role that can already see the order via the existing storage RLS (confirmed Despacho already sees `invoice_file_path` too - no change needed there). (4) Admin can now edit an existing order's Direccion/Fecha solicitada/Observaciones without triggering a status transition (`updateOrderFields`, plus a new always-on admin UPDATE RLS policy on orders since the transition-actionability policy alone would have silently blocked edits on closed orders). (5) Admin can now edit an existing user's Nombre/Rol/Activo from Configuracion (`updateProfile`, uses the pre-existing admin UPDATE policy on profiles - no RLS change needed). (6) Productos module (nav item + page) restricted to admin only in the UI, and the insert/update RLS policies tightened from `admin, facturacion` to `admin` only; read access for building pedidos (comercial et al.) is unaffected. Explicitly deferred: a granular per-menu-item ACL / custom-role system requested in the same call - flagged in the transcript as "no me comprometo" (not committed to), so left as a backlog item, not implemented. DB migration is additive (`alter table ... add column if not exists`, `create/replace` for functions, `drop+create policy` for RLS) and safe to re-run on the already-provisioned production database. `npm run typecheck`, `npm run test`, and `npm run build` passed on 2026-09-10T11:17:00Z.
