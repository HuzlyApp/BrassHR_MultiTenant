// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { rejectWorkflowStepTextDrop } from "./workflow-step-drag";
import { DRAG_DATA_TYPE } from "./constants";
describe("workflow library text drops", () => {
  it.each(["input", "textarea", "div"]) ("rejects library data in editable %s without mutating text", tag => {
    const target = document.createElement(tag);
    target.setAttribute("contenteditable", "true");
    const event = { target, dataTransfer: { types: [DRAG_DATA_TYPE] } as unknown as DataTransfer, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    rejectWorkflowStepTextDrop(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });
  it("leaves canvas insertion and ordinary text drops available", () => {
    const event = { target: document.createElement("div"), dataTransfer: { types: [DRAG_DATA_TYPE] } as unknown as DataTransfer, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    rejectWorkflowStepTextDrop(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    event.target = document.createElement("input");
    event.dataTransfer = { types: ["text/plain"] } as unknown as DataTransfer;
    rejectWorkflowStepTextDrop(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
