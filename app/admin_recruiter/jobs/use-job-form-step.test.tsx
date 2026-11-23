// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useJobFormStep } from "./use-job-form-step";

afterEach(cleanup);
describe("job wizard step navigation", () => {
  it("opens a valid deep-linked step after draft hydration", () => {
    window.history.replaceState(null, "", "/admin_recruiter/jobs/new?step=review&tenant=acme");
    const { result, rerender } = renderHook(({ ready }) => useJobFormStep("setup", ready), { initialProps: { ready: false } });
    expect(result.current.step).toBe("setup");
    rerender({ ready: true });
    expect(result.current.step).toBe("review");
  });
  it("updates the URL while preserving tenant context and responds to Back/Forward navigation", () => {
    window.history.replaceState(null, "", "/admin_recruiter/jobs/new?tenant=acme");
    const { result } = renderHook(() => useJobFormStep("setup", true));
    act(() => result.current.setStep("compensation"));
    expect(window.location.search).toBe("?tenant=acme&step=compensation");
    act(() => {
      window.history.replaceState(null, "", "/admin_recruiter/jobs/new?tenant=acme&step=requisition");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.step).toBe("requisition");
  });
  it("ignores unknown steps", () => {
    window.history.replaceState(null, "", "/admin_recruiter/jobs/new?step=unknown");
    const { result } = renderHook(() => useJobFormStep("setup", true));
    expect(result.current.step).toBe("setup");
  });
});
