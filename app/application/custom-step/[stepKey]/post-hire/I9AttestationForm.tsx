"use client";

import { useEffect, useState } from "react";
import { US_STATE_CODE_TO_NAME } from "@/lib/us-state-names";
import {
  I9_CITIZENSHIP_OPTIONS,
  type I9CitizenshipStatus,
  type PostHireSubmissionField,
} from "@/lib/onboarding/post-hire-step-screens";
import {
  ActionRow,
  CheckboxRow,
  isSignatureComplete,
  RadioGroup,
  Section,
  SelectField,
  SignatureBlock,
  TextField,
  type ActionRowProps,
  type SignatureValue,
} from "./fields";

const STATE_OPTIONS = Object.entries(US_STATE_CODE_TO_NAME)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

type AuthorizedDocType = "uscis" | "i94" | "passport";

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
  const [firstName, setFirstName] = useState(prefill.firstName);
  const [lastName, setLastName] = useState(prefill.lastName);
  const [middleInitial, setMiddleInitial] = useState("");
  const [otherLastNames, setOtherLastNames] = useState("");
  const [street, setStreet] = useState("");
  const [apt, setApt] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<I9CitizenshipStatus | "">("");
  const [aNumber, setANumber] = useState("");
  const [expiration, setExpiration] = useState("");
  const [noExpiration, setNoExpiration] = useState(false);
  const [docType, setDocType] = useState<AuthorizedDocType | "">("");
  const [i94, setI94] = useState("");
  const [passport, setPassport] = useState("");
  const [passportCountry, setPassportCountry] = useState("");
  const [signature, setSignature] = useState<SignatureValue>({ agreed: false, name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firstName && prefill.firstName) setFirstName(prefill.firstName);
    if (!lastName && prefill.lastName) setLastName(prefill.lastName);
    if (!email && prefill.email) setEmail(prefill.email);
    // Only backfill once the signing profile resolves; never overwrite what the candidate typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill.firstName, prefill.lastName, prefill.email]);

  function validate(): string | null {
    if (!firstName.trim() || !lastName.trim()) return "Enter your first and last name.";
    if (!street.trim() || !city.trim() || !state || !/^\d{5}(-\d{4})?$/.test(zip.trim())) {
      return "Enter your full address, including a valid ZIP code.";
    }
    if (!dob) return "Enter your date of birth.";
    if (!status) return "Choose your citizenship or immigration status.";
    if (status === "permanent_resident" && !aNumber.trim()) return "Enter your USCIS or A-Number.";
    if (status === "authorized_alien") {
      if (!noExpiration && !expiration) return "Enter your work authorization expiration date, or mark N/A.";
      if (!docType) return "Choose which document number you will provide.";
      if (docType === "uscis" && !aNumber.trim()) return "Enter your USCIS or A-Number.";
      if (docType === "i94" && !i94.trim()) return "Enter your Form I-94 admission number.";
      if (docType === "passport" && (!passport.trim() || !passportCountry.trim())) {
        return "Enter your foreign passport number and country of issuance.";
      }
    }
    if (!isSignatureComplete(signature)) return "Check the attestation and type your full legal name to sign.";
    return null;
  }

  async function handleSave() {
    setError("");
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const statusLabel = I9_CITIZENSHIP_OPTIONS.find((o) => o.value === status)?.label ?? status;
    const address = [street.trim(), apt.trim() ? `Apt ${apt.trim()}` : "", city.trim(), `${state} ${zip.trim()}`]
      .filter(Boolean)
      .join(", ");
    const fields: PostHireSubmissionField[] = [
      { label: "Form", value: "Form I-9, Section 1 (Employee Information and Attestation)" },
      { label: "Last name", value: lastName },
      { label: "First name", value: firstName },
      { label: "Middle initial", value: middleInitial },
      { label: "Other last names used", value: otherLastNames },
      { label: "Address", value: address },
      { label: "Date of birth", value: dob },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
      { label: "Citizenship / immigration status", value: statusLabel },
    ];
    if (status === "permanent_resident") fields.push({ label: "USCIS / A-Number", value: aNumber });
    if (status === "authorized_alien") {
      fields.push({ label: "Work authorization expires", value: noExpiration ? "N/A" : expiration });
      if (docType === "uscis") fields.push({ label: "USCIS / A-Number", value: aNumber });
      if (docType === "i94") fields.push({ label: "Form I-94 admission number", value: i94 });
      if (docType === "passport") {
        fields.push({ label: "Foreign passport number", value: passport });
        fields.push({ label: "Passport country of issuance", value: passportCountry });
      }
    }
    fields.push({ label: "Signature", value: signature.name.trim() });
    fields.push({ label: "Signed on", value: new Date().toLocaleDateString("en-US") });

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
      <Section title="Your name">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <TextField id="i9-last" label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" required />
          <TextField id="i9-first" label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" required />
          <TextField id="i9-mi" label="Middle initial" value={middleInitial} onChange={(v) => setMiddleInitial(v.slice(0, 1))} maxLength={1} />
          <TextField id="i9-other-names" label="Other last names used" value={otherLastNames} onChange={setOtherLastNames} />
        </div>
      </Section>

      <Section title="Address">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <TextField id="i9-street" label="Street address" value={street} onChange={setStreet} autoComplete="address-line1" required />
          <TextField id="i9-apt" label="Apt. number" value={apt} onChange={setApt} autoComplete="address-line2" />
          <TextField id="i9-city" label="City or town" value={city} onChange={setCity} autoComplete="address-level2" required />
          <div className="grid grid-cols-2 gap-3">
            <SelectField id="i9-state" label="State" value={state} onChange={setState} options={STATE_OPTIONS} required />
            <TextField id="i9-zip" label="ZIP code" value={zip} onChange={setZip} inputMode="numeric" autoComplete="postal-code" maxLength={10} required />
          </div>
        </div>
      </Section>

      <Section title="Personal details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <TextField id="i9-dob" label="Date of birth" type="date" value={dob} onChange={setDob} autoComplete="bday" required />
          <TextField id="i9-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <TextField id="i9-phone" label="Phone" type="tel" value={phone} onChange={setPhone} autoComplete="tel" />
        </div>
      </Section>

      <Section title="Citizenship or immigration status">
        <RadioGroup
          name="i9-status"
          label="I attest, under penalty of perjury, that I am:"
          value={status}
          onChange={(v) => setStatus(v as I9CitizenshipStatus)}
          options={I9_CITIZENSHIP_OPTIONS}
          required
        />

        {status === "permanent_resident" ? (
          <TextField id="i9-anumber" className="mt-3 sm:max-w-sm" label="USCIS or A-Number" value={aNumber} onChange={setANumber} required />
        ) : null}

        {status === "authorized_alien" ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end sm:gap-4">
              {noExpiration ? null : (
                <TextField id="i9-expiration" label="Work authorization expiration date" type="date" value={expiration} onChange={setExpiration} required />
              )}
              <CheckboxRow id="i9-no-expiration" checked={noExpiration} onChange={setNoExpiration}>
                My work authorization does not expire (N/A)
              </CheckboxRow>
            </div>
            <RadioGroup
              name="i9-doc-type"
              label="Provide one of the following"
              value={docType}
              onChange={(v) => setDocType(v as AuthorizedDocType)}
              options={[
                { value: "uscis", label: "USCIS or A-Number" },
                { value: "i94", label: "Form I-94 admission number" },
                { value: "passport", label: "Foreign passport number and country of issuance" },
              ]}
              required
            />
            {docType === "uscis" ? (
              <TextField id="i9-auth-anumber" className="sm:max-w-sm" label="USCIS or A-Number" value={aNumber} onChange={setANumber} required />
            ) : null}
            {docType === "i94" ? (
              <TextField id="i9-i94" className="sm:max-w-sm" label="Form I-94 admission number" value={i94} onChange={setI94} required />
            ) : null}
            {docType === "passport" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <TextField id="i9-passport" label="Foreign passport number" value={passport} onChange={setPassport} required />
                <TextField id="i9-passport-country" label="Country of issuance" value={passportCountry} onChange={setPassportCountry} required />
              </div>
            ) : null}
          </div>
        ) : null}
      </Section>

      <p className="mt-4 text-xs text-slate-500">
        On or before your first day, bring original documents that prove your identity and work authorization. HR
        completes Section 2 after reviewing them.
      </p>

      <SignatureBlock idPrefix="i9" statement={attestationText} value={signature} onChange={setSignature} />

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <ActionRow {...actions} primaryLabel="Sign & continue" onPrimary={() => void handleSave()} saving={saving} />
    </>
  );
}
