-- Fix assert_applicant_email_required for shared use on applicants + applicant_profiles.
-- PL/pgSQL evaluates AND-conditions as one expression, so NEW.normalized_email /
-- NEW.auth_user_id were resolved even when TG_TABLE_NAME = 'applicants', which has
-- neither column. That broke interview scheduling (ensureApplicantForWorker insert).

CREATE OR REPLACE FUNCTION public.assert_applicant_email_required()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  email_value text := nullif(btrim(COALESCE(NEW.email, '')), '');
  old_email_value text := null;
  profile_auth_user_id uuid;
  profile_normalized_email text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_email_value := nullif(btrim(COALESCE(OLD.email, '')), '');
  END IF;

  IF email_value IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      -- Nested IF so applicants rows never touch applicant_profiles-only fields.
      IF TG_TABLE_NAME = 'applicant_profiles' THEN
        profile_auth_user_id := NEW.auth_user_id;
        IF profile_auth_user_id IS NOT NULL THEN
          RETURN NEW;
        END IF;
      END IF;

      RAISE EXCEPTION 'email is required'
        USING ERRCODE = '23502';
    END IF;

    -- Allow legacy null rows to keep null on unrelated updates,
    -- but never allow clearing a previously set email.
    IF old_email_value IS NOT NULL THEN
      RAISE EXCEPTION 'email cannot be cleared'
        USING ERRCODE = '23502';
    END IF;

    RETURN NEW;
  END IF;

  NEW.email := email_value;

  IF TG_TABLE_NAME = 'applicant_profiles' THEN
    profile_normalized_email := NEW.normalized_email;
    IF profile_normalized_email IS NULL OR btrim(profile_normalized_email) = '' THEN
      NEW.normalized_email := lower(email_value);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assert_applicant_email_required() IS
  'Requires email on applicants inserts and on applicant_profiles inserts without auth_user_id; blocks clearing set emails. Profile-only columns are accessed only when TG_TABLE_NAME is applicant_profiles.';
