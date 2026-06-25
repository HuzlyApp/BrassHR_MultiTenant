"use client";

import { ChevronDown } from "lucide-react";

export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "California",
  "Colorado",
  "Florida",
  "Georgia",
  "Illinois",
  "New York",
  "Texas",
  "Washington",
];

export const FIELD =
  "h-11 w-full rounded-md border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color:var(--brand-primary)]";

export function FieldLabel({
  children,
  required,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  const className = "mb-2 block text-sm text-[#6B7280]";
  const content = (
    <>
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </>
  );

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={className}>
        {content}
      </label>
    );
  }

  return <span className={className}>{content}</span>;
}

export function SelectField({
  label,
  defaultValue,
  value,
  onChange,
  required,
  children,
}: {
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={`${FIELD} appearance-none pr-9`}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
          aria-hidden
        />
      </div>
    </label>
  );
}

export function TextField({
  label,
  defaultValue,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        className={FIELD}
      />
    </label>
  );
}

export function AddressField({
  label,
  helperText = "Building, Floor, etc.",
  defaultValue,
  value,
  onChange,
  required,
}: {
  label: string;
  helperText?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm text-[#6B7280]">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </span>
        {helperText ? (
          <span className="shrink-0 text-xs text-[#9CA3AF]">{helperText}</span>
        ) : null}
      </div>
      <input
        type="text"
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={FIELD}
      />
    </label>
  );
}

export const INDUSTRY_OPTIONS = [
  "Staffing",
  "Healthcare",
  "Home Care",
  "Allied Health",
  "Technology",
  "Other",
] as const;

export const EMPLOYEE_COUNT_OPTIONS = [
  "1-10",
  "10-30",
  "30-50",
  "50-100",
  "100+",
] as const;

export const CITY_OPTIONS = [
  "Los Angeles",
  "San Francisco",
  "San Diego",
  "Phoenix",
  "Houston",
  "Chicago",
  "New York",
  "Miami",
  "Other",
] as const;
