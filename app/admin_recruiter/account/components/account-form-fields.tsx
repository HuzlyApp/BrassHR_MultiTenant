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
  "h-11 w-full rounded-md border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] outline-none transition-colors focus:border-[var(--brand-primary,#BC8B41)]";

export function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <span className="mb-2 block text-sm text-[#6B7280]">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </span>
  );
}

export function SelectField({
  label,
  defaultValue,
  required,
  children,
}: {
  label: string;
  defaultValue: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="relative">
        <select defaultValue={defaultValue} className={`${FIELD} appearance-none pr-9`}>
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
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type}
        defaultValue={defaultValue}
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
  required,
}: {
  label: string;
  helperText?: string;
  defaultValue: string;
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
      <input type="text" defaultValue={defaultValue} className={FIELD} />
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
