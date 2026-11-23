// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AcknowledgmentForm from "./AcknowledgmentForm";
describe("signature acknowledgment", () => {
  it("requires consent and a legal-name signature before submitting signed evidence", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<AcknowledgmentForm mode="acknowledgment" acknowledgmentText="I consent to sign this authorization." documentUrl={null} submit={submit} actions={{ onBack: () => {} }} />);
    fireEvent.click(screen.getByRole("button", { name: "I consent to sign this authorization." }));
    fireEvent.click(screen.getByRole("button", { name: "Sign & continue" }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Type your full legal name to sign/), { target: { value: "Test Signer" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign & continue" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.arrayContaining([{ label: "Signature", value: "Test Signer" }]), expect.objectContaining({ signature_name: "Test Signer", policy_acknowledged: true })));
  });
});
