-- NOT EXECUTED. Manual review/application only.
-- Recreate only the retired three-argument feed, removing its two NULL defaults.
-- The live one-argument RPC and V2 are not modified. No data backfill.
begin;
do $migration$
declare
 signature constant text := 'public.get_course_activity_v1(uuid,timestamp with time zone,uuid)';
 expected_header constant text := 'CREATE OR REPLACE FUNCTION public.get_course_activity_v1(p_course_id uuid, p_before_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)';
 new_header constant text := 'CREATE OR REPLACE FUNCTION public.get_course_activity_v1(p_course_id uuid, p_before_date timestamp with time zone, p_before_id uuid)';
 function_id oid := to_regprocedure(signature);
 old_definition text;
 old_properties jsonb;
 old_owner oid;
 old_comment text;
 old_acl jsonb;
 old_labels jsonb;
 original_role text := current_user;
 entry record;
 new_acl jsonb;
begin
 if function_id is null then raise exception 'COURSE_ACTIVITY_FEED_MISSING'; end if;
 select pg_get_functiondef(p.oid),
  to_jsonb(p)-array['oid','pronargdefaults','proargdefaults','proacl'],
  p.proowner,obj_description(p.oid,'pg_proc')
 into old_definition,old_properties,old_owner,old_comment
 from pg_proc p where p.oid=function_id;
 if (select pronargdefaults from pg_proc where oid=function_id)=0 then
  raise notice 'Feed already has no parameter defaults; no changes made.';
  return;
 end if;
 -- Fail closed if the installed declaration differs from the inspected contract.
 if split_part(old_definition,E'\n',1)<>expected_header then
  raise exception 'COURSE_ACTIVITY_FEED_UNEXPECTED_DECLARATION';
 end if;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb)
 into old_acl from pg_proc p,
 lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=function_id;
 -- Do not silently replace unusual grantor chains with owner-issued grants.
 if exists(select 1 from jsonb_to_recordset(old_acl)
  as a(grantor oid) where a.grantor<>old_owner) then
  raise exception 'COURSE_ACTIVITY_FEED_NONOWNER_GRANTOR_REQUIRES_REVIEW';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('provider',provider,'label',label)),'[]'::jsonb)
 into old_labels from pg_seclabel
 where classoid='pg_proc'::regclass and objoid=function_id and objsubid=0;

 -- RESTRICT deliberately aborts if dependent objects prevent dropping the feed.
 execute 'drop function '||signature||' restrict';
 -- Preserve every character after the declaration, including the SQL body.
 execute new_header||substr(old_definition,length(expected_header)+1);
 execute format('alter function %s owner to %I',signature,pg_get_userbyid(old_owner));
 execute format('set local role %I',pg_get_userbyid(old_owner));
 function_id:=to_regprocedure(signature);
 -- Clear creation-time default grants before restoring the exact old privileges.
 for entry in select distinct a.grantee from pg_proc p,
  lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=function_id loop
  execute format('revoke all privileges on function %s from %s',signature,
   case when entry.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(entry.grantee)) end);
 end loop;
 for entry in select * from jsonb_to_recordset(old_acl)
  as a(grantor oid,grantee oid,privilege_type text,is_grantable boolean) loop
  execute format('grant %s on function %s to %s%s',entry.privilege_type,signature,
   case when entry.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(entry.grantee)) end,
   case when entry.is_grantable then ' with grant option' else '' end);
 end loop;
 execute format('set local role %I',original_role);
 execute format('comment on function %s is %L',signature,old_comment);
 for entry in select * from jsonb_to_recordset(old_labels) as a(provider text,label text) loop
  execute format('security label for %I on function %s is %L',entry.provider,signature,entry.label);
 end loop;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb)
 into new_acl from pg_proc p,
 lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=function_id;
 if new_acl is distinct from old_acl
  or (select to_jsonb(p)-array['oid','pronargdefaults','proargdefaults','proacl'] from pg_proc p where p.oid=function_id) is distinct from old_properties
  or (select pronargdefaults from pg_proc where oid=function_id)<>0
  or pg_get_functiondef(function_id) is distinct from new_header||substr(old_definition,length(expected_header)+1) then
  raise exception 'COURSE_ACTIVITY_FEED_PRESERVATION_CHECK_FAILED';
 end if;
end;
$migration$;
notify pgrst,'reload schema';
commit;
