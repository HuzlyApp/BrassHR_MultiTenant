-- Application-managed login OTPs: only the latest code per email/purpose is valid.

CREATE TABLE IF NOT EXISTS public.auth_login_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  purpose text NOT NULL DEFAULT 'login',
  otp_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  invalidated_at timestamptz,
  CONSTRAINT auth_login_otps_email_chk CHECK (email = lower(trim(email))),
  CONSTRAINT auth_login_otps_purpose_chk CHECK (purpose ~ '^[a-z][a-z0-9_-]{0,63}$')
);

CREATE INDEX IF NOT EXISTS auth_login_otps_email_purpose_created_idx
  ON public.auth_login_otps (email, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_login_otps_active_latest_idx
  ON public.auth_login_otps (email, purpose, created_at DESC)
  WHERE used_at IS NULL AND invalidated_at IS NULL;

COMMENT ON TABLE public.auth_login_otps IS
  'Hashed login OTP codes. Only the newest non-invalidated row per email/purpose may be consumed.';

ALTER TABLE public.auth_login_otps ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.auth_login_otps TO service_role;

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
  v_id uuid;
  v_hash text;
BEGIN
  SELECT id, otp_hash
  INTO v_id, v_hash
  FROM public.auth_login_otps
  WHERE email = lower(trim(p_email))
    AND purpose = p_purpose
    AND used_at IS NULL
    AND invalidated_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL OR v_hash IS DISTINCT FROM p_otp_hash THEN
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
