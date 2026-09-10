-- READ ONLY: inspect deployed policies, grants, and relevant trigger/function definitions.
with target_tables(table_name) as (
  values
    ('profiles'),
    ('courses'),
    ('course_contacts'),
    ('clubs'),
    ('course_claim_requests'),
    ('system_notifications')
), target_relations as (
  select
    targets.table_name,
    relation.oid as relation_oid,
    relation.relrowsecurity,
    relation.relforcerowsecurity,
    relation.relowner
  from target_tables targets
  left join pg_namespace namespace on namespace.nspname='public'
  left join pg_class relation
    on relation.relnamespace=namespace.oid
   and relation.relname=targets.table_name
   and relation.relkind in ('r','p')
)
select
  'RELATION_STATE' as record_type,
  'public' as schema_name,
  relations.table_name as object_name,
  case when relations.relation_oid is null then 'MISSING' else 'PRESENT' end as detail_name,
  case when relations.relation_oid is null then
    'relation does not exist in this deployment'
  else concat_ws(' | ',
    'rls_enabled=' || relations.relrowsecurity,
    'rls_forced=' || relations.relforcerowsecurity,
    'owner=' || pg_get_userbyid(relations.relowner))
  end as definition
from target_relations relations

union all

select
  'EFFECTIVE_GRANT' as record_type,
  'public' as schema_name,
  relations.table_name as object_name,
  roles.role_name as detail_name,
  case when relations.relation_oid is null then
    'relation missing; privileges not evaluated'
  else concat_ws(' | ',
    'select=' || has_table_privilege(roles.role_name,relations.relation_oid,'SELECT'),
    'insert=' || has_table_privilege(roles.role_name,relations.relation_oid,'INSERT'),
    'update=' || has_table_privilege(roles.role_name,relations.relation_oid,'UPDATE'),
    'delete=' || has_table_privilege(roles.role_name,relations.relation_oid,'DELETE'))
  end as definition
from target_relations relations
cross join (values('anon'),('authenticated'),('service_role')) roles(role_name)

union all

select
  'POLICY' as record_type,
  policies.schemaname as schema_name,
  policies.tablename as object_name,
  policies.policyname as detail_name,
  concat_ws(' | ',
    'permissive=' || policies.permissive,
    'roles=' || array_to_string(policies.roles, ','),
    'command=' || policies.cmd,
    'using=' || coalesce(policies.qual, '<none>'),
    'check=' || coalesce(policies.with_check, '<none>')) as definition
from pg_policies policies
join target_tables targets on targets.table_name=policies.tablename
where policies.schemaname='public'

union all

select
  'GRANT' as record_type,
  grants.table_schema as schema_name,
  grants.table_name as object_name,
  grants.grantee as detail_name,
  grants.privilege_type as definition
from information_schema.role_table_grants grants
join target_tables targets on targets.table_name=grants.table_name
where grants.table_schema='public'

union all

select
  'TRIGGER' as record_type,
  namespace.nspname as schema_name,
  relation.relname as object_name,
  trigger.tgname as detail_name,
  pg_get_triggerdef(trigger.oid, true) as definition
from pg_trigger trigger
join pg_class relation on relation.oid=trigger.tgrelid
join pg_namespace namespace on namespace.oid=relation.relnamespace
where not trigger.tgisinternal
  and namespace.nspname='public'
  and relation.relname in ('courses','course_claim_requests')

union all

select
  'TRIGGER_FUNCTION' as record_type,
  function_namespace.nspname as schema_name,
  function_proc.proname as object_name,
  pg_get_function_identity_arguments(function_proc.oid) as detail_name,
  pg_get_functiondef(function_proc.oid) as definition
from pg_trigger trigger
join pg_class relation on relation.oid=trigger.tgrelid
join pg_namespace relation_namespace on relation_namespace.oid=relation.relnamespace
join pg_proc function_proc on function_proc.oid=trigger.tgfoid
join pg_namespace function_namespace on function_namespace.oid=function_proc.pronamespace
where not trigger.tgisinternal
  and relation_namespace.nspname='public'
  and relation.relname in ('courses','course_claim_requests')
order by record_type, schema_name, object_name, detail_name;
