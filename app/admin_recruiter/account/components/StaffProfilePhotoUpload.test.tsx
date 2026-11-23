// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StaffProfilePhotoUpload } from "./StaffProfilePhotoUpload";

describe("profile photo selection", () => {
  it.each([
    ["image/jpeg", 2 * 1024 * 1024 + 1, "max 2 MB"],
    ["image/webp", 100, "JPG or PNG"],
  ])("rejects invalid %s before creating a preview or making a request", (type, size, message) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const createPreview = vi.spyOn(URL, "createObjectURL");
    const { container } = render(<QueryClientProvider client={new QueryClient()}>
      <StaffProfilePhotoUpload displayName="Tester" photoUrl={null} />
    </QueryClientProvider>);
    const file = new File(["photo"], "photo.jpg", { type });
    Object.defineProperty(file, "size", { value: size });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(screen.getByText(new RegExp(message), { selector: "p" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createPreview).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
