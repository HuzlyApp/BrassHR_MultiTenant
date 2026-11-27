-- Rollback-only integration checks. Intended project: qowirmiicsrglehiaoil (development).
begin;
do $$
declare v_staff uuid; v_anon uuid; v_old_anon uuid; v_tenant uuid; v_session uuid:=gen_random_uuid(); v_second uuid:=gen_random_uuid(); v_anon_session uuid:=gen_random_uuid(); v_old_session uuid:=gen_random_uuid(); v_before timestamptz;
begin
  select u.id,u.tenant_id into strict v_staff,v_tenant from public.users u join public.tenants t on t.id=u.tenant_id where t.slug='zippycorp' and u.role='admin' and u.is_active limit 1;
  insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(v_session,v_staff,now(),now(),'aal1'),(v_second,v_staff,now(),now(),'aal1');
  assert public.check_staff_session_activity(v_staff,v_session,'start'), 'OTP binding must start activity';
  select last_activity_at into v_before from public.staff_session_activity where session_id=v_session;
  assert public.check_staff_session_activity(v_staff,v_session,'check'), 'normal read must be valid';
  assert (select last_activity_at=v_before from public.staff_session_activity where session_id=v_session), 'background reads must not extend idle';
  assert not public.check_staff_session_activity(gen_random_uuid(),v_session,'touch'), 'another user must not renew the session';
  update public.staff_session_activity set last_activity_at=now()-interval '31 minutes' where session_id=v_session;
  assert not public.check_staff_session_activity(v_staff,v_session,'touch'), 'an expired session must not revive on interaction';
  assert (select revoked_at is not null from public.staff_session_activity where session_id=v_session), 'expiry must persist';
  assert not public.check_staff_session_activity(v_staff,v_session,'start'), 'replayed binding must not restart revoked sessions';
  assert public.check_staff_session_activity(v_staff,v_second,'start'), 'independent sessions must remain valid';
  update public.staff_session_activity set started_at=now()-interval '12 hours' where session_id=v_second;
  assert not public.check_staff_session_activity(v_staff,v_second,'check'), 'absolute lifetime must expire an active session';

  select u.id into strict v_anon from auth.users u where u.is_anonymous and not exists(select 1 from public.worker w where w.user_id=u.id) limit 1;
  insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(v_anon_session,v_anon,now(),now(),'aal1');
  assert public.check_initial_application_session(v_anon,v_anon_session,v_tenant,'first-job',true), 'first anonymous application must remain available';
  assert public.check_initial_application_session(v_anon,v_anon_session,v_tenant,'first-job'), 'same active first flow must work';
  assert not public.check_initial_application_session(v_anon,v_anon_session,v_tenant,'second-job',true), 'second job must require sign-in';
  assert not public.check_initial_application_session(v_anon,v_anon_session,gen_random_uuid(),'first-job'), 'cross-tenant grant must fail';
  assert not public.check_initial_application_session(v_anon,gen_random_uuid(),v_tenant,'first-job'), 'new session must not reuse old identity';
  perform set_config('request.jwt.claims',json_build_object('sub',v_anon,'session_id',v_anon_session,'is_anonymous',true)::text,true);
  assert brass_private.initial_application_access_allowed(v_tenant), 'direct API boundary must allow active initial flow';
  assert not brass_private.initial_application_access_allowed(gen_random_uuid()), 'direct API boundary must reject a different tenant';
  update public.initial_application_sessions set expires_at=now()-interval '1 second' where user_id=v_anon;
  assert not public.check_initial_application_session(v_anon,v_anon_session,v_tenant,'first-job',true), 'an expired first flow must not restart';
  assert not brass_private.initial_application_access_allowed(v_tenant), 'expired JWT identity must not bypass direct API boundary';

  select u.id into strict v_old_anon from auth.users u join public.worker w on w.user_id=u.id join public.worker_onboarding_progress p on p.worker_id=w.id and p.tenant_id=w.tenant_id where u.is_anonymous and w.tenant_id=v_tenant and p.submitted_at is not null limit 1;
  insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(v_old_session,v_old_anon,now(),now(),'aal1');
  assert not public.check_initial_application_session(v_old_anon,v_old_session,v_tenant,'first-job',true), 'device identity with an existing profile must require sign-in';
  insert into public.initial_application_sessions(user_id,session_id,tenant_id,job_token) values(v_old_anon,v_old_session,v_tenant,'first-job');
  assert not public.check_initial_application_session(v_old_anon,v_old_session,v_tenant,'first-job'), 'submission must close anonymous access even before grant expiry';
  perform set_config('request.jwt.claims',json_build_object('sub',v_old_anon,'session_id',v_old_session,'is_anonymous',true)::text,true);
  assert not brass_private.initial_application_access_allowed(v_tenant), 'submitted applicant must not bypass through direct API or storage';

  assert not has_function_privilege('authenticated','public.check_staff_session_activity(uuid,uuid,text)','execute'), 'browser role must not renew server activity records';
  assert not has_function_privilege('authenticated','public.check_initial_application_session(uuid,uuid,uuid,text,boolean)','execute'), 'browser role must not mint initial application grants';
  assert (select count(*)=10 from pg_policies where policyname='initial_application_session_boundary' and permissive='RESTRICTIVE'), 'expected restrictive boundaries must be installed';
end;
$$;
select 'session boundary assertions passed; transaction rolled back' as verification;
rollback;
