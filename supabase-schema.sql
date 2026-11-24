create table if not exists public.app_portfolios (
  slug text primary key check (slug in (
    'dlugoterminowy',
    'krotkoterminowy',
    'poduszka-finansowa',
    'kosia'
  )),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sort_order smallint not null unique check (sort_order between 1 and 4),
  unique (user_id, slug)
);

create table if not exists public.asset_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (user_id, sort_order)
);

create unique index if not exists asset_locations_user_name_idx
  on public.asset_locations (user_id, lower(name));

create table if not exists public.asset_positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_slug text not null references public.app_portfolios (slug) on delete cascade,
  location_id uuid not null references public.asset_locations (id) on delete restrict,
  asset_code text not null check (asset_code in (
    'gold_ounce',
    'emim_as',
    'iwda_as',
    'pl_treasury_bond',
    'etfbw20tr'
  )),
  quantity numeric(20, 8) not null check (quantity > 0),
  purchase_date date,
  purchase_unit_price numeric(20, 8) check (purchase_unit_price is null or purchase_unit_price >= 0),
  bond_issue_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bond_details_match_asset check (
    (asset_code = 'pl_treasury_bond'
      and bond_issue_code is not null
      and bond_issue_code ~ '^(OTS|ROR|DOR|TOS|COI|EDO|ROS|ROD)[0-9]{4}$'
      and purchase_date is not null)
    or
    (asset_code <> 'pl_treasury_bond' and bond_issue_code is null)
  )
);

create index if not exists asset_positions_portfolio_idx
  on public.asset_positions (portfolio_slug);
create index if not exists asset_positions_location_idx
  on public.asset_positions (location_id);

create table if not exists public.asset_price_history (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.asset_positions (id) on delete cascade,
  amount numeric(20, 8) not null check (amount > 0),
  price_type text not null check (price_type in ('unit', 'total')),
  recorded_on date not null default current_date,
  currency char(3) not null default 'PLN' check (currency = 'PLN'),
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'asset_price_history'
       and column_name = 'currency'
  ) then
    execute 'alter table public.asset_price_history alter column currency set default ''PLN''';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'asset_price_history'
       and column_name = 'eur_pln_rate'
  ) and exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'asset_price_history'
       and column_name = 'currency'
  ) then
    execute $migration$
      update public.asset_price_history
         set amount = round(amount * eur_pln_rate, 8),
             currency = 'PLN',
             eur_pln_rate = null
       where upper(btrim(currency)) = 'EUR'
         and eur_pln_rate > 0
    $migration$;
  end if;
end
$$;

create index if not exists asset_price_history_position_date_idx
  on public.asset_price_history (position_id, recorded_on, created_at);

alter table public.app_portfolios enable row level security;
alter table public.asset_locations enable row level security;
alter table public.asset_positions enable row level security;
alter table public.asset_price_history enable row level security;

revoke all on public.app_portfolios from anon, authenticated;
grant select on public.app_portfolios to authenticated;

revoke all on public.asset_locations from anon, authenticated;
grant select, insert, update on public.asset_locations to authenticated;

revoke all on public.asset_positions from anon;
grant select, insert, update, delete on public.asset_positions to authenticated;

revoke all on public.asset_price_history from anon, authenticated;
grant select, insert, update, delete on public.asset_price_history to authenticated;

drop policy if exists "Owner can view fixed portfolios" on public.app_portfolios;
create policy "Owner can view fixed portfolios"
  on public.app_portfolios for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Owner can manage locations" on public.asset_locations;
create policy "Owner can manage locations"
  on public.asset_locations for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner can manage positions" on public.asset_positions;
create policy "Owner can manage positions"
  on public.asset_positions for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_portfolios p
      where p.slug = portfolio_slug
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.app_portfolios p
      where p.slug = portfolio_slug
        and p.user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.asset_locations l
      where l.id = location_id
        and l.user_id = (select auth.uid())
    )
  );

drop policy if exists "Owner can view asset price history" on public.asset_price_history;
create policy "Owner can view asset price history"
  on public.asset_price_history for select
  to authenticated
  using (
    exists (
      select 1
      from public.asset_positions a
      join public.app_portfolios p on p.slug = a.portfolio_slug
      where a.id = position_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Owner can add asset price history" on public.asset_price_history;
create policy "Owner can add asset price history"
  on public.asset_price_history for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.asset_positions a
      join public.app_portfolios p on p.slug = a.portfolio_slug
      where a.id = position_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Owner can update asset price history" on public.asset_price_history;
create policy "Owner can update asset price history"
  on public.asset_price_history for update
  to authenticated
  using (
    exists (
      select 1
      from public.asset_positions a
      join public.app_portfolios p on p.slug = a.portfolio_slug
      where a.id = position_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.asset_positions a
      join public.app_portfolios p on p.slug = a.portfolio_slug
      where a.id = position_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Owner can delete asset price history" on public.asset_price_history;
create policy "Owner can delete asset price history"
  on public.asset_price_history for delete
  to authenticated
  using (
    exists (
      select 1
      from public.asset_positions a
      join public.app_portfolios p on p.slug = a.portfolio_slug
      where a.id = position_id
        and p.user_id = (select auth.uid())
    )
  );

do $$
declare
  owner_id uuid;
begin
  select id
    into owner_id
    from auth.users
   where lower(email) = lower('chmielowiec.ja@gmail.com');

  if owner_id is null then
    raise exception 'Nie znaleziono konta chmielowiec.ja@gmail.com w Supabase Authentication. Zmien adres w supabase-schema.sql.';
  end if;

  insert into public.app_portfolios (slug, user_id, name, sort_order)
  values
    ('dlugoterminowy', owner_id, 'Długoterminowy', 1),
    ('krotkoterminowy', owner_id, 'Krótkoterminowy', 2),
    ('poduszka-finansowa', owner_id, 'Poduszka finansowa', 3),
    ('kosia', owner_id, 'Kosia', 4)
  on conflict (slug) do update
    set user_id = excluded.user_id,
        name = excluded.name,
        sort_order = excluded.sort_order;

  if not exists (
    select 1
      from public.asset_locations
     where user_id = owner_id
  ) then
    insert into public.asset_locations (user_id, name, sort_order)
    values
      (owner_id, 'IKE Zuzia', 1),
      (owner_id, 'XTB', 2),
      (owner_id, 'Obligacje Kuba', 3);
  end if;
end
$$;
