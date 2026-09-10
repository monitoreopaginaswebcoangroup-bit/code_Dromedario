# Dromedario Pedidos MVP

MVP web para centralizar pedidos recibidos por WhatsApp, llamada o correo, con flujo operativo de aprobacion, facturacion, despacho, entrega/novedad y trazabilidad.

## Stack
- Next.js App Router
- Supabase Auth
- Supabase PostgreSQL with RLS
- Supabase Storage for order documents
- Database tables: `public` schema, prefixed `dromedario_*` (avoids clashing with other apps/tools sharing the same Supabase project)
- Deploy target: Vercel or Netlify

## MVP Scope
- Login with Supabase Auth.
- Roles: `admin`, `comercial`, `facturacion`, `despacho`.
- El rol `despacho` prepara el pedido, registra el envio y reporta entrega o novedad.
- CRUD rapido de clientes, contactos and productos.
- Registro de pedidos con productos, canal, contacto, asesor and direccion de despacho.
- Estados: pendiente aprobacion, pendiente facturacion, remitido pendiente factura, pendiente despacho, despachado, entregado, novedad, rechazado and anulado.
- Los pedidos remitidos pueden pasar a despacho/envio, pero permanecen resaltados como `Factura pendiente` hasta que facturacion registre la factura.
- Eventos de trazabilidad por accion.
- Adjuntos privados de factura/remision/guia via Supabase Storage.
- Dashboard con pedidos activos, historicos and metricas simples de impacto.

## Local Setup
1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Do not put `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, Netlify, Vercel or any browser-facing environment for this app. User creation is handled by a Supabase Edge Function.

3. Run Supabase schema:

Open Supabase SQL Editor and run `supabase/schema.sql`. It creates its tables directly in `public` (prefixed `dromedario_*`), so no extra "Exposed schemas" configuration is needed — this also works on Lovable Cloud projects, which only expose `public` through the Data API.

4. Deploy the admin user Edge Function:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase functions deploy admin-create-user
```

The service role key must live as a Supabase secret for Edge Functions. It is used only after the function validates that the current logged-in user has an active `admin` profile.

5. Create users:

Use Supabase Auth to create accounts, or sign in as an `admin` and create users from Configuracion. New users start as `comercial` unless an admin assigns another role. Valid roles are `admin`, `comercial`, `facturacion`, `despacho`.

For the first admin, run this in Supabase SQL Editor after creating the user:

```sql
update public.dromedario_profiles
set role = 'admin'
where email = 'admin@your-company.com';
```

6. Start the app:

```bash
npm run dev
```

## Deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step guide covering both Vercel (recommended) and Netlify, including the `netlify.toml` plugin config, required environment variables, and a post-deploy checklist.

## Test And Build
```bash
npm run test
npm run typecheck
npm run build
```

## Known MVP Limits
- No automatic WhatsApp, email or call ingestion.
- No ERP/accounting integration.
- No automatic notifications.
- No advanced BI or commercial campaign automation.
- Storage is private and available through signed links from the app.
