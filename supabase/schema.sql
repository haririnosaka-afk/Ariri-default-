create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  balance integer not null default 0 check (balance >= 0),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  kind text not null check (kind in ('purchase','admin_credit','generate','refund','admin_adjustment')),
  description text not null default '',
  reference_id text,
  created_at timestamptz not null default now()
);
create index if not exists token_ledger_user_created_idx on public.token_ledger(user_id, created_at desc);
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_reference text not null,
  provider_job_id text not null,
  created_at timestamptz not null default now(),
  unique(user_id, token_reference),
  unique(user_id, provider_job_id)
);
create index if not exists generation_jobs_user_ref_idx
  on public.generation_jobs(user_id, token_reference);
alter table public.generation_jobs enable row level security;
revoke all on public.generation_jobs from public, anon, authenticated;

create unique index if not exists token_ledger_reference_kind_unique
  on public.token_ledger(user_id, reference_id, kind)
  where reference_id is not null and kind in ('generate','refund');

alter table public.profiles enable row level security;
alter table public.token_ledger enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "read own ledger" on public.token_ledger;
create policy "read own ledger" on public.token_ledger for select using (auth.uid() = user_id);
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.token_ledger from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id,email,balance) values(new.id,new.email,0)
  on conflict (id) do update set email=excluded.email;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.spend_token(p_user_id uuid, p_reference_id text default null)
returns integer language plpgsql security definer set search_path = public
as $$
declare new_balance integer;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  if p_reference_id is null or length(trim(p_reference_id)) = 0 then raise exception 'reference_required'; end if;
  if exists(select 1 from public.token_ledger where user_id=p_user_id and reference_id=p_reference_id and kind='generate') then
    select balance into new_balance from public.profiles where id=p_user_id;
    return new_balance;
  end if;
  update public.profiles set balance=balance-1, updated_at=now()
  where id=p_user_id and balance>=1 returning balance into new_balance;
  if new_balance is null then raise exception 'insufficient_tokens'; end if;
  insert into public.token_ledger(user_id,amount,kind,description,reference_id)
  values(p_user_id,-1,'generate','Video/image/audio generation',p_reference_id);
  return new_balance;
end; $$;

create or replace function public.refund_token(p_user_id uuid, p_reference_id text, p_reason text default 'Generation failed')
returns integer language plpgsql security definer set search_path = public
as $$
declare new_balance integer;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  if p_reference_id is null or length(trim(p_reference_id)) = 0 then raise exception 'reference_required'; end if;
  perform 1 from public.profiles where id=p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  if exists(select 1 from public.token_ledger where user_id=p_user_id and reference_id=p_reference_id and kind='refund') then
    select balance into new_balance from public.profiles where id=p_user_id;
    return new_balance;
  end if;
  if not exists(select 1 from public.token_ledger where user_id=p_user_id and reference_id=p_reference_id and kind='generate') then
    raise exception 'charge_not_found';
  end if;
  update public.profiles set balance=balance+1, updated_at=now() where id=p_user_id returning balance into new_balance;
  insert into public.token_ledger(user_id,amount,kind,description,reference_id)
  values(p_user_id,1,'refund',p_reason,p_reference_id);
  return new_balance;
end; $$;

create or replace function public.admin_add_tokens(p_user_id uuid, p_amount integer, p_description text default 'Token purchase')
returns integer language plpgsql security definer set search_path = public
as $$
declare new_balance integer;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  if p_amount < 1 or p_amount > 100000 then raise exception 'invalid_amount'; end if;
  update public.profiles set balance=balance+p_amount, updated_at=now() where id=p_user_id returning balance into new_balance;
  if new_balance is null then raise exception 'user_not_found'; end if;
  insert into public.token_ledger(user_id,amount,kind,description)
  values(p_user_id,p_amount,'purchase',p_description);
  return new_balance;
end; $$;

revoke all on function public.spend_token(uuid,text) from public, anon, authenticated;
revoke all on function public.refund_token(uuid,text,text) from public, anon, authenticated;
revoke all on function public.admin_add_tokens(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.spend_token(uuid,text) to service_role;
grant execute on function public.refund_token(uuid,text,text) to service_role;
grant execute on function public.admin_add_tokens(uuid,integer,text) to service_role;


-- Telegram account linking. Codes are stored only as SHA-256 hashes and expire.
create table if not exists public.telegram_account_links (
  telegram_user_id bigint primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  telegram_chat_id bigint not null,
  telegram_username text,
  linked_at timestamptz not null default now()
);
create table if not exists public.telegram_link_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists telegram_link_codes_user_idx on public.telegram_link_codes(user_id);
alter table public.telegram_account_links enable row level security;
alter table public.telegram_link_codes enable row level security;
revoke all on public.telegram_account_links from public, anon, authenticated;
revoke all on public.telegram_link_codes from public, anon, authenticated;
