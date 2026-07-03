"use client";

import Image from "next/image";
import { useState, type ComponentProps } from "react";

/** Password hidden (default). */
export const PASSWORD_EYE_OFF_ICON = "/eye-off.svg";
/** Password visible. */
export const PASSWORD_EYE_ON_ICON = "/icons/braas-HR/eye.svg";

type PasswordVisibilityToggleProps = {
  visible: boolean;
  onToggle: () => void;
  label?: string;
  className?: string;
};

/** Gray eye icons only — no branding tint on toggle. */
export function PasswordVisibilityToggle({
  visible,
  onToggle,
  label = "password",
  className = "",
}: PasswordVisibilityToggleProps) {
  return (
    <button
      type="button"
      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={visible}
      onClick={onToggle}
      className={`absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition hover:bg-[#f8fafc] ${className}`.trim()}
    >
      <Image
        src={visible ? PASSWORD_EYE_ON_ICON : PASSWORD_EYE_OFF_ICON}
        alt=""
        width={20}
        height={20}
        className="h-5 w-5 shrink-0"
        aria-hidden
      />
    </button>
  );
}

type PasswordInputWithToggleProps = Omit<ComponentProps<"input">, "type"> & {
  toggleLabel?: string;
  wrapperClassName?: string;
};

export function PasswordInputWithToggle({
  toggleLabel = "password",
  wrapperClassName = "",
  className = "",
  ...inputProps
}: PasswordInputWithToggleProps) {
  const [visible, setVisible] = useState(false);
  const paddingClass = /\bpr-/.test(className) ? "" : " pr-12";

  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <input
        {...inputProps}
        type={visible ? "text" : "password"}
        className={`${className}${paddingClass}`.trim()}
      />
      <PasswordVisibilityToggle
        visible={visible}
        onToggle={() => setVisible((current) => !current)}
        label={toggleLabel}
      />
    </div>
  );
}
