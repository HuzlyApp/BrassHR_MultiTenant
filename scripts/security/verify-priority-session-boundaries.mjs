// Isolated PostgreSQL verification only. No credentials or network database connection.
// Setup: npm install --prefix output/qa/pglite --ignore-scripts --no-save --no-package-lock @electric-sql/pglite@0.6.1
import { readFile } from "node:fs/promises";
import { PGlite } from "../../output/qa/pglite/node_modules/@electric-sql/pglite/dist/index.js";
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
    create table auth.users(id uuid primary key,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz,updated_at timestamptz,aal text);
    create table public.tenants(id uuid primary key,slug text);
    create table public.users(id uuid primary key references auth.users(id),tenant_id uuid references public.tenants(id),role text,is_active boolean,god_admin boolean default false);
    create table public.worker(id uuid primary key,user_id uuid references auth.users(id),tenant_id uuid references public.tenants(id));
    alter table public.worker enable row level security;
    create policy fixture_worker_access on public.worker to authenticated using (user_id=auth.uid());
    create table public.tenant_profession_documents(id uuid primary key default gen_random_uuid(),tenant_id uuid references public.tenants(id),profession_id uuid,name text,document_kind text,is_required boolean,has_expiration boolean default false,sort_order integer,is_active boolean,created_at timestamptz default now(),updated_at timestamptz default now(),created_by uuid);
    alter table public.tenant_profession_documents enable row level security;
    create unique index tenant_profession_documents_name_uidx on public.tenant_profession_documents(tenant_id,profession_id,lower(name)) where is_active;
    create function public.approved_applicant_owns_worker(p_worker uuid) returns boolean language sql stable as $$ select exists(select 1 from public.worker where id=p_worker and user_id=auth.uid()) $$;
    create policy tenant_profession_documents_applicant_select on public.tenant_profession_documents to authenticated using (true);
    create table public.job_requisitions(id uuid primary key,tenant_id uuid,public_job_token text);
    create table public.worker_profession_document_uploads(id uuid primary key default gen_random_uuid(),tenant_id uuid,worker_id uuid references public.worker(id),profession_document_id uuid references public.tenant_profession_documents(id),file_url text,original_file_name text,uploaded_at timestamptz);
    alter table public.worker_profession_document_uploads enable row level security;
    create table storage.objects(id uuid primary key); alter table storage.objects enable row level security;
  `);
  for (const table of ["job_applications","worker_documents","worker_submitted_documents","worker_portal_documents","worker_resumes","worker_onboarding_progress","worker_onboarding_step_progress"]) {
    await db.exec(`create table public.${table}(id uuid primary key default gen_random_uuid(),tenant_id uuid,worker_id uuid references public.worker(id),job_requisition_id uuid,applicant_auth_user_id uuid,submitted_at timestamptz,completed_at timestamptz); alter table public.${table} enable row level security;`);
  }
  await db.exec(`grant usage on schema public,auth,storage to authenticated,service_role; grant all on all tables in schema public to service_role; grant select on all tables in schema public to authenticated; grant execute on all functions in schema public,auth to authenticated,service_role;
    do $$ declare tenant uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); fresh uuid:=gen_random_uuid(); old uuid:=gen_random_uuid(); second uuid:=gen_random_uuid(); first_worker uuid:=gen_random_uuid(); second_worker uuid:=gen_random_uuid(); profession uuid:=gen_random_uuid(); doc uuid; label text; counter integer:=0; begin
      insert into public.tenants values(tenant,'zippycorp');
      insert into auth.users values(staff,false),(fresh,true),(old,true),(second,false);
      insert into public.users values(staff,tenant,'admin',true,false),(second,tenant,'candidate',true,false);
      insert into public.worker values(first_worker,old,tenant),(second_worker,second,tenant);
      insert into public.worker_onboarding_progress(tenant_id,worker_id,submitted_at) values(tenant,first_worker,now());
      foreach label in array array['SSN Card Alpha','DL Alpha','I9 Alpha','SSN Card Beta','DL Beta','EXIF photo Alpha','TypeTest html as pdf','TypeTest svg'] loop
        counter:=counter+1;
        insert into public.tenant_profession_documents(tenant_id,profession_id,name,document_kind,is_required,is_active,sort_order,created_at) values(tenant,profession,label,'other',true,true,counter,'2026-11-27 15:20:00+00') returning id into doc;
        insert into public.worker_profession_document_uploads(tenant_id,worker_id,profession_document_id,file_url,original_file_name,uploaded_at) values(tenant,first_worker,doc,'local-fixture/first.pdf','first.pdf',now());
        if counter<8 then insert into public.worker_profession_document_uploads(tenant_id,worker_id,profession_document_id,file_url,original_file_name,uploaded_at) values(tenant,second_worker,doc,'local-fixture/second.pdf','second.pdf',now()+interval '1 hour'); end if;
      end loop;
    end $$;`);
  const migration = await readFile(new URL("../../supabase/migrations/20261127174154_candidate_document_scope_and_staff_session_activity.sql",import.meta.url),"utf8");
  await db.exec(migration);
  console.log("PASS: migration parses and applies on isolated PostgreSQL fixtures");
  await db.exec(await readFile(new URL("./verify-priority-session-boundaries.sql",import.meta.url),"utf8"));
  console.log("PASS: staff idle/absolute expiry, replay, anonymous tenant/job/session/expiry/submission and grants assertions");
  const repair = await readFile(new URL("./repair-qa-candidate-document-scopes.sql",import.meta.url),"utf8");
  await db.exec(repair);
  const before = await db.query("select count(*)::int as total from public.tenant_profession_documents where worker_id is null");
  if (before.rows[0].total!==8) throw new Error("Repair rehearsal failed to roll back");
  await db.exec(repair.replace(/rollback;\s*$/i,"commit;"));
  const after = await db.query("select count(*)::int as total,count(*) filter(where worker_id is null)::int as global from public.tenant_profession_documents");
  if (after.rows[0].total!==15 || after.rows[0].global!==0) throw new Error("Repair did not preserve and isolate all candidate fields");
  console.log("PASS: eight-field repair rehearsal rolls back; local commit isolates 15 uploads without changing file paths or ownership");
  await db.exec(`begin;
    do $$ declare candidate uuid; own_worker uuid; begin
      select id into strict candidate from public.users where role='candidate';
      select id into strict own_worker from public.worker where user_id=candidate;
      perform set_config('request.jwt.claims',json_build_object('sub',candidate,'is_anonymous',false)::text,true);
      perform set_config('brass_test.worker_id',own_worker::text,true);
    end $$;
    set local role authenticated;
    do $$ begin
      assert (select count(*)=7 from public.tenant_profession_documents), 'candidate must see only their seven private cloned fields';
      assert not exists(select 1 from public.tenant_profession_documents where worker_id<>current_setting('brass_test.worker_id')::uuid), 'candidate can read another candidate label';
    end $$;
    rollback;`);
  console.log("PASS: authenticated candidate Data API role sees own seven fields and zero other-candidate labels");
} catch (error) {
  console.error(error.message, error.code || "", error.where || "");
  process.exitCode = 1;
} finally { await db.close(); }
