-- ============================================================================
-- Migration: Initial FlashcardsAI Schema
-- Created: 2026-01-28 01:54:36 UTC
-- Description: Creates complete database schema for FlashcardsAI MVP including:
--   - Extensions and custom types (enums)
--   - Core tables: profiles, tags, flashcards, AI generation sessions
--   - SRS (Spaced Repetition System) tables
--   - Metrics and starter data tables
--   - Row Level Security policies for all tables
--   - Indexes for performance optimization
--   - Triggers for data integrity and automation
-- ============================================================================

-- ============================================================================
-- SECTION 1: Extensions and Custom Types
-- ============================================================================

-- enable pgcrypto extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- enum for flashcard lifecycle status
-- draft: newly created, not yet reviewed by user
-- active: approved by user, visible in SRS
-- rejected: dismissed by user, excluded from SRS
create type flashcard_status as enum ('draft', 'active', 'rejected');

-- enum for flashcard origin tracking
-- generated: created by AI from source text
-- manual: created directly by user
create type flashcard_source as enum ('generated', 'manual');

-- enum for AI generation session lifecycle
-- created: session initialized, awaiting processing
-- processing: AI is generating flashcards
-- completed: generation finished successfully
-- failed: generation encountered an error
create type ai_generation_status as enum ('created', 'processing', 'completed', 'failed');

-- ============================================================================
-- SECTION 2: Core User Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: public.profiles
-- Purpose: Extended user profile data (1:1 with auth.users)
-- Notes: 
--   - Primary key is also a foreign key to auth.users
--   - Serves as the reference point for user_id in all domain tables
--   - Created automatically via trigger when new user signs up
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text null
);

-- enable row level security
alter table public.profiles enable row level security;

-- RLS policy: users can view their own profile
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- RLS policy: users can update their own profile
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Table: public.starter_tags
-- Purpose: Global list of starter tags copied to new users
-- Notes:
--   - Managed by service role only
--   - name_normalized ensures case-insensitive uniqueness with normalized whitespace
--   - sort_order allows admin to control display order in UI
-- ----------------------------------------------------------------------------
create table public.starter_tags (
  id bigint generated always as identity primary key,
  name text not null,
  -- normalized name: lowercase, trimmed, multiple spaces collapsed to single space
  name_normalized text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  
  -- ensure name is not empty after trimming
  constraint starter_tags_name_not_empty check (char_length(trim(name)) > 0),
  -- ensure uniqueness of normalized names
  constraint starter_tags_name_normalized_unique unique (name_normalized)
);

-- enable row level security
alter table public.starter_tags enable row level security;

-- RLS policy: authenticated users can view starter tags
create policy "starter_tags_select_authenticated"
  on public.starter_tags
  for select
  to authenticated
  using (true);

-- RLS policy: anonymous users can view starter tags
create policy "starter_tags_select_anon"
  on public.starter_tags
  for select
  to anon
  using (true);

-- note: insert/update/delete restricted to service role (no policies for authenticated)

-- ----------------------------------------------------------------------------
-- Table: public.tags
-- Purpose: User-specific tags for organizing flashcards
-- Notes:
--   - Each user has their own namespace of tags
--   - name_normalized ensures case-insensitive uniqueness per user
--   - Starter tags are copied here when user is created
-- ----------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  -- normalized name: lowercase, trimmed, multiple spaces collapsed to single space
  name_normalized text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- ensure name is not empty after trimming
  constraint tags_name_not_empty check (char_length(trim(name)) > 0),
  -- ensure uniqueness of normalized names per user
  constraint tags_user_name_normalized_unique unique (user_id, name_normalized)
);

-- enable row level security
alter table public.tags enable row level security;

-- RLS policy: users can view their own tags
create policy "tags_select_own"
  on public.tags
  for select
  to authenticated
  using (user_id = auth.uid());

-- RLS policy: users can insert their own tags
create policy "tags_insert_own"
  on public.tags
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- RLS policy: users can update their own tags
create policy "tags_update_own"
  on public.tags
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RLS policy: users can delete their own tags
create policy "tags_delete_own"
  on public.tags
  for delete
  to authenticated
  using (user_id = auth.uid());

-- index for user's tags ordered by creation date (for listing)
create index tags_user_created_idx on public.tags (user_id, created_at desc);

-- ============================================================================
-- SECTION 3: AI Generation Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: public.ai_generation_sessions
-- Purpose: Track AI flashcard generation sessions
-- Notes:
--   - Stores source text for audit and debugging (no deduplication in MVP)
--   - Status tracks lifecycle from created → processing → completed/failed
--   - source_text_chars is computed column for validation and metrics
-- ----------------------------------------------------------------------------
create table public.ai_generation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status ai_generation_status not null default 'created',
  source_text text not null,
  -- computed: character count of source text
  source_text_chars int generated always as (char_length(source_text)) stored,
  requested_card_count int null,
  generated_card_count int null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  
  -- enforce source text length constraints (300-10000 chars per PRD)
  constraint ai_sessions_source_text_length check (source_text_chars between 300 and 10000)
);

-- enable row level security
alter table public.ai_generation_sessions enable row level security;

-- RLS policy: users can view their own generation sessions
create policy "ai_sessions_select_own"
  on public.ai_generation_sessions
  for select
  to authenticated
  using (user_id = auth.uid());

-- RLS policy: users can create their own generation sessions
create policy "ai_sessions_insert_own"
  on public.ai_generation_sessions
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- RLS policy: users can update their own generation sessions
create policy "ai_sessions_update_own"
  on public.ai_generation_sessions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RLS policy: users can delete their own generation sessions
create policy "ai_sessions_delete_own"
  on public.ai_generation_sessions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- index for user's sessions ordered by creation date (for history/listing)
create index ai_sessions_user_created_idx on public.ai_generation_sessions (user_id, created_at desc);

-- ============================================================================
-- SECTION 4: Flashcard Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: public.flashcards
-- Purpose: Core flashcard storage (both AI-generated and manual)
-- Notes:
--   - All cards start as 'draft' status
--   - source field is immutable after creation (enforced by trigger)
--   - first_activated_at tracks when card first became 'active' (for metrics)
--   - counted_in_metrics prevents double-counting in acceptance metrics
--   - generation_session_id links to AI session (null for manual cards)
-- ----------------------------------------------------------------------------
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  answer text not null,
  status flashcard_status not null default 'draft',
  source flashcard_source not null default 'manual',
  generation_session_id uuid null references public.ai_generation_sessions(id) on delete set null,
  -- timestamp when card was first activated (set once, immutable)
  first_activated_at timestamptz null,
  -- flag to prevent double-counting in acceptance metrics
  counted_in_metrics boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- enforce question length limit (100 chars per PRD)
  constraint flashcards_question_length check (char_length(question) <= 100),
  -- enforce answer length limit (300 chars per PRD)
  constraint flashcards_answer_length check (char_length(answer) <= 300),
  -- ensure consistency: if generation_session_id is set, source must be 'generated'
  constraint flashcards_source_session_consistency check (
    generation_session_id is null or source = 'generated'
  )
);

-- enable row level security
alter table public.flashcards enable row level security;

-- RLS policy: users can view their own flashcards
create policy "flashcards_select_own"
  on public.flashcards
  for select
  to authenticated
  using (user_id = auth.uid());

-- RLS policy: users can create their own flashcards
create policy "flashcards_insert_own"
  on public.flashcards
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- RLS policy: users can update their own flashcards
create policy "flashcards_update_own"
  on public.flashcards
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RLS policy: users can delete their own flashcards
create policy "flashcards_delete_own"
  on public.flashcards
  for delete
  to authenticated
  using (user_id = auth.uid());

-- composite index for listing flashcards with cursor-based pagination
-- supports queries: WHERE user_id = ? AND status = ? ORDER BY updated_at DESC, id DESC
create index flashcards_user_status_updated_idx on public.flashcards (user_id, status, updated_at desc, id desc);

-- index for counting daily AI-generated cards (rate limiting)
-- supports queries: WHERE user_id = ? AND source = ? AND created_at >= ?
create index flashcards_user_source_created_idx on public.flashcards (user_id, source, created_at);

-- partial index for AI-generated cards only (optimization for rate limiting)
create index flashcards_user_created_generated_idx on public.flashcards (user_id, created_at) 
  where source = 'generated';

-- index for looking up flashcards by generation session
create index flashcards_generation_session_idx on public.flashcards (generation_session_id);

-- ----------------------------------------------------------------------------
-- Table: public.flashcard_tags
-- Purpose: Many-to-many relationship between flashcards and tags
-- Notes:
--   - Allows tagging of draft cards
--   - RLS ensures both flashcard and tag belong to same user
--   - Composite primary key prevents duplicate associations
-- ----------------------------------------------------------------------------
create table public.flashcard_tags (
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  
  -- composite primary key prevents duplicate flashcard-tag associations
  primary key (flashcard_id, tag_id)
);

-- enable row level security
alter table public.flashcard_tags enable row level security;

-- RLS policy: users can view tags on their own flashcards
create policy "flashcard_tags_select_own"
  on public.flashcard_tags
  for select
  to authenticated
  using (
    exists (
      select 1 from public.flashcards f 
      where f.id = flashcard_tags.flashcard_id 
        and f.user_id = auth.uid()
    )
  );

-- RLS policy: users can add tags to their own flashcards
-- ensures both flashcard and tag belong to the user
create policy "flashcard_tags_insert_own"
  on public.flashcard_tags
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.flashcards f 
      where f.id = flashcard_id 
        and f.user_id = auth.uid()
    )
    and exists (
      select 1 from public.tags t 
      where t.id = tag_id 
        and t.user_id = auth.uid()
    )
  );

-- RLS policy: users can remove tags from their own flashcards
create policy "flashcard_tags_delete_own"
  on public.flashcard_tags
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.flashcards f 
      where f.id = flashcard_tags.flashcard_id 
        and f.user_id = auth.uid()
    )
  );

-- note: update policy omitted - junction table records are not updated, only inserted/deleted

-- index for finding all tags for a flashcard (covered by primary key)
-- index for finding all flashcards with a specific tag
create index flashcard_tags_tag_id_idx on public.flashcard_tags (tag_id);

-- ============================================================================
-- SECTION 5: SRS (Spaced Repetition System) Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: public.srs_state
-- Purpose: SRS algorithm state for each active flashcard (1:1 relationship)
-- Notes:
--   - Created when flashcard becomes 'active'
--   - due_at determines when card should be reviewed next
--   - interval_days, ease_factor, repetitions track SRS algorithm state
--   - lapses counts how many times user failed to recall
-- ----------------------------------------------------------------------------
create table public.srs_state (
  flashcard_id uuid primary key references public.flashcards(id) on delete cascade,
  due_at timestamptz not null,
  interval_days int not null default 1,
  ease_factor real not null default 2.5,
  repetitions int not null default 0,
  lapses int not null default 0,
  last_reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- ensure interval is non-negative
  constraint srs_state_interval_nonnegative check (interval_days >= 0),
  -- ensure ease factor is at least 1.0 (per SRS algorithm requirements)
  constraint srs_state_ease_factor_min check (ease_factor >= 1.0)
);

-- enable row level security
alter table public.srs_state enable row level security;

-- RLS policy: users can view SRS state for their own flashcards
create policy "srs_state_select_own"
  on public.srs_state
  for select
  to authenticated
  using (
    exists (
      select 1 from public.flashcards f 
      where f.id = srs_state.flashcard_id 
        and f.user_id = auth.uid()
    )
  );

-- RLS policy: users can create SRS state for their own flashcards
create policy "srs_state_insert_own"
  on public.srs_state
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.flashcards f 
      where f.id = flashcard_id 
        and f.user_id = auth.uid()
    )
  );

-- RLS policy: users can update SRS state for their own flashcards
create policy "srs_state_update_own"
  on public.srs_state
  for update
  to authenticated
  using (
    exists (
      select 1 from public.flashcards f 
      where f.id = srs_state.flashcard_id 
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.flashcards f 
      where f.id = flashcard_id 
        and f.user_id = auth.uid()
    )
  );

-- RLS policy: users can delete SRS state for their own flashcards
create policy "srs_state_delete_own"
  on public.srs_state
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.flashcards f 
      where f.id = srs_state.flashcard_id 
        and f.user_id = auth.uid()
    )
  );

-- index for finding cards due for review
-- supports queries: WHERE due_at <= now() ORDER BY due_at
create index srs_state_due_at_idx on public.srs_state (due_at);

-- ----------------------------------------------------------------------------
-- Table: public.srs_reviews
-- Purpose: Append-only history of all SRS review sessions
-- Notes:
--   - grade is 1-4 per PRD (1=again, 2=hard, 3=good, 4=easy)
--   - due_before_review and due_after_review track scheduling changes
--   - Used for analytics and debugging SRS algorithm
-- ----------------------------------------------------------------------------
create table public.srs_reviews (
  id bigint generated always as identity primary key,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  grade smallint not null,
  due_before_review timestamptz null,
  due_after_review timestamptz null,
  created_at timestamptz not null default now(),
  
  -- enforce grade range (1=again, 2=hard, 3=good, 4=easy)
  constraint srs_reviews_grade_range check (grade between 1 and 4)
);

-- enable row level security
alter table public.srs_reviews enable row level security;

-- RLS policy: users can view review history for their own flashcards
create policy "srs_reviews_select_own"
  on public.srs_reviews
  for select
  to authenticated
  using (
    exists (
      select 1 from public.flashcards f 
      where f.id = srs_reviews.flashcard_id 
        and f.user_id = auth.uid()
    )
  );

-- RLS policy: users can create reviews for their own flashcards
create policy "srs_reviews_insert_own"
  on public.srs_reviews
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.flashcards f 
      where f.id = flashcard_id 
        and f.user_id = auth.uid()
    )
  );

-- note: update/delete policies omitted - review history is append-only in MVP

-- index for finding review history for a specific flashcard
-- supports queries: WHERE flashcard_id = ? ORDER BY reviewed_at DESC
create index srs_reviews_flashcard_reviewed_idx on public.srs_reviews (flashcard_id, reviewed_at desc);

-- ============================================================================
-- SECTION 6: Metrics Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: public.acceptance_metrics
-- Purpose: Global acceptance rate metrics for AI-generated flashcards
-- Notes:
--   - Single row table (id constrained to 1)
--   - Recalculated by backend service role
--   - Tracks total generated, activated, and rejected counts
--   - Each generated card counted only once (via counted_in_metrics flag)
-- ----------------------------------------------------------------------------
create table public.acceptance_metrics (
  id smallint primary key default 1,
  generated_total bigint not null default 0,
  generated_activated_total bigint not null default 0,
  generated_rejected_total bigint not null default 0,
  last_recalculated_at timestamptz not null default now(),
  
  -- ensure this is a single-row table
  constraint acceptance_metrics_singleton check (id = 1)
);

-- enable row level security
alter table public.acceptance_metrics enable row level security;

-- RLS policy: authenticated users can view metrics
create policy "acceptance_metrics_select_authenticated"
  on public.acceptance_metrics
  for select
  to authenticated
  using (true);

-- RLS policy: anonymous users can view metrics
create policy "acceptance_metrics_select_anon"
  on public.acceptance_metrics
  for select
  to anon
  using (true);

-- note: insert/update/delete restricted to service role (no policies for authenticated)

-- initialize the single metrics row
insert into public.acceptance_metrics (id) values (1);

-- ============================================================================
-- SECTION 7: Triggers for Automation and Data Integrity
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger Function: set_updated_at
-- Purpose: Automatically update updated_at timestamp on row modification
-- Used by: profiles, tags, ai_generation_sessions, flashcards, srs_state
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- apply updated_at trigger to relevant tables
create trigger set_updated_at_profiles
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create trigger set_updated_at_tags
  before update on public.tags
  for each row
  execute function public.set_updated_at();

create trigger set_updated_at_ai_sessions
  before update on public.ai_generation_sessions
  for each row
  execute function public.set_updated_at();

create trigger set_updated_at_flashcards
  before update on public.flashcards
  for each row
  execute function public.set_updated_at();

create trigger set_updated_at_srs_state
  before update on public.srs_state
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Trigger Function: prevent_flashcard_source_change
-- Purpose: Enforce immutability of flashcard.source field after creation
-- Rationale: Source field is critical for metrics and should never change
-- ----------------------------------------------------------------------------
create or replace function public.prevent_flashcard_source_change()
returns trigger
language plpgsql
as $$
begin
  -- prevent changing source field after creation
  if old.source is distinct from new.source then
    raise exception 'flashcard source field is immutable and cannot be changed';
  end if;
  return new;
end;
$$;

create trigger prevent_flashcard_source_change
  before update on public.flashcards
  for each row
  execute function public.prevent_flashcard_source_change();

-- ----------------------------------------------------------------------------
-- Trigger Function: prevent_first_activated_at_change
-- Purpose: Ensure first_activated_at is set only once and never changed
-- Rationale: This timestamp is critical for acceptance metrics accuracy
-- ----------------------------------------------------------------------------
create or replace function public.prevent_first_activated_at_change()
returns trigger
language plpgsql
as $$
begin
  -- if first_activated_at was already set, prevent any changes to it
  if old.first_activated_at is not null and new.first_activated_at is distinct from old.first_activated_at then
    raise exception 'first_activated_at can only be set once and cannot be changed';
  end if;
  return new;
end;
$$;

create trigger prevent_first_activated_at_change
  before update on public.flashcards
  for each row
  execute function public.prevent_first_activated_at_change();

-- ----------------------------------------------------------------------------
-- Trigger Function: create_profile_for_new_user
-- Purpose: Automatically create profile and copy starter tags for new users
-- Triggered by: INSERT on auth.users
-- Notes: 
--   - This is the standard Supabase pattern for user profile creation
--   - Function uses SECURITY DEFINER to run with elevated privileges
--   - search_path is set to public for security
-- IMPORTANT: 
--   - Supabase CLI (db pull) does NOT capture triggers on auth.users
--   - If you need to recreate this trigger, refer to this migration file
--   - The trigger will work correctly but won't appear in future schema pulls
-- ----------------------------------------------------------------------------
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- create profile record for new user
  insert into public.profiles (id)
  values (new.id);
  
  -- copy all starter tags to user's personal tags
  insert into public.tags (user_id, name)
  select new.id, st.name
  from public.starter_tags st
  order by st.sort_order;
  
  return new;
end;
$$;

-- trigger to create profile and tags when user signs up
-- NOTE: This trigger on auth.users will work but won't be captured by 'supabase db pull'
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.create_profile_for_new_user();

-- ============================================================================
-- SECTION 8: Comments for Documentation
-- ============================================================================

-- table comments
comment on table public.profiles is 'Extended user profiles (1:1 with auth.users)';
comment on table public.starter_tags is 'Global starter tags copied to new users';
comment on table public.tags is 'User-specific tags for organizing flashcards';
comment on table public.ai_generation_sessions is 'AI flashcard generation session tracking';
comment on table public.flashcards is 'Core flashcard storage (AI-generated and manual)';
comment on table public.flashcard_tags is 'Many-to-many: flashcards ↔ tags';
comment on table public.srs_state is 'SRS algorithm state per flashcard (1:1)';
comment on table public.srs_reviews is 'Append-only history of SRS review sessions';
comment on table public.acceptance_metrics is 'Global AI acceptance rate metrics (single row)';

-- column comments for key fields
comment on column public.flashcards.source is 'Immutable: tracks if card was AI-generated or manually created';
comment on column public.flashcards.first_activated_at is 'Set once when card first becomes active (for metrics)';
comment on column public.flashcards.counted_in_metrics is 'Prevents double-counting in acceptance metrics';
comment on column public.ai_generation_sessions.source_text_chars is 'Computed: character count for validation';
comment on column public.tags.name_normalized is 'Computed: lowercase, trimmed, whitespace-normalized for uniqueness';
comment on column public.starter_tags.name_normalized is 'Computed: lowercase, trimmed, whitespace-normalized for uniqueness';

-- ============================================================================
-- Migration Complete
-- ============================================================================
