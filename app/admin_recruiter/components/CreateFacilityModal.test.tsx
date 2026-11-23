// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CreateFacilityModal from "./CreateFacilityModal";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
const clientId = "69ac7187-6320-4ff8-8c17-46b68da46413";
vi.mock("@/lib/mapbox/use-address-autocomplete", () => ({ useAddressAutocomplete: () => ({ suggestions: [] }) }));
vi.mock("@/app/components/signup/AddressAutocompleteField", () => ({ default: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} /> }));
vi.mock("@/app/tenant-onboarding/SearchableSelectField", () => ({ default: ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) => <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="" />{options.map((option) => <option key={option}>{option}</option>)}</select> }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { from: (table: string) => {
 const query = { select: () => query, eq: () => query, order: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "signup_us_states" ? [{ code: "NC", name: "North Carolina" }] : [{ city_name: "Raleigh" }], error: null }).then(resolve) }; return query;
} } }));
beforeEach(() => { mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ clients: [{ id: clientId, name: "Client One" }], facility: { id: "facility" }, assigned: false }) }); vi.stubGlobal("fetch", mocks.fetch); });
async function fill(zip: string) {
  fireEvent.change(screen.getByLabelText(/Facility Name/), { target: { value: "Facility" } });
  fireEvent.change(screen.getByLabelText("Primary Address / Street Address"), { target: { value: "123 Main Street" } });
  await screen.findByRole("option", { name: "North Carolina" });
  fireEvent.change(screen.getByLabelText("State"), { target: { value: "North Carolina" } });
  await screen.findByRole("option", { name: "Raleigh" });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Raleigh" } });
  fireEvent.change(screen.getByLabelText(/ZIP/), { target: { value: zip } });
}
describe("facility client and ZIP", () => {
  it("requires choosing a tenant client", async () => {
    render(<CreateFacilityModal open onClose={vi.fn()} onSuccess={vi.fn()} />);
    await screen.findByRole("option", { name: "Client One" });
    fireEvent.click(screen.getByRole("button", { name: "Create Facility" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a client organization.");
  });
  it("rejects a short ZIP and sends the selected client for a valid address", async () => {
    render(<CreateFacilityModal open initialClientId={clientId} onClose={vi.fn()} onSuccess={vi.fn()} />);
    await screen.findByRole("option", { name: "Client One" });
    await fill("12");
    fireEvent.click(screen.getByRole("button", { name: "Create Facility" }));
    expect(screen.getByText("Enter a valid 5-digit ZIP code or ZIP+4.")).toBeInTheDocument();
    expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/ZIP/), { target: { value: "27601-1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Facility" }));
    await waitFor(() => expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1));
    const payload = JSON.parse(mocks.fetch.mock.calls.find(([, options]) => options?.method === "POST")![1].body as string);
    expect(payload.clientId).toBe(clientId);
  });
});
