-- Apply before deploying the refresh publisher/UI; never applied by the runner.
-- Keep historical firms/outcomes while exposing one complete current list.
alter table public.kkr_ria_firms add column if not exists is_current boolean not null default true;
alter table public.kkr_ria_briefs add column if not exists run_snapshot text;
create or replace function public.publish_kkr_ria_refresh(p_generation text, p_firms jsonb, p_briefs jsonb)
returns integer language plpgsql security invoker set search_path = public, pg_temp as $$
declare n integer;
begin
  if p_generation is null or p_generation !~ '^\d{4}-\d{2}@' or jsonb_typeof(p_firms) is distinct from 'array' or jsonb_typeof(p_briefs) is distinct from 'array' then
    raise exception 'invalid refresh artifact';
  end if;
  n := jsonb_array_length(p_firms);
  if n < 1 or n > 150 then raise exception 'refresh requires 1..150 firms'; end if;
  if exists(select 1 from jsonb_array_elements(p_firms) f where (f->>'run_snapshot') is distinct from p_generation or (f->>'score')::numeric not between 0 and 100)
    or (select count(distinct f->>'crd') from jsonb_array_elements(p_firms) f) <> n
    or (select count(distinct f->>'rank') from jsonb_array_elements(p_firms) f) <> n then
    raise exception 'invalid or duplicate ranked firms';
  end if;
  if exists(select 1 from jsonb_array_elements(p_briefs) b where (b->>'grounded') is distinct from 'true'
    or (b->>'run_snapshot') is distinct from p_generation
    or not exists(select 1 from jsonb_array_elements(p_firms) f where f->>'crd' = b->>'crd')) then
    raise exception 'unverified or mismatched brief';
  end if;
  -- Serialize only publication; scraping/validation has already finished.
  perform pg_advisory_xact_lock(110550, 6);
  update public.kkr_ria_firms set is_current = false where is_current;
  insert into public.kkr_ria_firms (crd,run_snapshot,rank,score,data_completeness,name,city,state,website,raum_total,raum_discretionary,raum_hnw,employees,private_fund_count,filing_date,components,enrichment,is_current,updated_at)
    select crd,run_snapshot,rank,score,data_completeness,name,city,state,website,raum_total,raum_discretionary,raum_hnw,employees,private_fund_count,filing_date,components,enrichment,true,now()
    from jsonb_populate_recordset(null::public.kkr_ria_firms,p_firms)
    on conflict(crd) do update set run_snapshot=excluded.run_snapshot,rank=excluded.rank,score=excluded.score,data_completeness=excluded.data_completeness,name=excluded.name,city=excluded.city,state=excluded.state,website=excluded.website,raum_total=excluded.raum_total,raum_discretionary=excluded.raum_discretionary,raum_hnw=excluded.raum_hnw,employees=excluded.employees,private_fund_count=excluded.private_fund_count,filing_date=excluded.filing_date,components=excluded.components,enrichment=excluded.enrichment,is_current=true,updated_at=now();
  insert into public.kkr_ria_briefs (crd,rank,model,grounded,brief,source_context,run_snapshot,updated_at)
    select crd,rank,model,grounded,brief,source_context,run_snapshot,now()
    from jsonb_populate_recordset(null::public.kkr_ria_briefs,p_briefs)
    on conflict(crd) do update set rank=excluded.rank,model=excluded.model,grounded=excluded.grounded,brief=excluded.brief,source_context=excluded.source_context,run_snapshot=excluded.run_snapshot,updated_at=now();
  return n;
end $$;
revoke all on function public.publish_kkr_ria_refresh(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_kkr_ria_refresh(text,jsonb,jsonb) to service_role;
