/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWorkerListCell, type WorkerListRow } from "./render-worker-list-cell";
describe("missing worker assignment values", () => {
  it("labels missing role and pay explicitly and keeps recorded pay visible", () => {
    const worker = { id: "worker-a", jobRole: "—", payRate: "—" } as WorkerListRow;
    const view = render(<>{renderWorkerListCell("jobRole", worker, () => "")}{renderWorkerListCell("payRate", worker, () => "")}</>);
    expect(screen.getAllByText("Not set")).toHaveLength(2);
    view.rerender(<>{renderWorkerListCell("payRate", { ...worker, payRate: "$0/hr" }, () => "")}</>);
    expect(screen.getByText("$0/hr")).toBeInTheDocument();
  });
});
