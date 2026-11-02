-- =====================================================================
-- TEI Store PMS — database setup (run once in Supabase → SQL Editor)
-- Creates tables, the approval/role system, and security rules.
-- Safe to run on a fresh project. Running it twice will fail on
-- "already exists" — that is expected and harmless.
-- =====================================================================

-- ---------- 1. User profiles (approval + role) ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'staff'   check (role in ('admin','staff','manager')),
  status      text not null default 'pending' check (status in ('pending','approved','rejected','disabled')),
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);

-- Helper checks. SECURITY DEFINER so they can read profiles without
-- tripping the profiles table's own security rules.
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved');
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved' and role = 'admin');
$$;

create or replace function public.can_record_pm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved' and role in ('admin','staff'));
$$;

-- Every new sign-up gets a profile. The very first account becomes an
-- approved Admin; everyone after that starts as Pending.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  select not exists (select 1 from profiles) into is_first;
  insert into profiles (id, email, full_name, role, status, approved_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when is_first then 'admin' else 'staff' end,
    case when is_first then 'approved' else 'pending' end,
    case when is_first then now() else null end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admins cannot change their own role/status (prevents locking yourself out).
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id = auth.uid() and (new.role <> old.role or new.status <> old.status) then
    raise exception 'You cannot change your own role or status.';
  end if;
  return new;
end;
$$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------- 2. PMS data ----------
create table public.stores (
  id         text primary key default gen_random_uuid()::text,
  name       text not null,
  code       text not null default '',
  type       text not null default 'In-Line',
  location   text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment_types (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  prefix      text not null default '',
  category    text not null default 'Other',
  freq_months int  not null default 1 check (freq_months between 1 and 24),
  checklist   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.equipment (
  id         text primary key default gen_random_uuid()::text,
  store_id   text not null references public.stores(id) on delete cascade,
  type_id    text not null references public.equipment_types(id) on delete restrict,
  name       text not null,
  asset_tag  text unique,            -- ready for asset tagging
  brand      text not null default '',
  model      text not null default '',
  serial     text not null default '',
  ip         text not null default '',
  purchased  date,
  warranty   date,
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index equipment_store_idx on public.equipment(store_id);

create table public.pm_records (
  id             text primary key default gen_random_uuid()::text,
  equipment_id   text references public.equipment(id) on delete set null,
  store_id       text references public.stores(id) on delete set null,
  equipment_name text not null default '',   -- snapshot, kept if the item is deleted
  type_name      text not null default '',
  store_name     text not null default '',
  date           date not null,
  next           date,
  tech           text not null default '',
  kind           text not null default 'Preventive' check (kind in ('Preventive','Corrective')),
  status         text not null check (status in ('Operational','For Monitoring','Defective','Under Maintenance')),
  items          jsonb not null default '[]'::jsonb,
  issues         text not null default '',
  action         text not null default '',
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now()
);
create index pm_equipment_idx on public.pm_records(equipment_id);
create index pm_date_idx on public.pm_records(date desc);

-- ---------- 3. Security rules (Row Level Security) ----------
alter table public.profiles        enable row level security;
alter table public.stores          enable row level security;
alter table public.equipment_types enable row level security;
alter table public.equipment       enable row level security;
alter table public.pm_records      enable row level security;

-- Profiles: you see your own; admins see and manage everyone.
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: admin updates" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profiles: admin deletes" on public.profiles
  for delete to authenticated using (public.is_admin());

-- Stores, types, equipment: approved users read; only admins change.
create policy "stores: approved read" on public.stores for select to authenticated using (public.is_approved());
create policy "stores: admin insert"  on public.stores for insert to authenticated with check (public.is_admin());
create policy "stores: admin update"  on public.stores for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "stores: admin delete"  on public.stores for delete to authenticated using (public.is_admin());

create policy "types: approved read" on public.equipment_types for select to authenticated using (public.is_approved());
create policy "types: admin insert"  on public.equipment_types for insert to authenticated with check (public.is_admin());
create policy "types: admin update"  on public.equipment_types for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "types: admin delete"  on public.equipment_types for delete to authenticated using (public.is_admin());

create policy "equipment: approved read" on public.equipment for select to authenticated using (public.is_approved());
create policy "equipment: admin insert"  on public.equipment for insert to authenticated with check (public.is_admin());
create policy "equipment: admin update"  on public.equipment for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "equipment: admin delete"  on public.equipment for delete to authenticated using (public.is_admin());

-- PM records: approved users read; Admin + IT Staff record (as themselves);
-- only admins edit or delete records.
create policy "pm: approved read" on public.pm_records for select to authenticated using (public.is_approved());
create policy "pm: staff insert"  on public.pm_records for insert to authenticated
  with check (public.can_record_pm() and created_by = auth.uid());
create policy "pm: admin update"  on public.pm_records for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "pm: admin delete"  on public.pm_records for delete to authenticated using (public.is_admin());

-- Nobody signed-out (anon) gets any access: no policies are granted to anon.
