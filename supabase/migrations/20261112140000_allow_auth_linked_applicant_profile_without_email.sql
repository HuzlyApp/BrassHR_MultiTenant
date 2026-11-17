-- Resume-first public apply creates applicant_profiles before email is known.
-- Keep requiring email for applicants rows and for applicant_profiles without auth_user_id.
-- Still block clearing a previously set email on update.

CREATE OR REPLACE FUNCTION public.assert_applicant_email_required()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  email_value text := nullif(btrim(COALESCE(NEW.email, '')), '');
  old_email_value text := null;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_email_value := nullif(btrim(COALESCE(OLD.email, '')), '');
  END IF;

  IF email_value IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      IF TG_TABLE_NAME = 'applicant_profiles' AND NEW.auth_user_id IS NOT NULL THEN
        RETURN NEW;
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

  IF TG_TABLE_NAME = 'applicant_profiles'
     AND (NEW.normalized_email IS NULL OR btrim(NEW.normalized_email) = '') THEN
    NEW.normalized_email := lower(email_value);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applicant_profiles_email_required ON public.applicant_profiles;
CREATE TRIGGER trg_applicant_profiles_email_required
BEFORE INSERT OR UPDATE ON public.applicant_profiles
FOR EACH ROW
EXECUTE FUNCTION public.assert_applicant_email_required();

DROP TRIGGER IF EXISTS trg_applicants_email_required ON public.applicants;
CREATE TRIGGER trg_applicants_email_required
BEFORE INSERT OR UPDATE ON public.applicants
FOR EACH ROW
EXECUTE FUNCTION public.assert_applicant_email_required();

COMMENT ON FUNCTION public.assert_applicant_email_required() IS
  'Requires email on applicants inserts and on applicant_profiles inserts without auth_user_id; blocks clearing set emails.';
