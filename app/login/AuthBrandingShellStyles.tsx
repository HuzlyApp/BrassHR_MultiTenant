import {
  brandingShellGradient,
  brandingToCssVars,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

/** Blocking shell paint for auth pages — gradient + CSS vars before React hydrates. */
export default function AuthBrandingShellStyles({ branding }: { branding: TenantBranding }) {
  const vars = brandingToCssVars(branding);
  const gradient = brandingShellGradient(branding);
  const varBlock = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");

  return (
    <style
      id="tenant-auth-shell-bg"
      dangerouslySetInnerHTML={{
        __html: `:root,html,body{${varBlock};background:${gradient} !important;}`,
      }}
    />
  );
}
