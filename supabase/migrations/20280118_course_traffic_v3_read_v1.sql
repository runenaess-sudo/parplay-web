-- NOT EXECUTED. Manual review/application only.
-- Estimates from recorded completed sessions, not verified people or full coverage.
-- No hooks, jobs, aggregates, indexes, backfill or changes to V1/V2.
begin;
do $guard$ begin
 if current_user in ('anon','authenticated','service_role') or not exists(
  select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'COURSE_TRAFFIC_TRUSTED_OWNER_REQUIRED';
 end if;
end $guard$;
create function public.get_course_traffic_v3(p_course_id uuid,p_day_of_week integer default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare
 tz text; today date; weekday integer; oldest timestamptz; n bigint;
 window_start timestamptz; window_end timestamptz; buckets jsonb; state text;
begin
 select c.timezone into tz from public.courses c where c.id=p_course_id and c.is_published is true;
 if not found then return null; end if;
 if p_day_of_week is not null and p_day_of_week not between 0 and 6 then
  raise exception 'COURSE_TRAFFIC_WEEKDAY_INVALID' using errcode='22023';
 end if;
 if tz is null then
  return jsonb_build_object('available',false,'reason','missing_timezone','timezone',null,'buckets','[]'::jsonb);
 end if;
 today:=(statement_timestamp() at time zone tz)::date;
 weekday:=coalesce(p_day_of_week,extract(dow from today)::integer);
 window_start:=(today-28)::timestamp at time zone tz;
 window_end:=today::timestamp at time zone tz;
 with raw as materialized (
  select 'round'::text source,h.rounds_live_id::text session_id,h.started_at,h.finished_at
  from public.round_session_history_v1 h where h.course_id=p_course_id and h.activity_mode in ('casual','regular')
  union all
  select 'battle',b.id::text,coalesce(b.start_time,b.created_at),b.finished_at
  from public.battle_sessions b where b.course_id=p_course_id::text and lower(b.status) in ('finished','completed')
  union all
  select 'matchplay',m.id::text,coalesce(m.started_at,m.start_time,m.created_at),m.finished_at
  from public.matchplay_sessions m where m.course_id=p_course_id::text and lower(m.status) in ('finished','completed')
  union all
  select 'doubles',d.id::text,d.started_at,d.finished_at
  from public.doubles_matches d where d.course_id=p_course_id and d.status='finished'
 ), valid as materialized (
  -- One row per logical source session; never expand by participants/results/layouts.
  select distinct on (source,session_id) source,session_id,started_at,finished_at from raw
  where started_at is not null and finished_at>started_at and finished_at<=statement_timestamp()
  order by source,session_id,finished_at desc,started_at
 ), recent as materialized (
  select * from valid where started_at<window_end and finished_at>window_start
 ), days as (
  select (today-28+i)::date AS local_day from generate_series(0,27) i
  where extract(dow from today-28+i)::integer=weekday
   and exists(select 1 from recent)
   and (select min(started_at) at time zone tz from valid)::date<=today-28
 ), minute_spans as materialized (
  -- Walk real instants, not assumed 24-hour days. Repeated local hours retain
  -- their elapsed duration; skipped hours are not invented. At most four days
  -- are expanded. Minute boundaries also handle modern half-hour DST shifts.
  select d.local_day,t as starts_at,least(t+interval '1 minute',
   (d.local_day+1)::timestamp at time zone tz) ends_at,
   extract(hour from t at time zone tz)::integer AS local_hour
  from days d cross join lateral generate_series(
   d.local_day::timestamp at time zone tz,
   ((d.local_day+1)::timestamp at time zone tz)-interval '1 microsecond',interval '1 minute') t
  where extract(hour from t at time zone tz)::integer between 6 and 22
 ), occupied as (
  select span.local_day,span.local_hour,span.starts_at,span.ends_at,
   coalesce(sum(extract(epoch from least(r.finished_at,span.ends_at)-greatest(r.started_at,span.starts_at)))
    filter(where r.session_id is not null),0) session_seconds
  from minute_spans span left join recent r on r.started_at<span.ends_at and r.finished_at>span.starts_at
  group by span.local_day,span.local_hour,span.starts_at,span.ends_at
 ), daily as (
  select local_day,local_hour,sum(session_seconds)/sum(extract(epoch from ends_at-starts_at)) average_sessions
  from occupied group by local_day,local_hour
 ), hourly as (
  select local_hour,count(*) AS observed_days,sum(average_sessions)/4 average_sessions
  from daily group by local_hour
 )
 select (select min(started_at) from valid),(select count(*) from recent),
  (select jsonb_agg(jsonb_build_object('hour',h,
    'average_sessions',case when hourly.observed_days=4 then hourly.average_sessions else null end,
    'observed_days',coalesce(hourly.observed_days,0)) order by h)
   from generate_series(6,22) h left join hourly on hourly.local_hour=h)
 into oldest,n,buckets;
 state:=case when oldest is null or n=0 then 'no_registered_activity'
  when (oldest at time zone tz)::date>today-28 then 'insufficient_history' else 'available' end;
 return jsonb_build_object('course_id',p_course_id,'timezone',tz,'day_of_week',weekday,
  'available',state='available','reason',state,'window_start',(today-28),'window_end_exclusive',today,
  'first_recorded_date',(oldest at time zone tz)::date,'registered_sessions',n,
  -- Fewer than one recorded session/week is a small sample, not missing coverage.
  'limited_data',n<4,'limited_data_threshold',4,'unit','average_active_sessions',
  'buckets',case when state='available' then coalesce(buckets,'[]'::jsonb) else '[]'::jsonb end);
end $$;
revoke all on function public.get_course_traffic_v3(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_course_traffic_v3(uuid,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
