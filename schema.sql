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

-- Revision library: topic notes, confidence tracking and exam practice.
create table if not exists public.revision_topics (
  id uuid primary key default gen_random_uuid(),
  qualification text not null check (qualification in ('GCSE','A-level')),
  subject text not null,
  board text not null,
  title text not null,
  slug text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (qualification, subject, board, slug)
);

create table if not exists public.revision_notes (
  topic_id uuid primary key references public.revision_topics(id) on delete cascade,
  content text not null default '',
  key_terms text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.revision_topics(id) on delete cascade,
  prompt text not null,
  marks int not null check (marks > 0 and marks <= 30),
  model_answer text not null,
  explanation text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (topic_id, sort_order)
);

create table if not exists public.topic_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.revision_topics(id) on delete cascade,
  confidence text not null check (confidence in ('confident','somewhat','unsure')),
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id)
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  marks_awarded int not null check (marks_awarded >= 0),
  marks_available int not null check (marks_available > 0),
  created_at timestamptz not null default now(),
  check (marks_awarded <= marks_available)
);

create index if not exists revision_topics_lookup on public.revision_topics (qualification, subject, board, sort_order);
create index if not exists topic_progress_user on public.topic_progress (user_id, topic_id);
create index if not exists exam_attempts_user on public.exam_attempts (user_id, created_at desc);

alter table public.revision_topics enable row level security;
alter table public.revision_notes enable row level security;
alter table public.exam_questions enable row level security;
alter table public.topic_progress enable row level security;
alter table public.exam_attempts enable row level security;
grant all on public.revision_topics, public.revision_notes, public.exam_questions, public.topic_progress, public.exam_attempts to service_role;

-- Starter content to prove the complete notes -> confidence -> exam practice journey.
-- The library can be expanded by adding rows to these tables; no app code change is needed.
insert into public.revision_topics (qualification, subject, board, title, slug, sort_order)
values
  ('GCSE','Biology','AQA','Cell biology','cell-biology',1),
  ('GCSE','Maths','AQA','Fractions, decimals and percentages','fractions-decimals-percentages',1),
  ('A-level','Biology','AQA','Biological molecules','biological-molecules',1)
on conflict (qualification, subject, board, slug) do update set title = excluded.title;

insert into public.revision_notes (topic_id, content, key_terms)
select id,
'Cells are the basic building blocks of living organisms. Most animal and plant cells contain a nucleus, cytoplasm, a cell membrane, mitochondria and ribosomes. The nucleus contains genetic material and controls the activities of the cell. The cytoplasm is where many chemical reactions take place. The cell membrane controls what enters and leaves the cell. Mitochondria are the site of most aerobic respiration, releasing energy for cell processes. Ribosomes are where proteins are made.

Plant cells also have a cellulose cell wall, which strengthens and supports the cell. A permanent vacuole contains cell sap and helps keep the cell rigid. Many plant cells contain chloroplasts, which contain chlorophyll and absorb light for photosynthesis.

Bacterial cells are prokaryotic. They are usually smaller than eukaryotic cells and do not have a nucleus. Their DNA is found as a single circular chromosome in the cytoplasm; they may also contain small rings of DNA called plasmids.

A specialised cell has adaptations that help it carry out a particular function. For example, a sperm cell has a tail for swimming, many mitochondria to supply energy and an acrosome containing enzymes. A root hair cell has a long extension that increases its surface area for absorbing water and mineral ions.',
array['Nucleus','Cytoplasm','Cell membrane','Mitochondria','Ribosome','Cell wall','Chloroplast','Vacuole','Prokaryote','Eukaryote','Specialised cell']
from public.revision_topics where qualification='GCSE' and subject='Biology' and board='AQA' and slug='cell-biology'
on conflict (topic_id) do update set content=excluded.content, key_terms=excluded.key_terms, updated_at=now();

insert into public.revision_notes (topic_id, content, key_terms)
select id,
'A fraction represents part of a whole. The numerator is the number of parts being considered and the denominator is the number of equal parts in the whole. To simplify a fraction, divide the numerator and denominator by the same common factor.

To convert a fraction to a decimal, divide the numerator by the denominator. To convert a terminating decimal to a percentage, multiply by 100. To convert a percentage to a decimal, divide by 100.

To find a percentage of an amount, convert the percentage to a decimal and multiply by the amount. To increase an amount by a percentage, multiply by the appropriate multiplier. For example, an increase of 15% uses a multiplier of 1.15. A decrease of 15% uses a multiplier of 0.85.',
array['Numerator','Denominator','Equivalent fractions','Decimal','Percentage','Multiplier']
from public.revision_topics where qualification='GCSE' and subject='Maths' and board='AQA' and slug='fractions-decimals-percentages'
on conflict (topic_id) do update set content=excluded.content, key_terms=excluded.key_terms, updated_at=now();

insert into public.revision_notes (topic_id, content, key_terms)
select id,
'Biological molecules are essential to the structure and function of living organisms. Carbohydrates contain carbon, hydrogen and oxygen. Monosaccharides such as glucose are single sugar units. Two monosaccharides can join by a condensation reaction to form a disaccharide, and many can join to form a polysaccharide. Glycosidic bonds link the sugar units.

Lipids include triglycerides, which are made from one glycerol molecule and three fatty acids. They are important in energy storage and form part of cell membranes. A triglyceride forms by condensation reactions that create ester bonds.

Proteins are polymers made from amino acid monomers. Amino acids are joined by peptide bonds in condensation reactions. The sequence of amino acids determines how a protein folds and therefore its shape and function. Proteins have structural roles and act as enzymes, transport molecules and antibodies.

Water is a polar molecule. Its properties, including being a good solvent and having a high specific heat capacity, make it important in living systems.',
array['Monomer','Polymer','Monosaccharide','Polysaccharide','Condensation reaction','Hydrolysis','Glycosidic bond','Triglyceride','Peptide bond','Amino acid','Enzyme']
from public.revision_topics where qualification='A-level' and subject='Biology' and board='AQA' and slug='biological-molecules'
on conflict (topic_id) do update set content=excluded.content, key_terms=excluded.key_terms, updated_at=now();

insert into public.exam_questions (topic_id, prompt, marks, model_answer, explanation, sort_order)
select id,
'Describe the functions of the nucleus and mitochondria in an animal cell.',
3,
'The nucleus contains the cell''s genetic material (DNA) and controls the activities of the cell. Mitochondria are the site of most aerobic respiration, where energy is released for cell processes.',
'Award credit for the nucleus containing genetic material/DNA, controlling cell activities, and mitochondria being the site of aerobic respiration or energy release. One mark per distinct correct point.',1
from public.revision_topics where qualification='GCSE' and subject='Biology' and board='AQA' and slug='cell-biology'
on conflict (topic_id, sort_order) do update set prompt=excluded.prompt, marks=excluded.marks, model_answer=excluded.model_answer, explanation=excluded.explanation;

insert into public.exam_questions (topic_id, prompt, marks, model_answer, explanation, sort_order)
select id,
'Give two structures found in plant cells that are not found in typical animal cells, and state the function of one of them.',
3,
'Any two from: cellulose cell wall, chloroplasts, permanent vacuole. The cell wall strengthens and supports the cell; chloroplasts absorb light for photosynthesis; the vacuole contains cell sap and helps keep the cell rigid.',
'One mark for each correct plant-cell structure and one mark for a suitable function linked to one named structure.',2
from public.revision_topics where qualification='GCSE' and subject='Biology' and board='AQA' and slug='cell-biology'
on conflict (topic_id, sort_order) do update set prompt=excluded.prompt, marks=excluded.marks, model_answer=excluded.model_answer, explanation=excluded.explanation;

insert into public.exam_questions (topic_id, prompt, marks, model_answer, explanation, sort_order)
select id,
'Write 3/5 as a decimal and as a percentage.',
2,
'3/5 = 0.6 = 60%.',
'Divide 3 by 5 to obtain 0.6, then multiply by 100 to convert to a percentage.',1
from public.revision_topics where qualification='GCSE' and subject='Maths' and board='AQA' and slug='fractions-decimals-percentages'
on conflict (topic_id, sort_order) do update set prompt=excluded.prompt, marks=excluded.marks, model_answer=excluded.model_answer, explanation=excluded.explanation;

insert into public.exam_questions (topic_id, prompt, marks, model_answer, explanation, sort_order)
select id,
'A jacket costs £80. Its price is increased by 15%. Calculate the new price.',
2,
'£92. Multiply £80 by 1.15: 80 × 1.15 = 92.',
'An increase of 15% means the final amount is 115% of the original. The multiplier is therefore 1.15.',2
from public.revision_topics where qualification='GCSE' and subject='Maths' and board='AQA' and slug='fractions-decimals-percentages'
on conflict (topic_id, sort_order) do update set prompt=excluded.prompt, marks=excluded.marks, model_answer=excluded.model_answer, explanation=excluded.explanation;

insert into public.exam_questions (topic_id, prompt, marks, model_answer, explanation, sort_order)
select id,
'Explain how two amino acids are joined together to form a dipeptide.',
3,
'Two amino acids join in a condensation reaction. A molecule of water is released and a peptide bond forms between the amino acids, producing a dipeptide.',
'Look for the condensation reaction, release of water and formation of a peptide bond.',1
from public.revision_topics where qualification='A-level' and subject='Biology' and board='AQA' and slug='biological-molecules'
on conflict (topic_id, sort_order) do update set prompt=excluded.prompt, marks=excluded.marks, model_answer=excluded.model_answer, explanation=excluded.explanation;

notify pgrst, 'reload schema';
