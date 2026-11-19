-- NOT EXECUTED. Manual review/application only.
-- Add one feature type; preserve the installed rules for every existing type.
begin;
do $$
declare
 feature_table regclass := 'public.hole_features'::regclass;
 type_rule text;
 geometry_rule text;
 island_rule text := $island$
  (feature_type = 'ISLAND_HOLE'
   and jsonb_typeof(geometry) = 'object'
   and geometry->>'type' = 'Polygon'
   and jsonb_typeof(geometry->'coordinates') = 'array'
   and jsonb_array_length(geometry->'coordinates') = 1
   and jsonb_typeof(geometry#>'{coordinates,0}') = 'array'
   and jsonb_array_length(geometry#>'{coordinates,0}') >= 4
   and geometry#>'{coordinates,0,0}' = geometry#>(array['coordinates','0',
     (jsonb_array_length(geometry#>'{coordinates,0}')-1)::text])) is true
 $island$;
begin
 if current_user in ('anon','authenticated','service_role') or not exists (
  select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)
 ) then raise exception 'ISLAND_HOLE_TRUSTED_OWNER_REQUIRED'; end if;
 if to_regprocedure('public.create_play_config_feature_v5(uuid,uuid,uuid[],jsonb)') is null then
  raise exception 'ISLAND_HOLE_PREREQUISITES_MISSING'; end if;
 lock table public.hole_features in access exclusive mode;
 -- Inspect installed definitions rather than replacing them with an assumed
 -- historical list. The existing RPC inserts into this constrained table:
 -- its authentication, course checks and idempotent retry remain unchanged.
 select pg_get_expr(conbin,conrelid) into strict type_rule
 from pg_constraint where conrelid=feature_table
  and conname='hole_features_type_check' and contype='c';
 select pg_get_expr(conbin,conrelid) into strict geometry_rule
 from pg_constraint where conrelid=feature_table
  and conname='hole_features_geometry_contract_check' and contype='c';
 execute 'alter table public.hole_features drop constraint hole_features_type_check';
 execute format('alter table public.hole_features add constraint hole_features_type_check check ((%s) or feature_type = %L)',
  type_rule,'ISLAND_HOLE');
 execute 'alter table public.hole_features drop constraint hole_features_geometry_contract_check';
 execute format('alter table public.hole_features add constraint hole_features_geometry_contract_check check ((feature_type <> %L and (%s)) or (%s))',
  'ISLAND_HOLE',geometry_rule,island_rule);
 -- ADD CHECK validates all existing rows. Any failure rolls back everything.
 -- No feature rows, policies, triggers, RPC bodies or course data are changed.
end $$;
commit;
