"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import SettingsSelect from "@/app/admin_recruiter/settings/SettingsSelect";
import { PERSON_NAME_MAX_LENGTH } from "@/lib/person-name";
import { interStyle } from "../constants";

export type InviteDraftInput = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

const fieldClass =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[14px] text-[#0F172A] outline-none focus:border-[#012352]";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function InviteAddModal({
  open,
  onOpenChange,
  roleOptions,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleOptions: Array<{ value: string; label: string }>;
  onAdd: (draft: InviteDraftInput) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const defaultRole =
    roleOptions.find((option) => option.value === "recruiter")?.value ??
    roleOptions[0]?.value ??
    "recruiter";
  const [role, setRole] = useState(defaultRole);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setRole(defaultRole);
    setError(null);
  };

  const handleAdd = () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedFirst) {
      setError("First name is required.");
      return;
    }
    if (!trimmedLast) {
      setError("Last name is required.");
      return;
    }
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!role) {
      setError("Choose a role.");
      return;
    }
    onAdd({
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email: trimmedEmail,
      role,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-32px)] max-w-[500px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-xl outline-none">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <Dialog.Title className="text-[18px] font-semibold text-black" style={interStyle}>
              Invite teammate
            </Dialog.Title>
            <Dialog.Close
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC]"
              aria-label="Close"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <Dialog.Description className="text-[13px] text-[#6B7280]" style={interStyle}>
              Add someone to your invite list. You can send the invite from the list.
            </Dialog.Description>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] text-black" style={interStyle}>
                  First name <span className="text-[#DC2626]">*</span>
                </span>
                <input
                  aria-label="First name"
                  value={firstName}
                  maxLength={PERSON_NAME_MAX_LENGTH}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={fieldClass}
                  style={interStyle}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] text-black" style={interStyle}>
                  Last name <span className="text-[#DC2626]">*</span>
                </span>
                <input
                  aria-label="Last name"
                  value={lastName}
                  maxLength={PERSON_NAME_MAX_LENGTH}
                  onChange={(e) => setLastName(e.target.value)}
                  className={fieldClass}
                  style={interStyle}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-black" style={interStyle}>
                Email <span className="text-[#DC2626]">*</span>
              </span>
              <input
                aria-label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className={fieldClass}
                style={interStyle}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] text-black" style={interStyle}>
                Role
              </span>
              <SettingsSelect
                aria-label="Invite role"
                value={role}
                options={roleOptions}
                onChange={setRole}
                size="sm"
                className="w-full"
                accentHex="#012352"
                triggerClassName="h-9 w-full justify-between rounded-lg border border-[#E5E7EB] bg-white px-3 pr-3 text-[14px] text-black hover:bg-white focus-visible:border-[#012352]"
              />
            </div>

            {error ? (
              <p role="alert" className="text-[12px] text-[#DC2626]" style={interStyle}>
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-5 py-4">
            <Dialog.Close
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-[#012352] bg-white px-3.5 text-[14px] font-semibold text-[#012352]"
              style={interStyle}
            >
              Cancel
            </Dialog.Close>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-[#012352] px-3.5 text-[14px] font-semibold text-white"
              style={interStyle}
            >
              Add in list
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
