-- Deq's database. Paste all of this into Supabase → SQL Editor → New query → Run.
-- Each person's cards are private to them: row level security lets you read and
-- write only rows with your own user id.

create table if not exists public.cards (
  id          uuid primary key,                     -- the card's uid from the phone
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  data        jsonb not null default '{}'::jsonb,   -- name, role, company, place, note…
  updated_at  timestamptz not null,                 -- when it was last edited (newest wins)
  deleted     boolean not null default false,       -- removed cards, so other phones remove them too
  synced_at   timestamptz not null default now()    -- set by the server, used to fetch what's new
);

create index if not exists cards_user_synced on public.cards (user_id, synced_at);

alter table public.cards enable row level security;

drop policy if exists "Own cards only" on public.cards;
create policy "Own cards only" on public.cards
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The server stamps every write, so phones with wrong clocks still sync correctly.
create or replace function public.stamp_synced_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.synced_at = now();
  return new;
end;
$$;

drop trigger if exists cards_stamp_synced_at on public.cards;
create trigger cards_stamp_synced_at
  before insert or update on public.cards
  for each row execute function public.stamp_synced_at();

-- Photos: a private bucket, one folder per person (photos/<user id>/<card>.jpg).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "Own photos: read" on storage.objects;
create policy "Own photos: read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own photos: add" on storage.objects;
create policy "Own photos: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own photos: change" on storage.objects;
create policy "Own photos: change" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own photos: remove" on storage.objects;
create policy "Own photos: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
