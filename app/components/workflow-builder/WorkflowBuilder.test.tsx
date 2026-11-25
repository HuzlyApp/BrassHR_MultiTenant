// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WorkflowBuilder from "./WorkflowBuilder";
vi.mock("@xyflow/react", async () => {
  const { useState } = await import("react");
  return { ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children, useNodesState: (initial: unknown[]) => [...useState(initial), vi.fn()], useEdgesState: (initial: unknown[]) => [...useState(initial), vi.fn()] };
});
vi.mock("./StepsCanvas", () => ({ default: () => null }));
vi.mock("./StepsLibrary", () => ({ default: () => null }));
vi.mock("./StepsSettingsPanel", () => ({ default: () => null }));
describe("workflow publish display", () => {
  it("uses the saved publish status in the last-updated label", () => {
    render(<WorkflowBuilder title="Test workflow" stepLibrary={[]} initialNodes={[]} initialEdges={[]} publishStatusLabel="Published" lastUpdated={{ author: "Admin", minutesAgo: 0 }} />);
    expect(screen.getByText(/Last updated/)).toHaveTextContent("Published");
  });
});

it("shows old updates in days rather than thousands of minutes", () => {
  render(<WorkflowBuilder title="Old template" stepLibrary={[]} initialNodes={[]} initialEdges={[]} lastUpdated={{ author: "Admin", minutesAgo: 47217 }} />);
  expect(screen.getByText(/Last updated/)).toHaveTextContent("32d ago by Admin");
});
