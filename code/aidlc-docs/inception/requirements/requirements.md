# Requirements - Dromedario Pedidos MVP

## Intent Analysis
- **User request**: Generate a functional MVP in under 8 hours using Supabase for backend/database and Vercel or Netlify for a Next.js frontend.
- **Request type**: New project / new internal operations application.
- **Scope estimate**: System-wide greenfield MVP with frontend, database schema, auth, workflow and deployment docs.
- **Complexity estimate**: Moderate. The business workflow is clear, but role-based access, order states and traceability require careful implementation.

## MVP Objective
Build an internal order workflow application for Dromedario that centralizes orders currently received through WhatsApp, calls and email, reduces duplicated WhatsApp approvals, and creates a usable customer/contact/order database for future commercial analysis.

## Timebox Decision
The MVP must be operational quickly, so the first version focuses on manual order registration and workflow tracking. Automated WhatsApp/email ingestion, ERP/accounting integration, advanced BI and production-grade notification automation are intentionally excluded from the first build.

## Users And Roles
- **Admin/Gerencia**: sees all information, approves or rejects orders, reviews metrics and audit trail.
- **Comercial/Asesor**: creates orders, manages customers/contacts, sees orders created by or assigned to them.
- **Facturacion**: receives approved orders, marks invoice/remission data, attaches invoice support.
- **Despacho**: receives invoiced/remitted orders, records dispatch, delivery or novelty.

## Functional Requirements
- FR1: Users can authenticate through Supabase Auth.
- FR2: Users have a profile with role and display name.
- FR3: Authorized users can create and edit customers with legal name, NIT, billing email, main address, dispatch address and assigned salesperson.
- FR4: Authorized users can create and edit contacts with name, phone/WhatsApp, email and role/position.
- FR5: Authorized users can maintain the current product catalog.
- FR6: A user can create an order by selecting customer, contact, channel, assigned salesperson, requested delivery date, delivery address, notes and product lines.
- FR7: Orders move through this MVP workflow: registered, pending admin approval, rejected, pending invoicing, invoiced, remitted pending invoice, pending dispatch, dispatched, delivered, novelty, cancelled.
- FR8: Admin can approve or reject an order and record a reason.
- FR9: Facturacion can mark an order as invoiced or remitted pending invoice and attach invoice/remission support.
- FR9a: A remitted order can move to dispatch/shipment, but it remains highlighted as pending invoice until facturacion registers the invoice.
- FR10: Despacho can mark an order as dispatched with guide information, delivered, or with novelty.
- FR11: Each meaningful order action creates a traceability event.
- FR12: The dashboard shows active orders, pending approval, pending invoicing, remitted pending invoice, dispatched and historical orders.
- FR13: The dashboard exposes simple metrics useful for the Chamber of Commerce impact report: order count, active orders and estimated minutes saved.
- FR14: The app provides a fast mobile-friendly form because many users receive orders from a phone.

## Non-Functional Requirements
- NFR1: Frontend must run as a Next.js app deployable to Vercel or Netlify.
- NFR2: Backend and database must use Supabase with PostgreSQL, Auth, Row Level Security and Storage.
- NFR3: MVP must keep setup simple: two public environment variables for the frontend and SQL setup in Supabase.
- NFR4: UI must be usable on desktop and mobile.
- NFR5: Sensitive sales data must be protected with Supabase RLS policies based on roles.
- NFR6: The application should build locally with `npm run build`.

## Explicit MVP Exclusions
- No automatic reading of WhatsApp, calls or email inboxes.
- No integration with accounting/ERP systems.
- No automatic email/WhatsApp notifications.
- No advanced BI, campaign automation or inventory forecasting.
- No multi-company configuration.

## Success Criteria
- A user can sign in, create a customer/contact/product/order and move the order through approval, invoicing, dispatch and delivery/novelty.
- Admin can see all orders and a concise operational dashboard.
- Commercial users can register orders without exposing all sales information.
- Supabase schema can be applied directly in a project and the frontend can be deployed with Vercel or Netlify.

## Extension Decisions
- Property-Based Testing: disabled for this MVP because it is a CRUD/workflow prototype with limited pure algorithmic complexity.
- Resiliency Baseline: disabled for this MVP because speed of demo is prioritized over production reliability hardening.
- Security Baseline: disabled as an extension, but basic application security is still implemented through Supabase Auth and RLS.
- OWASP Top 10: disabled as an extension, but the MVP avoids service-role exposure and relies on Supabase RLS for authorization.
