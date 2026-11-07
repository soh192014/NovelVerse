-- =====================================================
-- NovelVerse Functions
-- Version 1.0
-- =====================================================

-- =====================================================
-- 1. DAILY CHECK-IN
-- =====================================================

create or replace function public.daily_checkin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid;
    reward integer;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception '请先登录';
    end if;

    -- 随机奖励：10～100
    reward := floor(random() * 91 + 10)::integer;

    -- 检查是否已经签到
    if exists (
        select 1
        from public.daily_checkins
        where user_id = current_user_id
          and checkin_date = current_date
    ) then
        return jsonb_build_object(
            'success', false,
            'message', '今天已经签到过了'
        );
    end if;

    -- 锁定用户资料，避免并发修改
    perform 1
    from public.profiles
    where id = current_user_id
      and is_banned = false
    for update;

    if not found then
        raise exception '用户不存在或已被封禁';
    end if;

    -- 保存签到记录
    insert into public.daily_checkins (
        user_id,
        points_earned
    )
    values (
        current_user_id,
        reward
    );

    -- 增加积分
    update public.profiles
    set points = points + reward
    where id = current_user_id;

    -- 保存积分记录
    insert into public.point_ledger (
        user_id,
        amount,
        reason
    )
    values (
        current_user_id,
        reward,
        '每日签到'
    );

    return jsonb_build_object(
        'success', true,
        'reward', reward,
        'message', '签到成功！'
    );
end;
$$;


-- =====================================================
-- 2. GET CURRENT USER POINTS
-- =====================================================

create or replace function public.get_my_points()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid;
    current_points integer;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception '请先登录';
    end if;

    select points
    into current_points
    from public.profiles
    where id = current_user_id;

    if current_points is null then
        raise exception '用户资料不存在';
    end if;

    return current_points;
end;
$$;


-- =====================================================
-- 3. GET MY PROFILE
-- =====================================================

create or replace function public.get_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid;
    profile_data jsonb;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception '请先登录';
    end if;

    select jsonb_build_object(
        'id', id,
        'username', username,
        'avatar_url', avatar_url,
        'role', role,
        'points', points,
        'is_banned', is_banned,
        'created_at', created_at
    )
    into profile_data
    from public.profiles
    where id = current_user_id;

    return profile_data;
end;
$$;


-- =====================================================
-- 4. FUNCTION PERMISSIONS
-- =====================================================

revoke all on function public.daily_checkin() from public;
revoke all on function public.get_my_points() from public;
revoke all on function public.get_my_profile() from public;

grant execute on function public.daily_checkin()
to authenticated;

grant execute on function public.get_my_points()
to authenticated;

grant execute on function public.get_my_profile()
to authenticated;

-- =====================================================
-- END
-- =====================================================