-- Adversarial RLS tests for Brass HR.
-- Run ONLY against local Supabase or a dedicated test project:
--   supabase db query --local -f supabase/tests/rls_adversarial.sql
-- This script wraps work in a transaction and rolls back.

BEGIN;

CREATE TEMP TABLE rls_adv_expect (name text PRIMARY KEY, ok boolean NOT NULL);

CREATE OR REPLACE FUNCTION pg_temp.rls_adv_pass(p_name text, p_ok boolean)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO rls_adv_expect(name, ok) VALUES (p_name, p_ok)
  ON CONFLICT (name) DO UPDATE SET ok = EXCLUDED.ok;
  IF NOT p_ok THEN
    RAISE EXCEPTION 'RLS adversarial failure: %', p_name;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.rls_set_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated', 'aud', 'authenticated')::text,
    true
  );
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.rls_clear_user()
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RESET ROLE;
END;
$$;

DO $$
DECLARE
  v_tenant_a uuid := gen_random_uuid();
  v_tenant_b uuid := gen_random_uuid();
  v_admin_a uuid := gen_random_uuid();
  v_admin_b uuid := gen_random_uuid();
  v_rec_a uuid := gen_random_uuid();
  v_worker_a uuid;
  v_worker_b uuid;
  v_note_a uuid;
  v_note_b uuid;
  v_cnt int;
  v_god boolean;
BEGIN
  INSERT INTO public.tenants (id, name, slug, is_active)
  VALUES
    (v_tenant_a, 'RLS Canary A CANARY_TENANT_A_8f2e', 'rls-sql-a-' || substr(v_tenant_a::text, 1, 8), true),
    (v_tenant_b, 'RLS Canary B CANARY_TENANT_B_6d91', 'rls-sql-b-' || substr(v_tenant_b::text, 1, 8), true);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    ('00000000-0000-0000-0000-000000000000', v_admin_a, 'authenticated', 'authenticated',
     'sql-admin-a@rls.test', crypt('x', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_admin_b, 'authenticated', 'authenticated',
     'sql-admin-b@rls.test', crypt('x', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_rec_a, 'authenticated', 'authenticated',
     'sql-rec-a@rls.test', crypt('x', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now());

  INSERT INTO public.users (id, tenant_id, email, role, god_admin, is_active, is_verified)
  VALUES
    (v_admin_a, v_tenant_a, 'sql-admin-a@rls.test', 'admin', false, true, true),
    (v_admin_b, v_tenant_b, 'sql-admin-b@rls.test', 'admin', false, true, true),
    (v_rec_a, v_tenant_a, 'sql-rec-a@rls.test', 'client', false, true, true);

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES
    (v_admin_a, v_tenant_a, 'admin'),
    (v_admin_b, v_tenant_b, 'admin'),
    (v_rec_a, v_tenant_a, 'client');

  INSERT INTO public.worker (tenant_id, first_name, last_name, email, user_id)
  VALUES
    (v_tenant_a, 'WorkerA', 'Canary', 'sql-worker-a@rls.test', v_admin_a)
  RETURNING id INTO v_worker_a;

  INSERT INTO public.worker (tenant_id, first_name, last_name, email, user_id)
  VALUES
    (v_tenant_b, 'WorkerB', 'Canary', 'sql-worker-b@rls.test', v_admin_b)
  RETURNING id INTO v_worker_b;

  INSERT INTO public.worker_notes (tenant_id, worker_id, body)
  VALUES (v_tenant_a, v_worker_a, 'SECRET_A1_NOTE_CANARY_d873')
  RETURNING id INTO v_note_a;

  INSERT INTO public.worker_notes (tenant_id, worker_id, body)
  VALUES (v_tenant_b, v_worker_b, 'SECRET_B1_NOTE_CANARY_9c44')
  RETURNING id INTO v_note_b;

  -- As Tenant A recruiter: cannot read Tenant B note by known UUID.
  PERFORM pg_temp.rls_set_user(v_rec_a);
  SELECT count(*) INTO v_cnt FROM public.worker_notes WHERE id = v_note_b;
  PERFORM pg_temp.rls_adv_pass('recruiter_a_cannot_select_tenant_b_note', v_cnt = 0);

  SELECT count(*) INTO v_cnt FROM public.worker_notes WHERE id = v_note_a;
  PERFORM pg_temp.rls_adv_pass('recruiter_a_can_select_own_note', v_cnt = 1);

  SELECT count(*) INTO v_cnt FROM public.worker WHERE id = v_worker_b;
  PERFORM pg_temp.rls_adv_pass('recruiter_a_cannot_select_tenant_b_worker', v_cnt = 0);

  BEGIN
    UPDATE public.worker_notes SET body = 'HACKED' WHERE id = v_note_b;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    PERFORM pg_temp.rls_adv_pass('recruiter_a_cannot_update_tenant_b_note', v_cnt = 0);
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    PERFORM pg_temp.rls_adv_pass('recruiter_a_cannot_update_tenant_b_note', true);
  END;

  BEGIN
    INSERT INTO public.worker_notes (tenant_id, worker_id, body)
    VALUES (v_tenant_b, v_worker_b, 'SPOOF');
    PERFORM pg_temp.rls_adv_pass('recruiter_a_cannot_insert_tenant_b_note', false);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rls_adv_pass('recruiter_a_cannot_insert_tenant_b_note', true);
  END;

  BEGIN
    UPDATE public.users SET god_admin = true WHERE id = v_rec_a;
    SELECT god_admin INTO v_god FROM public.users WHERE id = v_rec_a;
    PERFORM pg_temp.rls_adv_pass('recruiter_cannot_forge_god_admin', v_god IS NOT TRUE);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rls_adv_pass('recruiter_cannot_forge_god_admin', true);
  END;

  PERFORM pg_temp.rls_clear_user();

  -- Anon cannot read private notes.
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT count(*) INTO v_cnt FROM public.worker_notes WHERE id = v_note_b;
  PERFORM pg_temp.rls_adv_pass('anon_cannot_select_private_notes', v_cnt = 0);
  PERFORM pg_temp.rls_clear_user();
END;
$$;

ROLLBACK;
