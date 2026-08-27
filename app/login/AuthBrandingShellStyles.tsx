import {
  brandingShellGradient,
  brandingToCssVars,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

type AuthBrandingShellStylesProps = {
  branding: TenantBranding;
  /** Admin classic login uses solid primary; other auth pages keep the brand gradient. */
  background?: "gradient" | "primary";
};

/** Blocking shell paint for auth pages — CSS vars (+ bg) before React hydrates. */
export default function AuthBrandingShellStyles({
  branding,
  background = "gradient",
}: AuthBrandingShellStylesProps) {
  const vars = brandingToCssVars(branding);
  const shellBg =
    background === "primary" ? branding.primaryHex : brandingShellGradient(branding);
  const varBlock = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");

  return (
    <style
      id="tenant-auth-shell-bg"
      dangerouslySetInnerHTML={{
        __html: `:root,html,body{${varBlock};background:${shellBg} !important;}`,
      }}
    />
  );
}
