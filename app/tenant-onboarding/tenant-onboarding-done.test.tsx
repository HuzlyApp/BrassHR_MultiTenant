// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DoneStep } from "@/app/tenant-onboarding/tenant-onboarding-steps";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";

describe("DoneStep Firma provisioning UI", () => {
  it("shows workspace created headline without manual setup message", () => {
    render(
      <DoneStep
        preview={defaultTenantBranding()}
        createdSlug="workspacetesty"
        createdDomain="workspacetesty.example.com"
        firmaProvisioning={{
          status: "created",
          workspaceId: "3b9e2ce8-22f1-4a48-9564-80245d73a21b",
        }}
      />
    );

    expect(screen.getByText(/Firma workspace created successfully/i)).toBeInTheDocument();
    expect(screen.getByText("3b9e2ce8-22f1-4a48-9564-80245d73a21b")).toBeInTheDocument();
    expect(screen.queryByText(/Set a Firma workspace manually/i)).not.toBeInTheDocument();
  });

  it("shows retry message when provisioning failed", () => {
    render(
      <DoneStep
        preview={defaultTenantBranding()}
        createdSlug="workspacetesty"
        createdDomain={null}
        firmaProvisioning={{
          status: "failed",
          workspaceId: null,
          message: "Tenant ready, but Firma workspace creation failed. You can retry in Account Settings.",
        }}
      />
    );

    expect(screen.getByText(/retry in Account Settings/i)).toBeInTheDocument();
  });
});
