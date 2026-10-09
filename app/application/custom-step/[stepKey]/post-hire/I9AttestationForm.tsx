"use client";

import { useState } from "react";
import type { PostHireSubmissionField } from "@/lib/onboarding/post-hire-step-screens";
import { ActionRow, CheckboxRow, Section, type ActionRowProps } from "./fields";

export type I9Prefill = { firstName: string; lastName: string; email: string };

export default function I9AttestationForm({
  prefill,
  attestationText,
  submit,
  actions,
}: {
  prefill: I9Prefill;
  attestationText: string;
  submit: (fields: PostHireSubmissionField[]) => Promise<void>;
  actions: ActionRowProps;
}) {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    if (!agreed) {
      setError("Check the I-9 Section 1 confirmation before continuing.");
      return;
    }
    const fields: PostHireSubmissionField[] = [
      { label: "Form", value: "I-9 Section 1" },
      { label: "Candidate", value: `${prefill.firstName} ${prefill.lastName}`.trim() || prefill.email || "Candidate" },
      { label: "Confirmation", value: attestationText },
      { label: "Confirmed on", value: new Date().toLocaleDateString("en-US") },
    ];

    setSaving(true);
    try {
      await submit(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your I-9 information");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Section title="I-9 Section 1">
        <CheckboxRow id="i9-section-1-confirmation" checked={agreed} onChange={setAgreed}>
          {attestationText}
        </CheckboxRow>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          HR will review your work authorization documents and complete the next I-9 step.
        </p>
      </Section>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <ActionRow {...actions} primaryLabel="Save & continue" onPrimary={() => void handleSave()} saving={saving} />
    </>
  );
}
