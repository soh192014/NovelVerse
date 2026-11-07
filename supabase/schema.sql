-- =====================================================
-- NovelVerse Database Schema
-- Version: 1.0
-- =====================================================

create extension if not exists pgcrypto;

-- =====================================================
-- 1. USER PROFILES
-- =====================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text unique,
    avatar_url text,
    role text not null default 'user'
        check (role in ('user', 'admin')),
    points integer not null default 150
        check (points >= 0),
    is_banned boolean not null default false,
    created_at timestamptz not null default now()
);

-- =====================================================
-- 2. BOOKS
-- =====================================================

create table if not exists public.books (
    id uuid primary key default gen_random_uuid(),

    uploader_id uuid not null
        references public.profiles(id) on delete cascade,

    title text not null,
    author text not null,
    category text not null,
    description text,

    cover_path text,
    file_path text not null,

    file_type text not null
        check (file_type in ('txt', 'pdf', 'epub')),

    read_price integer not null default 10
        check (read_price between 10 and 200),

    offline_price integer not null default 200
        check (offline_price between 200 and 1000),

    download_price integer not null default 2000
        check (download_price between 2000 and 10000),

    complete_reward integer not null default 50
        check (complete_reward between 50 and 200),

    is_public boolean not null default true,
    is_removed boolean not null default false,

    views bigint not null default 0,

    created_at timestamptz not null default now()
);

-- =====================================================
-- 3. POINT TRANSACTIONS
-- =====================================================

create table if not exists public.point_ledger (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id) on delete cascade,

    amount integer not null,
    reason text not null,

    reference_id uuid,
    created_at timestamptz not null default now()
);

-- =====================================================
-- 4. BOOK ENTITLEMENTS
-- =====================================================

create table if not exists public.entitlements (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id) on delete cascade,

    book_id uuid not null
        references public.books(id) on delete cascade,

    entitlement_type text not null
        check (
            entitlement_type in ('read', 'offline', 'download')
        ),

    created_at timestamptz not null default now(),

    unique (user_id, book_id, entitlement_type)
);

-- =====================================================
-- 5. READING SESSIONS
-- =====================================================

create table if not exists public.reading_sessions (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id) on delete cascade,

    book_id uuid not null
        references public.books(id) on delete cascade,

    progress integer not null default 0
        check (progress between 0 and 100),

    started_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    completed_at timestamptz,

    unique (user_id, book_id)
);

-- =====================================================
-- 6. DAILY CHECKINS
-- =====================================================

create table if not exists public.daily_checkins (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id) on delete cascade,

    checkin_date date not null default current_date,

    points_earned integer not null,

    created_at timestamptz not null default now(),

    unique (user_id, checkin_date)
);

-- =====================================================
-- 7. NEW USER PROFILE
-- =====================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_username text;
begin
    new_username := coalesce(
        nullif(new.raw_user_meta_data ->> 'username', ''),
        'reader_' || left(new.id::text, 8)
    );

    insert into public.profiles (
        id,
        username,
        points
    )
    values (
        new.id,
        new_username,
        150
    )
    on conflict (id) do nothing;

    insert into public.point_ledger (
        user_id,
        amount,
        reason
    )
    values (
        new.id,
        150,
        '新用户注册奖励'
    );

    return new;
end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- =====================================================
-- 8. ENABLE ROW LEVEL SECURITY
-- =====================================================

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.point_ledger enable row level security;
alter table public.entitlements enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.daily_checkins enable row level security;

-- =====================================================
-- 9. PROFILE POLICIES
-- =====================================================

drop policy if exists "Profiles are readable"
on public.profiles;

create policy "Profiles are readable"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users update own profile"
on public.profiles;

create policy "Users update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- =====================================================
-- 10. BOOK POLICIES
-- =====================================================

drop policy if exists "Public books are readable"
on public.books;

create policy "Public books are readable"
on public.books
for select
to anon, authenticated
using (
    is_public = true
    and is_removed = false
);

drop policy if exists "Users upload books"
on public.books;

create policy "Users upload books"
on public.books
for insert
to authenticated
with check (
    auth.uid() = uploader_id
    and is_public = true
    and is_removed = false
);

-- =====================================================
-- 11. POINT LEDGER POLICIES
-- =====================================================

drop policy if exists "Users view own point history"
on public.point_ledger;

create policy "Users view own point history"
on public.point_ledger
for select
to authenticated
using (auth.uid() = user_id);

-- =====================================================
-- 12. ENTITLEMENT POLICIES
-- =====================================================

drop policy if exists "Users view own entitlements"
on public.entitlements;

create policy "Users view own entitlements"
on public.entitlements
for select
to authenticated
using (auth.uid() = user_id);

-- =====================================================
-- 13. READING SESSION POLICIES
-- =====================================================

drop policy if exists "Users view own reading sessions"
on public.reading_sessions;

create policy "Users view own reading sessions"
on public.reading_sessions
for select
to authenticated
using (auth.uid() = user_id);

-- =====================================================
-- 14. CHECKIN POLICIES
-- =====================================================

drop policy if exists "Users view own checkins"
on public.daily_checkins;

create policy "Users view own checkins"
on public.daily_checkins
for select
to authenticated
using (auth.uid() = user_id);

-- =====================================================
-- 15. STORAGE BUCKETS
-- =====================================================

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values
(
    'book-files',
    'book-files',
    false,
    20971520,
    array[
        'text/plain',
        'application/pdf',
        'application/epub+zip'
    ]
),
(
    'book-covers',
    'book-covers',
    true,
    5242880,
    array[
        'image/jpeg',
        'image/png',
        'image/webp'
    ]
)
on conflict (id) do nothing;

-- =====================================================
-- 16. STORAGE POLICIES
-- =====================================================

drop policy if exists "Users upload their own book files"
on storage.objects;

create policy "Users upload their own book files"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'book-files'
    and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users upload their own covers"
on storage.objects;

create policy "Users upload their own covers"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'book-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public cover images are readable"
on storage.objects;

create policy "Public cover images are readable"
on storage.objects
for select
to anon, authenticated
using (
    bucket_id = 'book-covers'
);

-- =====================================================
-- END OF INITIAL SCHEMA
-- =====================================================