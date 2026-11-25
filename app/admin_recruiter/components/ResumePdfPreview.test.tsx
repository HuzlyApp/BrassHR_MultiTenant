// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResumePdfPreview from "./ResumePdfPreview";
const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), getPage: vi.fn(), render: vi.fn(), destroy: vi.fn(async () => {}), cancel: vi.fn() }));
vi.mock("pdfjs-dist/webpack.mjs", () => ({ getDocument: (...args: unknown[]) => mocks.getDocument(...args) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 2, getPage: mocks.getPage }), destroy: mocks.destroy });
  mocks.getPage.mockResolvedValue({ getViewport: () => ({ width: 600, height: 800 }), render: mocks.render });
  mocks.render.mockReturnValue({ promise: Promise.resolve(), cancel: mocks.cancel });
});
describe("resume PDF rendering", () => {
  it("renders and paginates without a native browser PDF plugin", async () => {
    render(<ResumePdfPreview url="/api/admin/worker-resume-preview?workerId=qa" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled());
    expect(mocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({ withCredentials: true }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(mocks.getPage).toHaveBeenLastCalledWith(2));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
  it("shows an actionable error when the PDF cannot load", async () => {
    mocks.getDocument.mockReturnValue({ promise: Promise.reject(new Error("Invalid PDF")), destroy: mocks.destroy });
    render(<ResumePdfPreview url="/invalid" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Open or download");
  });
  it("destroys a pending document load on navigation", () => {
    const view = render(<ResumePdfPreview url="/resume" />);
    view.unmount();
    // An import that resolves after unmount must not start downloading the document.
    expect(mocks.getDocument).not.toHaveBeenCalled();
  });
});
