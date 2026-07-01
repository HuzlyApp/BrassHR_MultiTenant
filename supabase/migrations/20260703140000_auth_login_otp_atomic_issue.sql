-- Atomic OTP issue + enforce a single active code per email/purpose.

CREATE UNIQUE INDEX IF NOT EXISTS auth_login_otps_one_active_per_email_purpose_idx
  ON public.auth_login_otps (email, purpose)
  WHERE used_at IS NULL AND invalidated_at IS NULL;

CREATE OR REPLACE FUNCTION public.issue_auth_login_otp(
  p_email text,
  p_purpose text,
  p_otp_hash text,
  p_user_id uuid,
  p_expires_at timestamptz,
  p_now timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'email is required';
  END IF;

  IF p_purpose IS NULL OR p_purpose = '' THEN
    RAISE EXCEPTION 'purpose is required';
  END IF;

  IF p_otp_hash IS NULL OR p_otp_hash = '' THEN
    RAISE EXCEPTION 'otp hash is required';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= p_now THEN
    RAISE EXCEPTION 'expires_at must be in the future';
  END IF;

  UPDATE public.auth_login_otps
  SET invalidated_at = p_now
  WHERE email = v_email
    AND purpose = p_purpose
    AND used_at IS NULL
    AND invalidated_at IS NULL;

  INSERT INTO public.auth_login_otps (
    email,
    user_id,
    purpose,
    otp_hash,
    created_at,
    expires_at
  )
  VALUES (
    v_email,
    p_user_id,
    p_purpose,
    p_otp_hash,
    p_now,
    p_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_auth_login_otp(text, text, text, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_auth_login_otp(text, text, text, uuid, timestamptz, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_auth_login_otp(
  p_email text,
  p_purpose text,
  p_otp_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_id uuid;
  v_hash text;
  v_created_at timestamptz;
BEGIN
  SELECT id, otp_hash, created_at
  INTO v_id, v_hash, v_created_at
  FROM public.auth_login_otps
  WHERE email = v_email
    AND purpose = p_purpose
    AND used_at IS NULL
    AND invalidated_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_hash IS DISTINCT FROM p_otp_hash THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.auth_login_otps newer
    WHERE newer.email = v_email
      AND newer.purpose = p_purpose
      AND newer.used_at IS NULL
      AND newer.invalidated_at IS NULL
      AND newer.expires_at > now()
      AND newer.created_at > v_created_at
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.auth_login_otps
  SET used_at = now()
  WHERE id = v_id
    AND used_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_auth_login_otp(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_auth_login_otp(text, text, text) TO service_role;
