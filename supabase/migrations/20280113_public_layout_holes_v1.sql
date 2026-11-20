-- NOT EXECUTED. Manual review/application only.
-- Allowlisted public display reader; existing readers, tables and RLS unchanged.
begin;
create function public.get_public_layout_holes_v1(p_layout_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if not exists(select 1 from public.course_layouts l join public.courses c on c.id=l.course_id
  where l.id=p_layout_id and l.published is true and c.is_published is true) then
  raise exception 'LAYOUT_NOT_PUBLIC' using errcode='42501';
 end if;
 if (select count(*) from public.layout_holes where layout_id=p_layout_id)>1000 then
  raise exception 'LAYOUT_READ_LIMIT_EXCEEDED' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'hole_id',h.id,'number',h.number,'order_index',lh.order_index,'par',pc.par,'distance',pc.distance)
  order by lh.order_index,h.id),'[]'::jsonb) into result
 from public.layout_holes lh
 join public.course_layouts l on l.id=lh.layout_id
 join public.courses c on c.id=l.course_id
 join public.holes h on h.id=lh.hole_id and h.course_id=l.course_id
 join public.hole_play_configs pc on pc.hole_id=h.id and pc.course_id=l.course_id
  and (case when lh.play_config_id is null then pc.is_default else pc.id=lh.play_config_id end)
 where l.id=p_layout_id and l.published is true and c.is_published is true;
 -- Missing configuration data must not silently produce an incomplete overview.
 if jsonb_array_length(result)<>(select count(*) from public.layout_holes where layout_id=p_layout_id) then
  raise exception 'LAYOUT_HOLE_DATA_UNAVAILABLE' using errcode='22023';
 end if;
 return result;
end $$;
revoke all on function public.get_public_layout_holes_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_public_layout_holes_v1(uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
