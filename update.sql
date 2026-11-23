-- Already ran schema.sql before? Run just this once in the Supabase SQL Editor to add year group and subjects.
alter table public.profiles add column if not exists year int check (year between 9 and 13);
alter table public.profiles add column if not exists subjects text[] not null default '{}';
