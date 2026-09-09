# Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Project Settings, API, Exposed schemas, add `dromedario`.
4. Deploy `supabase/functions/admin-create-user` and configure `SUPABASE_SERVICE_ROLE_KEY` as a Supabase Edge Function secret.
5. Create users in Supabase Auth, or from the app as an admin after deploying the Edge Function.
6. New users start as `comercial`. Set user roles in `dromedario.profiles.role`: `admin`, `comercial`, `facturacion` or `despacho`. The `despacho` role prepares orders, registers shipment and reports delivery or novelty.
7. For the first admin, update the profile from SQL Editor:

```sql
update dromedario.profiles
set role = 'admin'
where email = 'admin@your-company.com';
```
8. Copy Project URL and anon key into `.env.local`.

The MVP uses Supabase Auth, PostgreSQL tables under `dromedario`, Row Level Security and a private `order-documents` storage bucket.
