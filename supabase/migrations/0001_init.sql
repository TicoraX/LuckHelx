create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  xp_balance integer not null default 0,
  api_key_encrypted text,
  google_refresh_token text,
  -- deepseek_calls_today/date track ACTUAL DeepSeek calls (not tasks created) for the daily rate limit
  deepseek_calls_today integer not null default 0,
  deepseek_calls_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  google_task_id text not null,
  title text not null,
  description text not null default '',
  -- normalized form of description used for cache lookups; description itself stays raw for display
  description_normalized text not null default '',
  xp_value integer,
  xp_reasoning text,
  status text not null default 'pending' check (status in ('pending', 'evaluated', 'completed', 'credited')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, google_task_id)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'shop': direct redemption. 'chest': fixed cost to open, paid once per open. 'chest_item': prize pool entry, xp_cost unused/ignored for these.
  type text not null check (type in ('shop', 'chest', 'chest_item')),
  name text not null,
  xp_cost integer not null check (xp_cost > 0),
  rarity text check (rarity in ('common', 'rare', 'epic')),
  created_at timestamptz not null default now()
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  xp_spent integer not null,
  redeemed_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id);
create policy "own tasks" on public.tasks for all using (auth.uid() = user_id);
create policy "own rewards" on public.rewards for all using (auth.uid() = user_id);
create policy "own redemptions" on public.redemptions for all using (auth.uid() = user_id);

create or replace function public.increment_xp_balance(p_user_id uuid, p_amount integer)
returns void
language sql
as $$
  update public.profiles set xp_balance = xp_balance + p_amount where id = p_user_id;
$$;

-- Resets the counter when the stored date is stale, then increments atomically in one statement.
create or replace function public.increment_deepseek_calls(p_user_id uuid)
returns integer
language sql
as $$
  update public.profiles
  set
    deepseek_calls_today = case when deepseek_calls_date = current_date then deepseek_calls_today + 1 else 1 end,
    deepseek_calls_date = current_date
  where id = p_user_id
  returning deepseek_calls_today;
$$;
