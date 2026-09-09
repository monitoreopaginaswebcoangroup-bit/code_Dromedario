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
