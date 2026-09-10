-- Dromedario Pedidos MVP - Supabase schema
-- Application objects live in the public schema, prefixed with dromedario_,
-- because this project is shared with other Lovable-managed functionality
-- and Lovable Cloud does not support exposing a custom schema via the Data API.
-- Run this file in the Supabase SQL Editor before deploying the frontend.

-- One-time cleanup: if an earlier version of this script created a dedicated
-- "dromedario" schema on this project, drop it (safe no-op if it never existed).
drop schema if exists dromedario cascade;

create extension if not exists pgcrypto;

create or replace function public.dromedario_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.dromedario_profiles (
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
alter table public.dromedario_profiles drop constraint if exists dromedario_profiles_role_check;
alter table public.dromedario_profiles add constraint dromedario_profiles_role_check
  check (role in ('admin', 'comercial', 'facturacion', 'despacho', 'digitador'));

create table if not exists public.dromedario_customers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  nit text,
  billing_email text,
  main_address text,
  dispatch_address text,
  assigned_salesperson_id uuid references public.dromedario_profiles(id),
  created_by uuid references public.dromedario_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dromedario_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.dromedario_customers(id) on delete cascade,
  full_name text not null,
  phone text,
  whatsapp text,
  email text,
  position text,
  created_by uuid references public.dromedario_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dromedario_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  unit text not null default 'caja',
  default_price numeric(14, 2) not null default 0,
  active boolean not null default true,
  created_by uuid references public.dromedario_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dromedario_customer_product_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.dromedario_customers(id) on delete cascade,
  product_id uuid not null references public.dromedario_products(id) on delete cascade,
  price numeric(14, 2) not null default 0,
  created_by uuid references public.dromedario_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create table if not exists public.dromedario_orders (
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
  customer_id uuid not null references public.dromedario_customers(id),
  contact_id uuid references public.dromedario_contacts(id),
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'phone', 'email', 'in_person', 'other')),
  assigned_salesperson_id uuid references public.dromedario_profiles(id),
  created_by uuid not null references public.dromedario_profiles(id),
  delivery_address text,
  requested_delivery_date date,
  source_message text,
  source_attachment_path text,
  requested_by_name text,
  requested_by_phone text,
  requested_by_email text,
  notes text,
  admin_approved_by uuid references public.dromedario_profiles(id),
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
alter table public.dromedario_orders add column if not exists source_attachment_path text;
alter table public.dromedario_orders add column if not exists requested_by_name text;
alter table public.dromedario_orders add column if not exists requested_by_phone text;
alter table public.dromedario_orders add column if not exists requested_by_email text;

create table if not exists public.dromedario_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.dromedario_orders(id) on delete cascade,
  product_id uuid references public.dromedario_products(id),
  product_name text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.dromedario_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.dromedario_orders(id) on delete cascade,
  from_status text,
  to_status text,
  action text not null,
  notes text,
  metadata jsonb,
  created_by uuid references public.dromedario_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_dromedario_customers_assigned_salesperson on public.dromedario_customers(assigned_salesperson_id);
create index if not exists idx_dromedario_contacts_customer on public.dromedario_contacts(customer_id);
create index if not exists idx_dromedario_customer_product_prices_customer on public.dromedario_customer_product_prices(customer_id);
create index if not exists idx_dromedario_customer_product_prices_product on public.dromedario_customer_product_prices(product_id);
create index if not exists idx_dromedario_orders_status on public.dromedario_orders(status);
create index if not exists idx_dromedario_orders_created_by on public.dromedario_orders(created_by);
create index if not exists idx_dromedario_orders_assigned_salesperson on public.dromedario_orders(assigned_salesperson_id);
create index if not exists idx_dromedario_order_items_order on public.dromedario_order_items(order_id);
create index if not exists idx_dromedario_order_events_order on public.dromedario_order_events(order_id);

drop trigger if exists set_dromedario_profiles_updated_at on public.dromedario_profiles;
create trigger set_dromedario_profiles_updated_at before update on public.dromedario_profiles for each row execute function public.dromedario_set_updated_at();

drop trigger if exists set_dromedario_customers_updated_at on public.dromedario_customers;
create trigger set_dromedario_customers_updated_at before update on public.dromedario_customers for each row execute function public.dromedario_set_updated_at();

drop trigger if exists set_dromedario_contacts_updated_at on public.dromedario_contacts;
create trigger set_dromedario_contacts_updated_at before update on public.dromedario_contacts for each row execute function public.dromedario_set_updated_at();

drop trigger if exists set_dromedario_products_updated_at on public.dromedario_products;
create trigger set_dromedario_products_updated_at before update on public.dromedario_products for each row execute function public.dromedario_set_updated_at();

drop trigger if exists set_dromedario_customer_product_prices_updated_at on public.dromedario_customer_product_prices;
create trigger set_dromedario_customer_product_prices_updated_at before update on public.dromedario_customer_product_prices for each row execute function public.dromedario_set_updated_at();

drop trigger if exists set_dromedario_orders_updated_at on public.dromedario_orders;
create trigger set_dromedario_orders_updated_at before update on public.dromedario_orders for each row execute function public.dromedario_set_updated_at();

create or replace function public.dromedario_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.dromedario_profiles (id, email, full_name, role)
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

drop trigger if exists on_dromedario_auth_user_created on auth.users;
create trigger on_dromedario_auth_user_created
  after insert on auth.users
  for each row execute function public.dromedario_handle_new_user();

create or replace function public.dromedario_current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.dromedario_profiles where id = auth.uid() and active = true;
$$;

-- "Backoffice" here also covers "digitador" (data-entry only role): both see
-- the full customer/contact/pricing base regardless of assignment, unlike
-- comercial who only sees their own. digitador has no access anywhere else.
create or replace function public.dromedario_current_user_is_backoffice()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.dromedario_current_user_role() in ('admin', 'facturacion', 'despacho', 'digitador'), false);
$$;

create or replace function public.dromedario_order_row_visible_to_current_user(order_record public.dromedario_orders)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.dromedario_current_user_role();
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

create or replace function public.dromedario_order_visible_to_current_user(order_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  order_record public.dromedario_orders%rowtype;
begin
  select * into order_record from public.dromedario_orders where id = order_id;
  if not found then
    return false;
  end if;

  return public.dromedario_order_row_visible_to_current_user(order_record);
end;
$$;

create or replace function public.dromedario_order_row_actionable_by_current_user(order_record public.dromedario_orders)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.dromedario_current_user_role();
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

create or replace function public.dromedario_order_actionable_by_current_user(order_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  order_record public.dromedario_orders%rowtype;
begin
  select * into order_record from public.dromedario_orders where id = order_id;
  if not found then
    return false;
  end if;

  return public.dromedario_order_row_actionable_by_current_user(order_record);
end;
$$;

grant execute on function public.dromedario_set_updated_at() to anon, authenticated, service_role;
grant execute on function public.dromedario_handle_new_user() to anon, authenticated, service_role;
grant execute on function public.dromedario_current_user_role() to anon, authenticated, service_role;
grant execute on function public.dromedario_current_user_is_backoffice() to anon, authenticated, service_role;
grant execute on function public.dromedario_order_row_visible_to_current_user(public.dromedario_orders) to anon, authenticated, service_role;
grant execute on function public.dromedario_order_visible_to_current_user(uuid) to anon, authenticated, service_role;
grant execute on function public.dromedario_order_row_actionable_by_current_user(public.dromedario_orders) to anon, authenticated, service_role;
grant execute on function public.dromedario_order_actionable_by_current_user(uuid) to anon, authenticated, service_role;

grant all on public.dromedario_profiles to anon, authenticated, service_role;
grant all on public.dromedario_customers to anon, authenticated, service_role;
grant all on public.dromedario_contacts to anon, authenticated, service_role;
grant all on public.dromedario_products to anon, authenticated, service_role;
grant all on public.dromedario_customer_product_prices to anon, authenticated, service_role;
grant all on public.dromedario_orders to anon, authenticated, service_role;
grant all on public.dromedario_order_items to anon, authenticated, service_role;
grant all on public.dromedario_order_events to anon, authenticated, service_role;

alter table public.dromedario_profiles enable row level security;
alter table public.dromedario_customers enable row level security;
alter table public.dromedario_contacts enable row level security;
alter table public.dromedario_customer_product_prices enable row level security;
alter table public.dromedario_products enable row level security;
alter table public.dromedario_orders enable row level security;
alter table public.dromedario_order_items enable row level security;
alter table public.dromedario_order_events enable row level security;

drop policy if exists "dromedario profiles select own or admin" on public.dromedario_profiles;
create policy "dromedario profiles select own or admin" on public.dromedario_profiles
for select to authenticated
using (id = auth.uid() or public.dromedario_current_user_role() = 'admin');

drop policy if exists "dromedario profiles insert own" on public.dromedario_profiles;
create policy "dromedario profiles insert own" on public.dromedario_profiles
for insert to authenticated
with check (id = auth.uid() and role = 'comercial' and active = true);

drop policy if exists "dromedario profiles update admin" on public.dromedario_profiles;
create policy "dromedario profiles update admin" on public.dromedario_profiles
for update to authenticated
using (public.dromedario_current_user_role() = 'admin')
with check (public.dromedario_current_user_role() = 'admin');

-- Any authenticated user can update their own profile row (e.g. their
-- Nombre completo from "Mi cuenta"). RLS alone cannot restrict which
-- *columns* change on a row it already allows, so the trigger below is what
-- actually blocks a self-edit from also sneaking in a role/active/email
-- change - this policy only controls which *row* can be touched.
drop policy if exists "dromedario profiles update own" on public.dromedario_profiles;
create policy "dromedario profiles update own" on public.dromedario_profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Replaces a Lovable Cloud-generated guard (private.dromedario_prevent_profile_escalation)
-- that was blocking legitimate admin-driven role changes made through the
-- admin-create-user Edge Function (it runs with the service_role key, which
-- has no bearing on auth.uid()/auth.role() the way that guard expected).
-- This version explicitly exempts service_role calls (our Edge Functions
-- already do their own admin check in application code before writing) and
-- otherwise only allows a role/active/email change when the acting browser
-- session is itself an admin - so a normal self-edit of just "full_name"
-- always succeeds, but cannot also elevate the caller's own role.
drop trigger if exists dromedario_profiles_prevent_escalation on public.dromedario_profiles;
drop function if exists private.dromedario_prevent_profile_escalation();

create or replace function public.dromedario_prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if (
    new.role is distinct from old.role
    or new.active is distinct from old.active
    or new.email is distinct from old.email
  ) and public.dromedario_current_user_role() is distinct from 'admin' then
    raise exception 'No autorizado para modificar rol, correo o estado del perfil';
  end if;

  return new;
end;
$$;

drop trigger if exists dromedario_profiles_prevent_self_role_escalation on public.dromedario_profiles;
create trigger dromedario_profiles_prevent_self_role_escalation
  before update on public.dromedario_profiles
  for each row execute function public.dromedario_prevent_self_role_escalation();

drop policy if exists "dromedario customers select by role" on public.dromedario_customers;
create policy "dromedario customers select by role" on public.dromedario_customers
for select to authenticated
using (
  public.dromedario_current_user_is_backoffice()
  or assigned_salesperson_id = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "dromedario customers insert authenticated" on public.dromedario_customers;
create policy "dromedario customers insert authenticated" on public.dromedario_customers
for insert to authenticated
with check (created_by = auth.uid() or created_by is null);

drop policy if exists "dromedario customers update visible" on public.dromedario_customers;
create policy "dromedario customers update visible" on public.dromedario_customers
for update to authenticated
using (
  public.dromedario_current_user_is_backoffice()
  or assigned_salesperson_id = auth.uid()
  or created_by = auth.uid()
)
with check (
  public.dromedario_current_user_is_backoffice()
  or assigned_salesperson_id = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "dromedario contacts select by customer visibility" on public.dromedario_contacts;
create policy "dromedario contacts select by customer visibility" on public.dromedario_contacts
for select to authenticated
using (
  public.dromedario_current_user_is_backoffice()
  or exists (
    select 1 from public.dromedario_customers c
    where c.id = dromedario_contacts.customer_id
      and (c.assigned_salesperson_id = auth.uid() or c.created_by = auth.uid())
  )
);

drop policy if exists "dromedario contacts insert authenticated" on public.dromedario_contacts;
create policy "dromedario contacts insert authenticated" on public.dromedario_contacts
for insert to authenticated
with check (created_by = auth.uid() or created_by is null);

drop policy if exists "dromedario contacts update visible" on public.dromedario_contacts;
create policy "dromedario contacts update visible" on public.dromedario_contacts
for update to authenticated
using (
  public.dromedario_current_user_is_backoffice()
  or created_by = auth.uid()
  or exists (
    select 1 from public.dromedario_customers c
    where c.id = dromedario_contacts.customer_id
      and c.assigned_salesperson_id = auth.uid()
  )
)
with check (
  public.dromedario_current_user_is_backoffice()
  or created_by = auth.uid()
  or exists (
    select 1 from public.dromedario_customers c
    where c.id = dromedario_contacts.customer_id
      and c.assigned_salesperson_id = auth.uid()
  )
);

drop policy if exists "dromedario customer product prices select by customer visibility" on public.dromedario_customer_product_prices;
create policy "dromedario customer product prices select by customer visibility" on public.dromedario_customer_product_prices
for select to authenticated
using (
  public.dromedario_current_user_is_backoffice()
  or exists (
    select 1 from public.dromedario_customers c
    where c.id = dromedario_customer_product_prices.customer_id
      and (c.assigned_salesperson_id = auth.uid() or c.created_by = auth.uid())
  )
);

drop policy if exists "dromedario customer product prices insert visible customer" on public.dromedario_customer_product_prices;
create policy "dromedario customer product prices insert visible customer" on public.dromedario_customer_product_prices
for insert to authenticated
with check (
  (created_by = auth.uid() or created_by is null)
  and (
    public.dromedario_current_user_is_backoffice()
    or exists (
      select 1 from public.dromedario_customers c
      where c.id = dromedario_customer_product_prices.customer_id
        and (c.assigned_salesperson_id = auth.uid() or c.created_by = auth.uid())
    )
  )
);

drop policy if exists "dromedario customer product prices update visible customer" on public.dromedario_customer_product_prices;
create policy "dromedario customer product prices update visible customer" on public.dromedario_customer_product_prices
for update to authenticated
using (
  public.dromedario_current_user_is_backoffice()
  or exists (
    select 1 from public.dromedario_customers c
    where c.id = dromedario_customer_product_prices.customer_id
      and (c.assigned_salesperson_id = auth.uid() or c.created_by = auth.uid())
  )
)
with check (
  public.dromedario_current_user_is_backoffice()
  or exists (
    select 1 from public.dromedario_customers c
    where c.id = dromedario_customer_product_prices.customer_id
      and (c.assigned_salesperson_id = auth.uid() or c.created_by = auth.uid())
  )
);

drop policy if exists "dromedario products select active" on public.dromedario_products;
create policy "dromedario products select active" on public.dromedario_products
for select to authenticated
using (active = true or public.dromedario_current_user_role() = 'admin');

drop policy if exists "dromedario products insert backoffice" on public.dromedario_products;
drop policy if exists "dromedario products insert admin" on public.dromedario_products;
create policy "dromedario products insert admin" on public.dromedario_products
for insert to authenticated
with check (public.dromedario_current_user_role() = 'admin');

drop policy if exists "dromedario products update backoffice" on public.dromedario_products;
drop policy if exists "dromedario products update admin" on public.dromedario_products;
create policy "dromedario products update admin" on public.dromedario_products
for update to authenticated
using (public.dromedario_current_user_role() = 'admin')
with check (public.dromedario_current_user_role() = 'admin');

drop policy if exists "dromedario orders select by role" on public.dromedario_orders;
create policy "dromedario orders select by role" on public.dromedario_orders
for select to authenticated
using (public.dromedario_order_row_visible_to_current_user(dromedario_orders.*));

drop policy if exists "dromedario orders insert creator" on public.dromedario_orders;
create policy "dromedario orders insert creator" on public.dromedario_orders
for insert to authenticated
with check (created_by = auth.uid() and public.dromedario_current_user_role() in ('admin', 'comercial'));

drop policy if exists "dromedario orders update visible" on public.dromedario_orders;
create policy "dromedario orders update visible" on public.dromedario_orders
for update to authenticated
using (public.dromedario_order_actionable_by_current_user(id))
with check (public.dromedario_order_row_visible_to_current_user(dromedario_orders));

-- Admin can always edit an order's reference fields (address, requested date,
-- notes) even when it is not in an actionable state for a status transition.
drop policy if exists "dromedario orders update admin always" on public.dromedario_orders;
create policy "dromedario orders update admin always" on public.dromedario_orders
for update to authenticated
using (public.dromedario_current_user_role() = 'admin')
with check (public.dromedario_current_user_role() = 'admin');

drop policy if exists "dromedario order items select visible orders" on public.dromedario_order_items;
create policy "dromedario order items select visible orders" on public.dromedario_order_items
for select to authenticated
using (public.dromedario_order_visible_to_current_user(order_id));

drop policy if exists "dromedario order items insert visible orders" on public.dromedario_order_items;
create policy "dromedario order items insert visible orders" on public.dromedario_order_items
for insert to authenticated
with check (
  exists (
    select 1 from public.dromedario_orders o
    where o.id = dromedario_order_items.order_id
      and o.created_by = auth.uid()
      and public.dromedario_current_user_role() in ('admin', 'comercial')
  )
);

-- Admin can always add, edit or remove line items on any order (editing an
-- existing order's products/quantities/prices), regardless of who created it
-- or its current status.
drop policy if exists "dromedario order items admin always insert" on public.dromedario_order_items;
create policy "dromedario order items admin always insert" on public.dromedario_order_items
for insert to authenticated
with check (public.dromedario_current_user_role() = 'admin');

drop policy if exists "dromedario order items admin always update" on public.dromedario_order_items;
create policy "dromedario order items admin always update" on public.dromedario_order_items
for update to authenticated
using (public.dromedario_current_user_role() = 'admin')
with check (public.dromedario_current_user_role() = 'admin');

drop policy if exists "dromedario order items admin always delete" on public.dromedario_order_items;
create policy "dromedario order items admin always delete" on public.dromedario_order_items
for delete to authenticated
using (public.dromedario_current_user_role() = 'admin');

drop policy if exists "dromedario order events select visible orders" on public.dromedario_order_events;
create policy "dromedario order events select visible orders" on public.dromedario_order_events
for select to authenticated
using (public.dromedario_order_visible_to_current_user(order_id));

drop policy if exists "dromedario order events insert visible orders" on public.dromedario_order_events;
create policy "dromedario order events insert visible orders" on public.dromedario_order_events
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.dromedario_order_visible_to_current_user(order_id)
);

insert into public.dromedario_products (name, sku, unit, default_price, active)
values
  ('Crema de coco', 'CREMA-COCO', 'caja', 0, true),
  ('Leche de coco', 'LECHE-COCO', 'caja', 0, true),
  ('Coco deshidratado', 'COCO-DESHIDRATADO', 'saco', 0, true),
  ('Aceite de coco', 'ACEITE-COCO', 'caja', 0, true)
on conflict (sku) do update set name = excluded.name, unit = excluded.unit, active = true;

insert into storage.buckets (id, name, public)
values ('dromedario-order-documents', 'dromedario-order-documents', false)
on conflict (id) do nothing;

drop policy if exists "dromedario order documents select visible orders" on storage.objects;
create policy "dromedario order documents select visible orders" on storage.objects
for select to authenticated
using (
  bucket_id = 'dromedario-order-documents'
  and exists (
    select 1 from public.dromedario_orders o
    where o.id::text = split_part(name, '/', 1)
      and public.dromedario_order_visible_to_current_user(o.id)
  )
);

drop policy if exists "dromedario order documents insert visible orders" on storage.objects;
create policy "dromedario order documents insert visible orders" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'dromedario-order-documents'
  and exists (
    select 1 from public.dromedario_orders o
    where o.id::text = split_part(name, '/', 1)
      and public.dromedario_order_actionable_by_current_user(o.id)
  )
);

-- Admin can always attach a replacement factura/remision/guia file, even on a
-- closed order (delivered/cancelled/rejected), matching the "admin always"
-- update policy on dromedario_orders itself.
drop policy if exists "dromedario order documents admin always insert" on storage.objects;
create policy "dromedario order documents admin always insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'dromedario-order-documents'
  and public.dromedario_current_user_role() = 'admin'
);

drop policy if exists "dromedario order documents update visible orders" on storage.objects;
create policy "dromedario order documents update visible orders" on storage.objects
for update to authenticated
using (
  bucket_id = 'dromedario-order-documents'
  and exists (
    select 1 from public.dromedario_orders o
    where o.id::text = split_part(name, '/', 1)
      and public.dromedario_order_actionable_by_current_user(o.id)
  )
)
with check (
  bucket_id = 'dromedario-order-documents'
  and exists (
    select 1 from public.dromedario_orders o
    where o.id::text = split_part(name, '/', 1)
      and public.dromedario_order_actionable_by_current_user(o.id)
  )
);

insert into public.dromedario_profiles (id, email, full_name, role, active)
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
