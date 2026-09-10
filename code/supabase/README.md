# Supabase Setup

1. Create a Supabase project (or use an existing one, including a Lovable Cloud project).
2. Open SQL Editor and run `supabase/schema.sql`. It creates its tables in `public`, prefixed `dromedario_*`, so no "Exposed schemas" step is needed (works on Lovable Cloud too, which only exposes `public`).
3. Deploy `supabase/functions/admin-create-user` and configure `SUPABASE_SERVICE_ROLE_KEY` as a Supabase Edge Function secret.
4. Create users in Supabase Auth, or from the app as an admin after deploying the Edge Function.
5. New users start as `comercial`. Set user roles in `public.dromedario_profiles.role`: `admin`, `comercial`, `facturacion` or `despacho`. The `despacho` role prepares orders, registers shipment and reports delivery or novelty.
6. For the first admin, update the profile from SQL Editor:

```sql
update public.dromedario_profiles
set role = 'admin'
where email = 'admin@your-company.com';
```
7. Copy Project URL and anon key into `.env.local`.

The MVP uses Supabase Auth, PostgreSQL tables under `public` (prefixed `dromedario_*` to avoid clashing with other apps sharing the project), Row Level Security and a private `dromedario-order-documents` storage bucket.
