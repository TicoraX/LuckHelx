-- Replaces the check-then-act pattern (select balance, then separately decrement) with a single
-- atomic conditional update, so two concurrent redemptions can't both pass the balance check.
create or replace function public.redeem_xp_if_sufficient(p_user_id uuid, p_cost integer)
returns integer
language sql
as $$
  update public.profiles
  set xp_balance = xp_balance - p_cost
  where id = p_user_id and xp_balance >= p_cost
  returning xp_balance;
$$;
