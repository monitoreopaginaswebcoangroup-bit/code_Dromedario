-- Incremental migration: R4 client feedback + "digitador" role.
-- Safe to run on the production Supabase project (Lovable Cloud) where
-- supabase/schema.sql (public + dromedario_ prefix variant) was already applied.
-- All statements are idempotent and can be re-run without side effects.

-- 1) New order fields (R4: "Solicitado por" + initial attachment on Nuevo pedido)
alter table public.dromedario_orders add column if not exists source_attachment_path text;
alter table public.dromedario_orders add column if not exists requested_by_name text;
alter table public.dromedario_orders add column if not exists requested_by_phone text;
alter table public.dromedario_orders add column if not exists requested_by_email text;

-- 2) Admin can always edit an order's reference fields (address, requested
-- date, notes), even when it is not in an actionable state for a status
-- transition (R4: "editar pedido" as admin).
drop policy if exists "dromedario orders update admin always" on public.dromedario_orders;
create policy "dromedario orders update admin always" on public.dromedario_orders
for update to authenticated
using (public.dromedario_current_user_role() = 'admin')
with check (public.dromedario_current_user_role() = 'admin');

-- 3) Productos module restricted to admin only (R4: "solamente el
-- administrador" deberia tener acceso). Read access for building pedidos is
-- untouched - only insert/update tighten from (admin, facturacion) to admin.
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

-- 4) New "digitador" role: allow it in the profiles.role check constraint.
alter table public.dromedario_profiles drop constraint if exists dromedario_profiles_role_check;
alter table public.dromedario_profiles add constraint dromedario_profiles_role_check
  check (role in ('admin', 'comercial', 'facturacion', 'despacho', 'digitador'));

-- 5) "digitador" sees the full customer/contact/pricing base (like admin,
-- facturacion, despacho already do), restricted to that module only at the
-- application layer. No other RLS change needed: orders/products policies
-- already exclude any role not explicitly listed.
create or replace function public.dromedario_current_user_is_backoffice()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.dromedario_current_user_role() in ('admin', 'facturacion', 'despacho', 'digitador'), false);
$$;

-- 6) Admin can always attach a replacement factura/remision/guia file on any
-- order, even a closed one (delivered/cancelled/rejected). The orders table
-- update above already allows this for text fields (factura/remision/guia
-- numbers); this is the matching policy for the file itself, since uploads
-- always insert a new object into storage (never update one in place).
drop policy if exists "dromedario order documents admin always insert" on storage.objects;
create policy "dromedario order documents admin always insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'dromedario-order-documents'
  and public.dromedario_current_user_role() = 'admin'
);

-- 7) Admin can always add, edit or remove line items on any order (editing
-- the products/quantities/prices of an existing pedido), regardless of who
-- created it or its current status.
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

-- 8) Let any user edit their own "Nombre completo" from "Mi cuenta" (password
-- changes go through supabase.auth.updateUser, no table/RLS involved).
-- IMPORTANT: this also replaces a Lovable Cloud-generated guard
-- (private.dromedario_prevent_profile_escalation) that was incorrectly
-- blocking the admin-create-user Edge Function itself (it runs with the
-- service_role key, which that guard did not exempt), causing "No autorizado
-- para modificar rol o estado del perfil" when creating e.g. a digitador user.
drop policy if exists "dromedario profiles update own" on public.dromedario_profiles;
create policy "dromedario profiles update own" on public.dromedario_profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

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
