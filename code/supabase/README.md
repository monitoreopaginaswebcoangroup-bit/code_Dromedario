# Supabase Setup

There are two schema variants. Use the `public`/prefixed one unless you have a
Supabase project dedicated exclusively to this app.

## Option A — `public` schema, prefixed tables (production / shared projects)

Required for production and for any Supabase project shared with other apps
(e.g. a Lovable Cloud project), since those only expose `public` through the
Data API.

1. Create a Supabase project (or use an existing one, including a Lovable Cloud project).
2. Open SQL Editor and run `supabase/schema.sql`. It creates its tables in `public`, prefixed `dromedario_*`, so no "Exposed schemas" step is needed.
3. Deploy `supabase/functions/admin-create-user` and configure `SUPABASE_SERVICE_ROLE_KEY` as a Supabase Edge Function secret. Leave the `SUPABASE_DB_SCHEMA` secret unset.
4. Create users in Supabase Auth, or from the app as an admin after deploying the Edge Function.
5. New users start as `comercial`. Set user roles in `public.dromedario_profiles.role`: `admin`, `comercial`, `facturacion` or `despacho`. The `despacho` role prepares orders, registers shipment and reports delivery or novelty.
6. For the first admin, update the profile from SQL Editor:

```sql
update public.dromedario_profiles
set role = 'admin'
where email = 'admin@your-company.com';
```
7. Copy Project URL and anon key into `.env.local` (do not set `NEXT_PUBLIC_SUPABASE_DB_SCHEMA`).

## Option B — dedicated `dromedario` schema (exclusive project, e.g. local dev)

Only for a Supabase project used solely by this app.

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.dromedario.sql`.
3. In Project Settings, API, Exposed schemas, add `dromedario`.
4. Deploy `supabase/functions/admin-create-user`, configure `SUPABASE_SERVICE_ROLE_KEY` as a secret, and set `SUPABASE_DB_SCHEMA=dromedario` as a secret too.
5. Create users in Supabase Auth, or from the app as an admin after deploying the Edge Function.
6. New users start as `comercial`. Set user roles in `dromedario.profiles.role`: `admin`, `comercial`, `facturacion` or `despacho`.
7. For the first admin, update the profile from SQL Editor:

```sql
update dromedario.profiles
set role = 'admin'
where email = 'admin@your-company.com';
```
8. Copy Project URL and anon key into `.env.local`, and set `NEXT_PUBLIC_SUPABASE_DB_SCHEMA=dromedario`.

---

The MVP uses Supabase Auth, PostgreSQL tables (either `public`, prefixed
`dromedario_*`, or a dedicated `dromedario` schema — see above), Row Level
Security and a private storage bucket (`dromedario-order-documents` for
Option A, `order-documents` for Option B).
