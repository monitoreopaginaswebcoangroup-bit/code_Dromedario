-- Dromedario Pedidos MVP - Supabase schema (dedicated-schema variant)
--
-- Use this file ONLY on a Supabase project that is exclusive to this app
-- (e.g. a personal/local dev project), where you can enable
-- Project Settings > API > Exposed schemas > "dromedario".
--
-- Production (and any project shared with other apps, e.g. Lovable Cloud,
-- which only exposes "public") must instead use `supabase/schema.sql`.
--
-- To match this file, set in .env.local:
--   NEXT_PUBLIC_SUPABASE_DB_SCHEMA=dromedario
-- and, if you deploy the admin-create-user Edge Function against this same
-- project, set the SUPABASE_DB_SCHEMA secret to "dromedario" as well:
--   supabase secrets set SUPABASE_DB_SCHEMA=dromedario

create schema if not exists dromedario;
create extension if not exists pgcrypto;

grant usage on schema dromedario to anon, authenticated, service_role;
grant all on all tables in schema dromedario to anon, authenticated, service_role;
grant all on all routines in schema dromedario to anon, authenticated, service_role;
grant all on all sequences in schema dromedario to anon, authenticated, service_role;
alter default privileges in schema dromedario grant all on tables to anon, authenticated, service_role;
alter default privileges in schema dromedario grant all on routines to anon, authenticated, service_role;
alter default privileges in schema dromedario grant all on sequences to anon, authenticated, service_role;

create or replace function dromedario.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists dromedario.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'comercial' check (role in ('admin', 'comercial', 'facturacion', 'despacho', 'digitador')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "digitador" role added after the initial release: "create table if not
-- exists" above does not update the check constraint on a table that already
-- exists, so re-apply it explicitly to keep re-runs of this script idempotent.
alter table dromedario.profiles drop constraint if exists profiles_role_check;
alter table dromedario.profiles add constraint profiles_role_check
  check (role in ('admin', 'comercial', 'facturacion', 'despacho', 'digitador'));

create table if not exists dromedario.customers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  nit text,
  billing_email text,
  main_address text,
  dispatch_address text,
  assigned_salesperson_id uuid references dromedario.profiles(id),
  created_by uuid references dromedario.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dromedario.contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references dromedario.customers(id) on delete cascade,
  full_name text not null,
  phone text,
  whatsapp text,
  email text,
  position text,
  created_by uuid references dromedario.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dromedario.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  unit text not null default 'caja',
  default_price numeric(14, 2) not null default 0,
  active boolean not null default true,
  created_by uuid references dromedario.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dromedario.customer_product_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references dromedario.customers(id) on delete cascade,
  product_id uuid not null references dromedario.products(id) on delete cascade,
  price numeric(14, 2) not null default 0,
  created_by uuid references dromedario.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create table if not exists dromedario.orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending_approval' check (
    status in (
      'registered',
      'pending_approval',
      'rejected',
      'pending_invoicing',
      'invoiced',
      'remitted_pending_invoice',
      'pending_dispatch',
      'dispatched',
      'delivered',
      'novelty',
      'cancelled'
    )
  ),
  customer_id uuid not null references dromedario.customers(id),
  contact_id uuid references dromedario.contacts(id),
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'phone', 'email', 'in_person', 'other')),
  assigned_salesperson_id uuid references dromedario.profiles(id),
  created_by uuid not null references dromedario.profiles(id),
  delivery_address text,
  requested_delivery_date date,
  source_message text,
  source_attachment_path text,
  requested_by_name text,
  requested_by_phone text,
  requested_by_email text,
  notes text,
  admin_approved_by uuid references dromedario.profiles(id),
  admin_approved_at timestamptz,
  rejection_reason text,
  invoice_number text,
  invoice_file_path text,
  invoiced_at timestamptz,
  remission_number text,
  remitted_at timestamptz,
  dispatch_guide text,
  dispatch_file_path text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  novelty_reason text,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columns added after the initial release: "create table if not exists" above
-- is a no-op on a table that already exists, so these keep re-runs of this
-- script idempotent on a database that was provisioned before this change.
alter table dromedario.orders add column if not exists source_attachment_path text;
alter table dromedario.orders add column if not exists requested_by_name text;
alter table dromedario.orders add column if not exists requested_by_phone text;
alter table dromedario.orders add column if not exists requested_by_email text;

create table if not exists dromedario.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references dromedario.orders(id) on delete cascade,
  product_id uuid references dromedario.products(id),
  product_name text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists dromedario.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references dromedario.orders(id) on delete cascade,
  from_status text,
  to_status text,
  action text not null,
  notes text,
  metadata jsonb,
  created_by uuid references dromedario.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_assigned_salesperson on dromedario.customers(assigned_salesperson_id);
create index if not exists idx_contacts_customer on dromedario.contacts(customer_id);
create index if not exists idx_customer_product_prices_customer on dromedario.customer_product_prices(customer_id);
create index if not exists idx_customer_product_prices_product on dromedario.customer_product_prices(product_id);
create index if not exists idx_orders_status on dromedario.orders(status);
create index if not exists idx_orders_created_by on dromedario.orders(created_by);
create index if not exists idx_orders_assigned_salesperson on dromedario.orders(assigned_salesperson_id);
create index if not exists idx_order_items_order on dromedario.order_items(order_id);
create index if not exists idx_order_events_order on dromedario.order_events(order_id);

drop trigger if exists set_profiles_updated_at on dromedario.profiles;
create trigger set_profiles_updated_at before update on dromedario.profiles for each row execute function dromedario.set_updated_at();

drop trigger if exists set_customers_updated_at on dromedario.customers;
create trigger set_customers_updated_at before update on dromedario.customers for each row execute function dromedario.set_updated_at();

drop trigger if exists set_contacts_updated_at on dromedario.contacts;
create trigger set_contacts_updated_at before update on dromedario.contacts for each row execute function dromedario.set_updated_at();

drop trigger if exists set_products_updated_at on dromedario.products;
create trigger set_products_updated_at before update on dromedario.products for each row execute function dromedario.set_updated_at();

drop trigger if exists set_customer_product_prices_updated_at on dromedario.customer_product_prices;
create trigger set_customer_product_prices_updated_at before update on dromedario.customer_product_prices for each row execute function dromedario.set_updated_at();

drop trigger if exists set_orders_updated_at on dromedario.orders;
create trigger set_orders_updated_at before update on dromedario.orders for each row execute function dromedario.set_updated_at();

create or replace function dromedario.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = dromedario
as $$
begin
  insert into dromedario.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'usuario'), '@', 1)),
    'comercial'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function dromedario.handle_new_user();

create or replace function dromedario.current_user_role()
returns text
language sql
security definer
stable
set search_path = dromedario
as $$
  select role from dromedario.profiles where id = auth.uid() and active = true;
$$;

-- "Backoffice" here also covers "digitador" (data-entry only role): both see
-- the full customer/contact/pricing base regardless of assignment, unlike
-- comercial who only sees their own. digitador has no access anywhere else.
create or replace function dromedario.current_user_is_backoffice()
returns boolean
language sql
security definer
stable
set search_path = dromedario
as $$
  select coalesce(dromedario.current_user_role() in ('admin', 'facturacion', 'despacho', 'digitador'), false);
$$;

create or replace function dromedario.order_row_visible_to_current_user(order_record dromedario.orders)
returns boolean
language plpgsql
security definer
stable
set search_path = dromedario
as $$
declare
  role_name text;
begin
  role_name := dromedario.current_user_role();
  if role_name is null or order_record.id is null then
    return false;
  end if;

  if role_name = 'admin' then
    return true;
  end if;

  if role_name = 'comercial' then
    return order_record.created_by = auth.uid() or order_record.assigned_salesperson_id = auth.uid();
  end if;

  if role_name = 'facturacion' then
    return order_record.status in ('pending_invoicing', 'remitted_pending_invoice')
      or order_record.invoice_number is not null
      or order_record.invoiced_at is not null
      or order_record.remission_number is not null
      or order_record.remitted_at is not null;
  end if;

  if role_name = 'despacho' then
    return order_record.status in ('remitted_pending_invoice', 'pending_dispatch', 'dispatched', 'delivered', 'novelty')
      or order_record.dispatch_guide is not null
      or order_record.dispatch_file_path is not null
      or order_record.dispatched_at is not null
      or order_record.delivered_at is not null;
  end if;

  return false;
end;
$$;

create or replace function dromedario.order_visible_to_current_user(order_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = dromedario
as $$
declare
  order_record dromedario.orders%rowtype;
begin
  select * into order_record from dromedario.orders where id = order_id;
  if not found then
    return false;
  end if;

  return dromedario.order_row_visible_to_current_user(order_record);
end;
$$;

create or replace function dromedario.order_row_actionable_by_current_user(order_record dromedario.orders)
returns boolean
language plpgsql
security definer
stable
set search_path = dromedario
as $$
declare
  role_name text;
begin
  role_name := dromedario.current_user_role();
  if role_name is null or order_record.id is null then
    return false;
  end if;

  if role_name = 'admin' then
    return order_record.status in (
      'registered',
      'pending_approval',
      'pending_invoicing',
      'remitted_pending_invoice',
      'pending_dispatch',
      'dispatched',
      'novelty'
    )
    or (
      order_record.remission_number is not null
      and order_record.invoice_number is null
      and order_record.status in ('delivered', 'novelty')
    );
  end if;

  if role_name = 'comercial' then
    return order_record.status = 'registered'
      and (order_record.created_by = auth.uid() or order_record.assigned_salesperson_id = auth.uid());
  end if;

  if role_name = 'facturacion' then
    return (order_record.status in ('pending_invoicing', 'remitted_pending_invoice') and order_record.invoice_number is null)
      or (
        order_record.remission_number is not null
        and order_record.invoice_number is null
        and order_record.status in ('dispatched', 'delivered', 'novelty')
      );
  end if;

  if role_name = 'despacho' then
    return order_record.status in ('remitted_pending_invoice', 'pending_dispatch', 'dispatched', 'novelty');
  end if;

  return false;
end;
$$;

create or replace function dromedario.order_actionable_by_current_user(order_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = dromedario
as $$
declare
  order_record dromedario.orders%rowtype;
begin
  select * into order_record from dromedario.orders where id = order_id;
  if not found then
    return false;
  end if;

  return dromedario.order_row_actionable_by_current_user(order_record);
end;
$$;

alter table dromedario.profiles enable row level security;
alter table dromedario.customers enable row level security;
alter table dromedario.contacts enable row level security;
alter table dromedario.customer_product_prices enable row level security;
alter table dromedario.products enable row level security;
alter table dromedario.orders enable row level security;
alter table dromedario.order_items enable row level security;
alter table dromedario.order_events enable row level security;

drop policy if exists "profiles select own or admin" on dromedario.profiles;
create policy "profiles select own or admin" on dromedario.profiles
for select to authenticated
using (id = auth.uid() or dromedario.current_user_role() = 'admin');

drop policy if exists "profiles insert own" on dromedario.profiles;
create policy "profiles insert own" on dromedario.profiles
for insert to authenticated
with check (id = auth.uid() and role = 'comercial' and active = true);

drop policy if exists "profiles update own or admin" on dromedario.profiles;
drop policy if exists "profiles update admin" on dromedario.profiles;
create policy "profiles update admin" on dromedario.profiles
for update to authenticated
using (dromedario.current_user_role() = 'admin')
with check (dromedario.current_user_role() = 'admin');

-- Any authenticated user can update their own profile row (e.g. their
-- Nombre completo from "Mi cuenta"). RLS alone cannot restrict which
-- *columns* change on a row it already allows, so the trigger below is what
-- actually blocks a self-edit from also sneaking in a role/active/email
-- change - this policy only controls which *row* can be touched.
drop policy if exists "profiles update own" on dromedario.profiles;
create policy "profiles update own" on dromedario.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create or replace function dromedario.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = dromedario
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if (
    new.role is distinct from old.role
    or new.active is distinct from old.active
    or new.email is distinct from old.email
  ) and dromedario.current_user_role() is distinct from 'admin' then
    raise exception 'No autorizado para modificar rol, correo o estado del perfil';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_escalation on dromedario.profiles;
create trigger profiles_prevent_self_role_escalation
  before update on dromedario.profiles
  for each row execute function dromedario.prevent_self_role_escalation();

drop policy if exists "customers select by role" on dromedario.customers;
create policy "customers select by role" on dromedario.customers
for select to authenticated
using (
  dromedario.current_user_is_backoffice()
  or assigned_salesperson_id = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "customers insert authenticated" on dromedario.customers;
create policy "customers insert authenticated" on dromedario.customers
for insert to authenticated
with check (created_by = auth.uid() or created_by is null);

drop policy if exists "customers update visible" on dromedario.customers;
create policy "customers update visible" on dromedario.customers
for update to authenticated
using (
  dromedario.current_user_is_backoffice()
  or assigned_salesperson_id = auth.uid()
  or created_by = auth.uid()
)
with check (
  dromedario.current_user_is_backoffice()
  or assigned_salesperson_id = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "contacts select by customer visibility" on dromedario.contacts;
create policy "contacts select by customer visibility" on dromedario.contacts
for select to authenticated
using (
  dromedario.current_user_is_backoffice()
  or exists (
    select 1 from dromedario.customers c
    where c.id = contacts.customer_id
      and (c.assigned_salesperson_id = auth.uid() or c.created_by = auth.uid())
  )
);

drop policy if exists "contacts insert authenticated" on dromedario.contacts;
create policy "contacts insert authenticated" on dromedario.contacts
for insert to authenticated
with check (created_by = auth.uid() or created_by is null);

drop policy if exists "contacts update visible" on dromedario.contacts;
create policy "contacts update visible" on dromedario.contacts
for update to authenticated
using (
  dromedario.current_user_is_backoffice()
  or created_by = auth.uid()
  or exists (
    select 1 from dromedario.customers c
    where c.id = contacts.customer_id
      and c.assigned_salesperson_id = auth.uid()
  )
)
with check (
  dromedario.current_user_is_backoffice()
  or created_by = auth.uid()
  or exists (
    select 1 from dromedario.customers c
    where c.id = contacts.customer_id
      and c.assigned_salesperson_id = auth.uid()
  )
);

drop policy if exists "customer product prices select by customer visibility" on dromedario.customer_product_prices;
create policy "customer product prices select by customer visibility" on dromedario.customer_product_prices
for select to authenticated
using (
  dromedario.current_user_is_backoffice()
  or exists (
    select 1 from dromedario.customers c
    where c.id = customer_product_prices.customer_id
      and (c.assigned_salesperson_id = auth.uid() or c.created_by = auth.uid())
  )
);

drop policy if exists "customer product prices insert visible customer" on dromedario.customer_product_prices;
create policy "customer product prices insert visible customer" on dromedario.customer_product_prices
for insert to authenticated
with check (
  (created_by = auth.uid() or created_by is null)
  and (
    dromedario.current_user_is_backoffice()
    or exists (
      select 1 from dromedario.customers c
      where c.id = customer_product_prices.customer_id
        and (c.assigned_salesperson_id = auth.uid() or c.created_by = auth.uid())
    )
  )
);

drop policy if exists "customer product prices update visible customer" on dromedario.customer_product_prices;
create policy "customer product prices update visible customer" on dromedario.customer_product_prices
for update to authenticated
using (
  dromedario.current_user_is_backoffice()
  or exists (
    select 1 from dromedario.customers c
    where c.id = customer_product_prices.customer_id
      and (c.assigned_salesperson_id = auth.uid() or c.created_by = auth.uid())
  )
)
with check (
  dromedario.current_user_is_backoffice()
  or exists (
    select 1 from dromedario.customers c
    where c.id = customer_product_prices.customer_id
      and (c.assigned_salesperson_id = auth.uid() or c.created_by = auth.uid())
  )
);

drop policy if exists "products select active" on dromedario.products;
create policy "products select active" on dromedario.products
for select to authenticated
using (active = true or dromedario.current_user_role() = 'admin');

drop policy if exists "products insert backoffice" on dromedario.products;
drop policy if exists "products insert admin" on dromedario.products;
create policy "products insert admin" on dromedario.products
for insert to authenticated
with check (dromedario.current_user_role() = 'admin');

drop policy if exists "products update backoffice" on dromedario.products;
drop policy if exists "products update admin" on dromedario.products;
create policy "products update admin" on dromedario.products
for update to authenticated
using (dromedario.current_user_role() = 'admin')
with check (dromedario.current_user_role() = 'admin');

drop policy if exists "orders select by role" on dromedario.orders;
create policy "orders select by role" on dromedario.orders
for select to authenticated
using (dromedario.order_row_visible_to_current_user(orders.*));

drop policy if exists "orders insert creator" on dromedario.orders;
create policy "orders insert creator" on dromedario.orders
for insert to authenticated
with check (created_by = auth.uid() and dromedario.current_user_role() in ('admin', 'comercial'));

drop policy if exists "orders update visible" on dromedario.orders;
create policy "orders update visible" on dromedario.orders
for update to authenticated
using (dromedario.order_actionable_by_current_user(id))
with check (dromedario.order_row_visible_to_current_user(orders));

-- Admin can always edit an order's reference fields (address, requested date,
-- notes) even when it is not in an actionable state for a status transition.
drop policy if exists "orders update admin always" on dromedario.orders;
create policy "orders update admin always" on dromedario.orders
for update to authenticated
using (dromedario.current_user_role() = 'admin')
with check (dromedario.current_user_role() = 'admin');

drop policy if exists "order items select visible orders" on dromedario.order_items;
create policy "order items select visible orders" on dromedario.order_items
for select to authenticated
using (dromedario.order_visible_to_current_user(order_id));

drop policy if exists "order items insert visible orders" on dromedario.order_items;
create policy "order items insert visible orders" on dromedario.order_items
for insert to authenticated
with check (
  exists (
    select 1 from dromedario.orders o
    where o.id = order_items.order_id
      and o.created_by = auth.uid()
      and dromedario.current_user_role() in ('admin', 'comercial')
  )
);

-- Admin can always add, edit or remove line items on any order (editing an
-- existing order's products/quantities/prices), regardless of who created it
-- or its current status.
drop policy if exists "order items admin always insert" on dromedario.order_items;
create policy "order items admin always insert" on dromedario.order_items
for insert to authenticated
with check (dromedario.current_user_role() = 'admin');

drop policy if exists "order items admin always update" on dromedario.order_items;
create policy "order items admin always update" on dromedario.order_items
for update to authenticated
using (dromedario.current_user_role() = 'admin')
with check (dromedario.current_user_role() = 'admin');

drop policy if exists "order items admin always delete" on dromedario.order_items;
create policy "order items admin always delete" on dromedario.order_items
for delete to authenticated
using (dromedario.current_user_role() = 'admin');

drop policy if exists "order events select visible orders" on dromedario.order_events;
create policy "order events select visible orders" on dromedario.order_events
for select to authenticated
using (dromedario.order_visible_to_current_user(order_id));

drop policy if exists "order events insert visible orders" on dromedario.order_events;
create policy "order events insert visible orders" on dromedario.order_events
for insert to authenticated
with check (
  created_by = auth.uid()
  and dromedario.order_visible_to_current_user(order_id)
);

insert into dromedario.products (name, sku, unit, default_price, active)
values
  ('Crema de coco', 'CREMA-COCO', 'caja', 0, true),
  ('Leche de coco', 'LECHE-COCO', 'caja', 0, true),
  ('Coco deshidratado', 'COCO-DESHIDRATADO', 'saco', 0, true),
  ('Aceite de coco', 'ACEITE-COCO', 'caja', 0, true)
on conflict (sku) do update set name = excluded.name, unit = excluded.unit, active = true;

insert into storage.buckets (id, name, public)
values ('order-documents', 'order-documents', false)
on conflict (id) do nothing;

drop policy if exists "order documents select visible orders" on storage.objects;
create policy "order documents select visible orders" on storage.objects
for select to authenticated
using (
  bucket_id = 'order-documents'
  and exists (
    select 1 from dromedario.orders o
    where o.id::text = split_part(name, '/', 1)
      and dromedario.order_visible_to_current_user(o.id)
  )
);

drop policy if exists "order documents insert visible orders" on storage.objects;
create policy "order documents insert visible orders" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'order-documents'
  and exists (
    select 1 from dromedario.orders o
    where o.id::text = split_part(name, '/', 1)
      and dromedario.order_actionable_by_current_user(o.id)
  )
);

-- Admin can always attach a replacement factura/remision/guia file, even on a
-- closed order (delivered/cancelled/rejected), matching the "admin always"
-- update policy on dromedario.orders itself.
drop policy if exists "order documents admin always insert" on storage.objects;
create policy "order documents admin always insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'order-documents'
  and dromedario.current_user_role() = 'admin'
);

drop policy if exists "order documents update visible orders" on storage.objects;
create policy "order documents update visible orders" on storage.objects
for update to authenticated
using (
  bucket_id = 'order-documents'
  and exists (
    select 1 from dromedario.orders o
    where o.id::text = split_part(name, '/', 1)
      and dromedario.order_actionable_by_current_user(o.id)
  )
)
with check (
  bucket_id = 'order-documents'
  and exists (
    select 1 from dromedario.orders o
    where o.id::text = split_part(name, '/', 1)
      and dromedario.order_actionable_by_current_user(o.id)
  )
);

insert into dromedario.profiles (id, email, full_name, role, active)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)),
  'admin',
  true
from auth.users
where email = 'gerencia@dromedario.co'
on conflict (id) do update
set role = 'admin',
    active = true,
    updated_at = now();
