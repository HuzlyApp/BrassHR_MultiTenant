"use client";

import { useState } from "react";
import type { PostHireSubmissionField } from "@/lib/onboarding/post-hire-step-screens";
import {
  ActionRow,
  CheckboxRow,
  isSignatureComplete,
  Section,
  SignatureBlock,
  type ActionRowProps,
  type SignatureValue,
} from "./fields";

/** Policy / welcome packet / equipment acknowledgments (typed signature) and training completion (checkbox). */
export default function AcknowledgmentForm({
  mode,
  acknowledgmentText,
  documentUrl,
  submit,
  actions,
}: {
  mode: "acknowledgment" | "training";
  acknowledgmentText: string;
  documentUrl: string | null;
  submit: (fields: PostHireSubmissionField[]) => Promise<void>;
  actions: ActionRowProps;
}) {
  const [signature, setSignature] = useState<SignatureValue>({ agreed: false, name: "" });
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    if (mode === "training" && !completed) {
      setError("Confirm you completed this training to continue.");
      return;
    }
    if (mode === "acknowledgment" && !isSignatureComplete(signature)) {
      setError("Check the acknowledgment and type your full legal name to sign.");
      return;
    }
    const today = new Date().toLocaleDateString("en-US");
    const fields: PostHireSubmissionField[] =
      mode === "training"
        ? [
            { label: "Training completed", value: "Yes" },
            { label: "Statement", value: acknowledgmentText },
            { label: "Completed on", value: today },
          ]
        : [
            { label: "Acknowledged", value: "Yes" },
            { label: "Statement", value: acknowledgmentText },
            { label: "Document", value: documentUrl ?? "" },
            { label: "Signature", value: signature.name.trim() },
            { label: "Signed on", value: today },
          ];
    setSaving(true);
    try {
      await submit(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your response");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {mode === "training" ? (
        <Section>
          <CheckboxRow id="training-complete" checked={completed} onChange={setCompleted}>
            {acknowledgmentText}
          </CheckboxRow>
        </Section>
      ) : (
        <SignatureBlock idPrefix="ack" statement={acknowledgmentText} value={signature} onChange={setSignature} />
      )}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <ActionRow
        {...actions}
        primaryLabel={mode === "training" ? "Mark complete & continue" : "Sign & continue"}
        onPrimary={() => void handleSave()}
        saving={saving}
      />
    </>
  );
}
