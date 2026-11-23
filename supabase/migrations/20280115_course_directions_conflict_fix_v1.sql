-- NOT EXECUTED. Manual review/application only.
-- Fix the conflict-target ambiguity with the RETURNS TABLE course_id variable.
-- Preserve the signature, authorization, validation, grants and existing behavior.
begin;
do $$ begin
 if to_regprocedure('public.upsert_course_directions_v1(uuid,double precision,double precision,text,text,text,text,text)') is null then
  raise exception 'COURSE_DIRECTIONS_RPC_MISSING';
 end if;
 if not exists(select 1 from pg_constraint
  where conrelid='public.course_directions'::regclass
   and conname='course_directions_pkey' and contype='p') then
  raise exception 'COURSE_DIRECTIONS_PRIMARY_KEY_MISSING';
 end if;
end $$;

create or replace function public.upsert_course_directions_v1(
  p_course_id uuid,
  p_parking_latitude double precision,
  p_parking_longitude double precision,
  p_parking_description text,
  p_general_directions text,
  p_public_transport text,
  p_walking_path text,
  p_entrance_description text
)
returns table(course_id uuid,updated_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
  if auth.uid() is null then raise exception using errcode='28000',message='COURSE_DIRECTIONS_AUTH_REQUIRED';end if;
  if not public.can_manage_course_private_data_v1(p_course_id) then
    raise exception using errcode='42501',message='COURSE_DIRECTIONS_FORBIDDEN';
  end if;
  if (p_parking_latitude is null)<>(p_parking_longitude is null) then
    raise exception using errcode='22023',message='COURSE_DIRECTIONS_PARKING_PAIR_REQUIRED';
  end if;
  if p_parking_latitude is not null and (p_parking_latitude < -90 or p_parking_latitude > 90) then
    raise exception using errcode='22023',message='COURSE_DIRECTIONS_LATITUDE_INVALID';
  end if;
  if p_parking_longitude is not null and (p_parking_longitude < -180 or p_parking_longitude > 180) then
    raise exception using errcode='22023',message='COURSE_DIRECTIONS_LONGITUDE_INVALID';
  end if;

  return query insert into public.course_directions(
    course_id,parking_latitude,parking_longitude,parking_description,general_directions,
    public_transport,walking_path,entrance_description,updated_at
  ) values(
    p_course_id,p_parking_latitude,p_parking_longitude,nullif(btrim(p_parking_description),''),
    nullif(btrim(p_general_directions),''),nullif(btrim(p_public_transport),''),
    nullif(btrim(p_walking_path),''),nullif(btrim(p_entrance_description),''),now()
  ) on conflict on constraint course_directions_pkey do update set
    parking_latitude=excluded.parking_latitude,parking_longitude=excluded.parking_longitude,
    parking_description=excluded.parking_description,general_directions=excluded.general_directions,
    public_transport=excluded.public_transport,walking_path=excluded.walking_path,
    entrance_description=excluded.entrance_description,updated_at=now()
  returning course_directions.course_id,course_directions.updated_at;

  update public.courses set has_directions=true where courses.id=p_course_id;
end;$$;

notify pgrst,'reload schema';
commit;
