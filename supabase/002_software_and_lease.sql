-- =====================================================================
-- TEI Store PMS — update 002: software checks + lease type / daily sales
-- Run once in Supabase → SQL Editor. Safe to run more than once.
-- =====================================================================

-- Equipment types: software to verify during PM, and whether the
-- equipment sends daily sales to the mall (percentage-lease stores).
alter table public.equipment_types add column if not exists software      jsonb   not null default '[]'::jsonb;
alter table public.equipment_types add column if not exists sales_sending boolean not null default false;

-- Stores: lease type and the mall's daily sales interface.
alter table public.stores add column if not exists lease_type     text not null default 'Fixed';
alter table public.stores add column if not exists mall_operator  text not null default '';
alter table public.stores add column if not exists mall_interface text not null default '';
alter table public.stores add column if not exists tenant_id      text not null default '';
alter table public.stores drop constraint if exists stores_lease_type_check;
alter table public.stores add constraint stores_lease_type_check check (lease_type in ('Fixed','Percentage'));

-- PM records: software results and daily sales check results.
alter table public.pm_records add column if not exists software jsonb not null default '[]'::jsonb;
alter table public.pm_records add column if not exists sales    jsonb;

-- Starting software lists (from the Existing Store IT Checklist).
-- Only filled in where a type has no software list yet, so edits made
-- in the app are never overwritten.
update public.equipment_types
   set software = '["WebPOS","AnyDesk","UltraViewer","Browser (Chrome / Brave / Firefox)","WinRAR / 7-Zip","Adobe Acrobat Reader"]'::jsonb,
       sales_sending = true
 where id in ('t-aio','t-minipc','t-tablet') and software = '[]'::jsonb;

update public.equipment_types
   set software = '["Microsoft Office","Adobe Acrobat Reader","AnyDesk","UltraViewer","Browser (Chrome / Brave / Firefox)","WinRAR / 7-Zip","Brother iPrint&Scan"]'::jsonb
 where id = 't-laptop' and software = '[]'::jsonb;
