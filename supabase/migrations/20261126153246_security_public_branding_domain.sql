-- Activated vanity hostname is public routing metadata.
-- Deliberately public, bounded branding lookup. No caller identity is required:
-- only explicitly approved presentation fields are exposed, never a tenants row.
CREATE OR REPLACE FUNCTION public.public_tenant_branding(p_kind text, p_value text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'slug', t.slug,
      'subdomain', t.subdomain,
      'domain', t.domain,
      'is_active', t.is_active,
      'logo_url', t.logo_url,
      'login_logo_url', t.login_logo_url,
      'signup_logo_url', t.signup_logo_url,
      'favicon_url', t.favicon_url,
      'primary_color', t.primary_color,
      'secondary_color', t.secondary_color,
      'accent_color', t.accent_color,
      'checkbox_color', t.checkbox_color,
      'welcome_headline', t.welcome_headline,
      'welcome_subtitle', t.welcome_subtitle,
      'signup_headline', t.signup_headline,
      'signup_subheadline', t.signup_subheadline,
      'auth_background_image_url', t.auth_background_image_url,
      'primary_font', t.primary_font,
      'heading_font', t.heading_font,
      'body_font', t.body_font,
      'font_color', t.font_color,
      'heading_color', t.heading_color,
      'muted_text_color', t.muted_text_color,
      'button_text', t.button_text,
      'button_color', t.button_color,
      'base_font_size', t.base_font_size,
      'hire_journey_theme', t.hire_journey_theme
  ) FROM public.tenants t
  WHERE t.is_active = true AND length(trim(p_value)) BETWEEN 1 AND 200
    AND CASE p_kind
      WHEN 'slug' THEN lower(t.slug) = lower(trim(p_value)) OR lower(t.subdomain) = lower(trim(p_value))
      WHEN 'subdomain' THEN lower(t.subdomain) = lower(trim(p_value)) OR lower(t.slug) = lower(trim(p_value))
      WHEN 'tenantId' THEN t.id::text = trim(p_value)
      ELSE false END
  ORDER BY CASE WHEN p_kind = 'subdomain' AND lower(t.subdomain) = lower(trim(p_value)) THEN 0
                WHEN p_kind = 'slug' AND lower(t.slug) = lower(trim(p_value)) THEN 0 ELSE 1 END, t.id
  LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.public_tenant_branding(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_tenant_branding(text,text) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.public_tenant_branding(text,text) IS 'Public exact-label branding only; explicit projection excludes company EIN, billing, contact and workspace configuration.';
