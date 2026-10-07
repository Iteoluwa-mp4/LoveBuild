-- =====================================================================
-- LoveBuilds — initial schema
--
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New
-- query), or with `supabase db push`.
--
-- The security model, in one paragraph: the anon key ships inside the
-- browser bundle — that is how Supabase works, and it is only safe because
-- the policies below filter every row. The anon key can read published sites
-- and nothing else. Drafts are reachable only by the account that owns
-- them. If a policy here is wrong, someone's draft is public. That is the
-- one thing to test after running this.
-- =====================================================================

-- ---------------------------------------------------------------------
-- sites
-- ---------------------------------------------------------------------
create table if not exists public.sites (
  id         uuid primary key default gen_random_uuid(),

  -- URL segment: /s/<slug>. Lowercase letters, digits and hyphens only.
  slug       text unique not null check (slug ~ '^[a-z0-9-]+$'),

  -- Who may edit it. Not null, deliberately: a site with no owner would be
  -- unreachable and, under the select policies, invisible to everyone.
  owner_id   uuid not null references auth.users (id) on delete cascade,

  -- Publication state. This column is the ONLY source of truth for status;
  -- it is deliberately absent from the config JSON so the two cannot
  -- disagree.
  --
  --   draft     invisible to the public (what new sites start as)
  --   submitted  also invisible; exists if a review gate is ever wanted
  --   published what the shared link serves
  status     text not null default 'draft'
             check (status in ('draft', 'submitted', 'published')),

  -- The whole site, validated by src/lib/site/schema.ts on both write and
  -- read. Kept as jsonb so a new field does not need a migration, at the
  -- cost of the database not being able to check its shape.
  config     jsonb not null,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Listing a person's own sites is the common query.
create index if not exists sites_owner_idx on public.sites (owner_id);
-- The public read hits this on every page load.
create index if not exists sites_published_idx on public.sites (slug)
  where status = 'published';

-- ---------------------------------------------------------------------
-- site_media
--
-- Bookkeeping for uploads. The config holds the URL the renderer fetches;
-- this holds the Cloudinary public id, which is what you need in order to
-- actually delete the asset later. Without it, removing a photo from a site
-- orphans the file and it is still being paid for forever.
-- ---------------------------------------------------------------------
create table if not exists public.site_media (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.sites (id) on delete cascade,
  public_id    text not null,
  kind         text not null check (kind in ('image', 'video')),
  bytes        integer,
  width        integer,
  height       integer,
  duration_ms  integer,
  created_at   timestamptz default now()
);

create index if not exists site_media_site_idx on public.site_media (site_id);

-- =====================================================================
-- Row level security
--
-- Enabled on every table. A table with RLS off is fully readable by anyone
-- holding the anon key, which is anyone at all.
-- =====================================================================
alter table public.sites enable row level security;
alter table public.site_media enable row level security;

-- ---------------------------------------------------------------------
-- sites policies
--
-- Select policies are OR-ed together, so both are needed: without the
-- second one the owner could not open their own draft, and without the
-- first one the shared link would not work.
-- ---------------------------------------------------------------------

-- Anyone may read a published site. This is the whole point of sharing one.
create policy "published sites are public"
  on public.sites for select
  using (status = 'published');

-- Owners read their own work, whatever its status. `auth.uid()` is null when
-- nobody is signed in, and `owner_id = null` is never true, so this policy
-- grants nothing to an anonymous visitor.
create policy "owners read their own sites"
  on public.sites for select
  using (owner_id = auth.uid());

-- The owner sets themselves on insert; `with check` stops anyone claiming to
-- own somebody else's site.
create policy "owners create their own sites"
  on public.sites for insert
  with check (owner_id = auth.uid());

create policy "owners update their own sites"
  on public.sites for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owners delete their own sites"
  on public.sites for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- site_media policies
--
-- Public read follows the parent site's visibility, so a photo from a draft
-- is not readable by guessing its id.
-- ---------------------------------------------------------------------
create policy "media for published sites is public"
  on public.site_media for select
  using (
    exists (
      select 1 from public.sites s
      where s.id = site_media.site_id
        and s.status = 'published'
    )
  );

create policy "owners read their own media"
  on public.site_media for select
  using (
    exists (
      select 1 from public.sites s
      where s.id = site_media.site_id
        and s.owner_id = auth.uid()
    )
  );

create policy "owners create media for their own sites"
  on public.site_media for insert
  with check (
    exists (
      select 1 from public.sites s
      where s.id = site_media.site_id
        and s.owner_id = auth.uid()
    )
  );

create policy "owners delete media for their own sites"
  on public.site_media for delete
  using (
    exists (
      select 1 from public.sites s
      where s.id = site_media.site_id
        and s.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- updated_at
--
-- Set on write rather than by the client, so a stale timestamp cannot be
-- pushed from the browser and corrupt the "most recent" ordering.
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sites_touch_updated_at on public.sites;
create trigger sites_touch_updated_at
  before update on public.sites
  for each row execute function public.touch_updated_at();