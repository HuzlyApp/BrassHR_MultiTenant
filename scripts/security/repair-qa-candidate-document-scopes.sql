-- Development-only BUG-422 cleanup. Default rollback; commit only after assertions pass.
-- These eight exact Round 6 QA labels were created in Zippy Corp's candidate upload UI.
begin;
do $$
declare v_tenant uuid; d record; candidate record; v_owner uuid; v_clone uuid; v_name text; v_index integer:=0; v_files integer; v_fingerprint text;
begin
  select id into strict v_tenant from public.tenants where slug='zippycorp';
  if (select count(*) from public.tenant_profession_documents where tenant_id=v_tenant and worker_id is null and is_active and document_kind='other'
      and created_at >= '2026-11-27 15:17:00+00' and created_at < '2026-11-27 15:26:00+00'
      and name in ('SSN Card Alpha','DL Alpha','I9 Alpha','SSN Card Beta','DL Beta','EXIF photo Alpha','TypeTest html as pdf','TypeTest svg')) <> 8 then
    raise exception 'Expected exactly eight unscoped Round 6 QA fields; inspect changes before retrying';
  end if;
  select count(*),md5(string_agg(concat_ws('|',id,tenant_id,worker_id,file_url,original_file_name),',' order by id)) into v_files,v_fingerprint
    from public.worker_profession_document_uploads where tenant_id=v_tenant;
  for d in select * from public.tenant_profession_documents where tenant_id=v_tenant and worker_id is null and is_active and document_kind='other'
      and created_at >= '2026-11-27 15:17:00+00' and created_at < '2026-11-27 15:26:00+00'
      and name in ('SSN Card Alpha','DL Alpha','I9 Alpha','SSN Card Beta','DL Beta','EXIF photo Alpha','TypeTest html as pdf','TypeTest svg') for update
  loop
    select worker_id into strict v_owner from public.worker_profession_document_uploads where tenant_id=v_tenant and profession_document_id=d.id order by uploaded_at,id limit 1;
    update public.tenant_profession_documents set worker_id=v_owner where id=d.id and tenant_id=v_tenant;
    for candidate in select distinct worker_id from public.worker_profession_document_uploads where tenant_id=v_tenant and profession_document_id=d.id and worker_id<>v_owner
    loop
      loop
        v_index:=v_index+1;
        v_name:='Additional uploaded document '||v_index;
        exit when not exists(select 1 from public.tenant_profession_documents where tenant_id=v_tenant and profession_id=d.profession_id and worker_id=candidate.worker_id and is_active and lower(name)=lower(v_name));
      end loop;
      insert into public.tenant_profession_documents(tenant_id,profession_id,worker_id,name,document_kind,is_required,has_expiration,sort_order,is_active)
        values(v_tenant,d.profession_id,candidate.worker_id,v_name,'other',false,d.has_expiration,d.sort_order,true) returning id into v_clone;
      update public.worker_profession_document_uploads set profession_document_id=v_clone where tenant_id=v_tenant and worker_id=candidate.worker_id and profession_document_id=d.id;
    end loop;
  end loop;
  assert (select count(*)=v_files and md5(string_agg(concat_ws('|',id,tenant_id,worker_id,file_url,original_file_name),',' order by id))=v_fingerprint from public.worker_profession_document_uploads where tenant_id=v_tenant), 'Files or candidate ownership changed';
  assert not exists(select 1 from public.worker_profession_document_uploads u join public.tenant_profession_documents catalog on catalog.id=u.profession_document_id and catalog.tenant_id=u.tenant_id where u.tenant_id=v_tenant and catalog.worker_id is not null and catalog.worker_id<>u.worker_id), 'A candidate upload points to another candidate field';
end;
$$;
select 'eight QA fields scoped; all file paths, upload IDs and candidate ownership preserved' as verification;
rollback;
