-- NOT EXECUTED. Manual review/application only.
-- Fix 42702: the RETURNS TABLE course_id variable conflicts with the column name.
-- Existing function signature, authorization, grants and data remain unchanged.
begin;
do $$ begin
 if to_regprocedure('public.upsert_course_facilities_v1(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,text,text,text,text,text)') is null then
  raise exception 'COURSE_FACILITIES_RPC_MISSING';
 end if;
 if not exists(select 1 from pg_constraint
  where conrelid='public.course_facilities'::regclass
   and conname='course_facilities_pkey' and contype='p') then
  raise exception 'COURSE_FACILITIES_PRIMARY_KEY_MISSING';
 end if;
end $$;

create or replace function public.upsert_course_facilities_v1(
  p_course_id uuid,
  p_toilets boolean,p_water boolean,p_parking boolean,p_kiosk boolean,p_benches boolean,
  p_trashcans boolean,p_signage boolean,p_dog_friendly boolean,p_lighting boolean,p_wheelchair_friendly boolean,
  p_terrain text,p_surface text,p_opening_hours text,p_description text,p_tee_type text,p_basket_type text
)
returns table(course_id uuid,updated_at timestamptz)
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode='28000',message='COURSE_FACILITIES_AUTH_REQUIRED';
  end if;
  if not public.can_manage_course_private_data_v1(p_course_id) then
    raise exception using errcode='42501',message='COURSE_FACILITIES_FORBIDDEN';
  end if;

  return query
  insert into public.course_facilities(
    course_id,toilets,water,parking,kiosk,benches,trashcans,signage,dog_friendly,lighting,wheelchair_friendly,
    terrain,surface,opening_hours,description,tee_type,basket_type,updated_at
  ) values(
    p_course_id,coalesce(p_toilets,false),coalesce(p_water,false),coalesce(p_parking,false),coalesce(p_kiosk,false),
    coalesce(p_benches,false),coalesce(p_trashcans,false),coalesce(p_signage,false),coalesce(p_dog_friendly,false),
    coalesce(p_lighting,false),coalesce(p_wheelchair_friendly,false),nullif(btrim(p_terrain),''),
    nullif(btrim(p_surface),''),nullif(btrim(p_opening_hours),''),nullif(btrim(p_description),''),
    nullif(btrim(p_tee_type),''),nullif(btrim(p_basket_type),''),now()
  )
  on conflict on constraint course_facilities_pkey do update set
    toilets=excluded.toilets,water=excluded.water,parking=excluded.parking,kiosk=excluded.kiosk,
    benches=excluded.benches,trashcans=excluded.trashcans,signage=excluded.signage,
    dog_friendly=excluded.dog_friendly,lighting=excluded.lighting,wheelchair_friendly=excluded.wheelchair_friendly,
    terrain=excluded.terrain,surface=excluded.surface,opening_hours=excluded.opening_hours,
    description=excluded.description,tee_type=excluded.tee_type,basket_type=excluded.basket_type,updated_at=now()
  returning course_facilities.course_id,course_facilities.updated_at;
end;
$$;

notify pgrst,'reload schema';
commit;
