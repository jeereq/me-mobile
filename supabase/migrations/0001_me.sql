-- Schéma de « me » : un espace privé par compte, une configuration système modifiable par les admins.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text not null default '',
  role text not null default 'utilisateur' check (role in ('admin', 'utilisateur')),
  cree_le timestamptz not null default now()
);

create table if not exists public.espaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  maj_le timestamptz not null default now()
);

create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  maj_le timestamptz not null default now()
);
insert into public.config (id) values (1) on conflict do nothing;

-- Vrai si l'utilisateur connecté est admin (security definer pour éviter la récursion RLS).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Profil créé à l'inscription ; le tout premier compte devient admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nom, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nom', ''),
    case when exists (select 1 from public.profiles) then 'utilisateur' else 'admin' end
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.espaces enable row level security;
alter table public.config enable row level security;

-- Profils : chacun voit le sien ; l'admin voit tout et gère les rôles.
create policy "profil lisible" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profils geres par admin" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- Espaces : strictement privés, même pour l'admin.
create policy "espace prive" on public.espaces for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Configuration : lisible par tout compte connecté, modifiable par les admins.
create policy "config lisible" on public.config for select using (auth.role() = 'authenticated');
create policy "config admin" on public.config for all using (public.is_admin()) with check (public.is_admin());
