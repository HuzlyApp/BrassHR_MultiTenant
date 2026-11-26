// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FirmaTemplateBuilderFrame from "./FirmaTemplateBuilderFrame";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), destroy: vi.fn(), mount: vi.fn() }));
vi.mock("./recruiter-template-auth", () => ({ recruiterTemplateFetch: mocks.fetch }));
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function sessionResponse() {
  return { ok: true, json: async () => ({ session: {
    template: { id: "template-1" }, firma_template_id: "firma-1", jwt: "fresh.token.signature",
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    editor_app_url: "https://app.firma.dev", embed_script_url: "https://api.firma.dev/editor.js",
  } }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.destroy.mockReset();
  mocks.fetch.mockResolvedValue(sessionResponse());
  vi.stubGlobal("FirmaTemplateEditor", class {
    destroy = mocks.destroy;
    constructor(options: { container: HTMLElement; onLoad: () => void }) {
      mocks.mount();
      options.container.appendChild(document.createElement("canvas"));
      queueMicrotask(options.onLoad);
    }
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Firma builder recovery", () => {
  it("retries an initial connection failure without resetting the provider template", async () => {
    mocks.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<FirmaTemplateBuilderFrame templateId="template-1" />);
    await screen.findByText("Signature template builder unavailable");
    fireEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]);
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(1));
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({
      refresh_firma_document: false, force_recreate_firma_template: false,
    });
  });

  it("keeps React loading UI separate from the SDK host during a session refresh", async () => {
    const { container } = render(<FirmaTemplateBuilderFrame templateId="template-1" />);
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(1));
    let finish!: (value: ReturnType<typeof sessionResponse>) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh session" }));
    await waitFor(() => expect(screen.getAllByText("Starting signature template builder...")).toHaveLength(2));
    expect(container.querySelector("canvas")).toBeTruthy();
    finish(sessionResponse());
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Starting signature template builder...")).toBeNull();
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("preserves the editor and visible error after a failed refresh", async () => {
    render(<FirmaTemplateBuilderFrame templateId="template-1" />);
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(1));
    mocks.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh session" }));
    await screen.findByText("The network request failed. Check your connection and try again.");
    expect(mocks.mount).toHaveBeenCalledTimes(1);
    expect(mocks.destroy).not.toHaveBeenCalled();
  });

  it("does not reset placed fields after an unsuccessful rebuild", async () => {
    render(<FirmaTemplateBuilderFrame templateId="template-1" />);
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(1));
    mocks.fetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: "Unauthorized access" }) });
    fireEvent.click(screen.getByRole("button", { name: "Rebuild document" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Rebuild document" })[1]);
    await screen.findByText("You do not have permission to edit this signature template.");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({
      refresh_firma_document: true, force_recreate_firma_template: false,
    });
  });

  it("contains provider destroy errors when rebuilding the editor", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<FirmaTemplateBuilderFrame templateId="template-1" />);
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(1));
    mocks.destroy.mockImplementationOnce(() => { throw new Error("SDK cleanup failed"); });
    fireEvent.click(screen.getByRole("button", { name: "Refresh session" }));
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(2));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Editor cleanup failed"), expect.any(Error));
    warn.mockRestore();
  });
});
