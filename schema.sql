-- ReviseRush setup. Safe to run more than once, so just run it again if anything went wrong.
-- Supabase: SQL Editor > New query > paste ALL of this > Run. You should see "Success".

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  year int check (year between 9 and 13),
  subjects text[] not null default '{}',
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_daily date,
  total_points int not null default 0,
  games_played int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists year int check (year between 9 and 13);
alter table public.profiles add column if not exists subjects text[] not null default '{}';
alter table public.profiles add column if not exists qualification text;
alter table public.profiles add column if not exists subject_boards jsonb not null default '{}'::jsonb;
create unique index if not exists profiles_name_lower on public.profiles (lower(display_name));

create table if not exists public.daily_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  play_date date not null,
  subject text not null,
  board text not null,
  score int not null,
  answers int not null,
  created_at timestamptz not null default now(),
  unique (user_id, play_date, subject, board)
);
create index if not exists daily_scores_lookup on public.daily_scores (play_date, subject, board, score desc);

-- Lock the tables: only the game server (secret key) can read or write them.
alter table public.profiles enable row level security;
alter table public.daily_scores enable row level security;

create or replace function public.record_daily(p_user uuid, p_date date, p_subject text, p_board text, p_score int, p_answers int)
returns json language plpgsql security definer set search_path = public as $$
declare p public.profiles; n int;
begin
  insert into public.daily_scores(user_id, play_date, subject, board, score, answers)
  values (p_user, p_date, p_subject, p_board, p_score, p_answers) on conflict do nothing;
  get diagnostics n = row_count;
  select * into p from public.profiles where id = p_user for update;
  if n = 1 then
    update public.profiles set
      current_streak = case when last_daily = p_date then current_streak when last_daily = p_date - 1 then current_streak + 1 else 1 end,
      best_streak = greatest(best_streak, case when last_daily = p_date then current_streak when last_daily = p_date - 1 then current_streak + 1 else 1 end),
      last_daily = greatest(coalesce(last_daily, p_date), p_date),
      total_points = total_points + p_score,
      games_played = games_played + 1
    where id = p_user returning * into p;
  end if;
  return json_build_object('streak', p.current_streak, 'best', p.best_streak, 'total', p.total_points, 'saved', n = 1,
    'rank', (select count(*) + 1 from public.daily_scores d where d.play_date = p_date and d.subject = p_subject and d.board = p_board and d.score > p_score));
end $$;

create or replace function public.leaderboard(p_period text, p_subject text, p_board text, p_date date, p_limit int)
returns table(display_name text, score bigint) language sql security definer set search_path = public as $$
  select pr.display_name, d.s::bigint as score from (
    select user_id, sum(score) s from public.daily_scores
    where p_period in ('daily','weekly','alltime') and subject = p_subject and board = p_board
      and (p_period = 'alltime' or (p_period = 'daily' and play_date = p_date) or (p_period = 'weekly' and play_date > p_date - 7))
    group by user_id) d join public.profiles pr on pr.id = d.user_id
  union all
  select display_name, current_streak::bigint from public.profiles
  where p_period = 'streak' and last_daily >= p_date - 1 and current_streak > 0
  order by 2 desc, 1 limit p_limit
$$;

-- Only the game server may use the functions, and it must be allowed to use the tables.
revoke all on function public.record_daily(uuid, date, text, text, int, int) from public, anon, authenticated;
revoke all on function public.leaderboard(text, text, text, date, int) from public, anon, authenticated;
grant usage on schema public to service_role;
grant all on table public.profiles, public.daily_scores to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.record_daily(uuid, date, text, text, int, int) to service_role;
grant execute on function public.leaderboard(text, text, text, date, int) to service_role;
notify pgrst, 'reload schema';
