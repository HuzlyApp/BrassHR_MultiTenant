"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  FolderOpen,
  ClipboardList,
  UserCheck,
  ArrowUpDown,
  Plus,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import type { ClientTableRow } from "@/app/api/admin/clients/route";

function statusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case "onboarded":
      return "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]";
    case "active":
      return "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]";
    case "hiring for them":
      return "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]";
    default:
      return "bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]";
  }
}

export default function ClientsPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientTableRow[]>([]);
  const [totalResults, setTotalResults] = useState(100);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);

  // Metrics
  const [metrics, setMetrics] = useState({
    activeClients: 122,
    facilitiesCount: 6,
    programsCount: 3,
    directHireCount: 2,
    openOrders: 36,
    unfilledThisWeek: 4,
    onAssignment: 22,
    directHireOpens: 122,
  });

  // Sorting
  const [sortField, setSortField] = useState<keyof ClientTableRow>("company_name");
  const [sortAsc, setSortAsc] = useState(true);

  // Add Client Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [newStreetAddress, setNewStreetAddress] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newStateCode, setNewStateCode] = useState("");
  const [newZipCode, setNewZipCode] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });

      const res = await fetch(`/api/admin/clients?${params.toString()}`);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.clients && data.clients.length > 0) {
          setClients(data.clients);
          setTotalResults(data.total ?? data.clients.length);
          setTotalPages(data.totalPages ?? 1);
          if (data.metrics) setMetrics(data.metrics);
          return;
        }
      }
    } catch {
      // Use fallback data
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSort = (field: keyof ClientTableRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [clients, sortField, sortAsc]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      toast.error("Company name is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: newCompanyName.trim(),
          address: newStreetAddress.trim() || null,
          city: newCity.trim() || null,
          state: newStateCode.trim() || null,
          zipCode: newZipCode.trim() || null,
          w2Capable: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create client.");
      }

      toast.success("Client registered successfully!");
      setAddModalOpen(false);
      setNewCompanyName("");
      setNewContactPerson("");
      setNewStreetAddress("");
      setNewCity("");
      setNewStateCode("");
      setNewZipCode("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creating client.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 md:px-8">
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Clients</h1>
          <p className="mt-1 text-sm text-[#64748B]">Manage Clients</p>
        </div>

        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[0.98]"
          style={{ backgroundColor: "var(--brand-primary, #BC8B41)" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          <span>Add Client</span>
        </button>
      </div>

      {/* 4 Metric / KPI Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Active clients */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F3E8FF] text-[#9333EA]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-[#64748B]">Active clients</div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">
              {metrics.activeClients}
            </div>
            <div className="mt-0.5 text-[11px] text-[#94A3B8]">
              {metrics.facilitiesCount} facilities • {metrics.programsCount} programs • {metrics.directHireCount} direct hire
            </div>
          </div>
        </div>

        {/* Card 2: Open orders */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#EF4444]">
            <FolderOpen className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-[#64748B]">Open orders</div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">
              {metrics.openOrders}
            </div>
            <div className="mt-0.5 text-[11px] text-[#94A3B8]">
              {metrics.unfilledThisWeek} unfilled this week
            </div>
          </div>
        </div>

        {/* Card 3: On assignment */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#0284C7]">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-[#64748B]">On assignment</div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">
              {metrics.onAssignment}
            </div>
            <div className="mt-0.5 text-[11px] text-[#94A3B8]">W2 + EOR</div>
          </div>
        </div>

        {/* Card 4: Direct-hire opens */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FEF9C3] text-[#CA8A04]">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-[#64748B]">Direct-hire opens</div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">
              {metrics.directHireOpens}
            </div>
            <div className="mt-0.5 text-[11px] text-[#94A3B8]">Client will employ them</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th
                  onClick={() => handleSort("company_name")}
                  className="cursor-pointer px-6 py-3.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Client</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("client_contact")}
                  className="cursor-pointer px-6 py-3.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Client Contact</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("open_orders")}
                  className="cursor-pointer px-6 py-3.5 text-center text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Open orders</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("on_assignment")}
                  className="cursor-pointer px-6 py-3.5 text-center text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>On assignment</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className="cursor-pointer px-6 py-3.5 text-right text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Status</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F1F5F9]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <DashboardPageLoader />
                  </td>
                </tr>
              ) : sortedClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-[#64748B]">
                    No clients registered yet.
                  </td>
                </tr>
              ) : (
                sortedClients.map((row, idx) => (
                  <tr key={row.id || idx} className="transition-colors hover:bg-[#F8FAFC]/70">
                    <td className="px-6 py-4 font-medium text-sm text-[#BC8B41] hover:underline cursor-pointer">
                      <Link href={`/admin_recruiter/facilities?client=${row.id}`}>
                        {row.company_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#334155]">{row.client_contact}</td>
                    <td className="px-6 py-4 text-center font-medium text-sm text-[#0F172A]">
                      {row.open_orders}
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-sm text-[#0F172A]">
                      {row.on_assignment}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold leading-none ${statusBadgeClass(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col gap-4 border-t border-[#E2E8F0] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[#64748B]">
            Showing <span className="font-semibold text-[#0F172A]">{sortedClients.length}</span> of{" "}
            <span className="font-semibold text-[#0F172A]">{totalResults}</span> results
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-md border border-[#E2E8F0] bg-white px-2 text-xs font-medium text-[#0F172A] outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-md border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#475569] transition hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={() => setPage(1)}
                className="h-7 w-7 rounded-md text-xs font-semibold text-white transition shadow-xs"
                style={{
                  backgroundColor: page === 1 ? "var(--brand-secondary, #012352)" : "#FFFFFF",
                  color: page === 1 ? "#FFFFFF" : "#475569",
                  border: page === 1 ? "none" : "1px solid #E2E8F0",
                }}
              >
                1
              </button>

              {totalPages > 1 && (
                <button
                  type="button"
                  onClick={() => setPage(2)}
                  className="h-7 w-7 rounded-md text-xs font-semibold transition"
                  style={{
                    backgroundColor: page === 2 ? "var(--brand-secondary, #012352)" : "#FFFFFF",
                    color: page === 2 ? "#FFFFFF" : "#475569",
                    border: page === 2 ? "none" : "1px solid #E2E8F0",
                  }}
                >
                  2
                </button>
              )}

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-md border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#475569] transition hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Client Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl transition-all">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Add Client Organization</h3>
                <p className="text-xs text-[#64748B]">Register a new client company</p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SummitBridge Staffing"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">Client Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Michael Anderson"
                  value={newContactPerson}
                  onChange={(e) => setNewContactPerson(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">Street Address</label>
                <input
                  type="text"
                  placeholder="123 Corporate Way"
                  value={newStreetAddress}
                  onChange={(e) => setNewStreetAddress(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">City</label>
                  <input
                    type="text"
                    placeholder="New York"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">State</label>
                  <input
                    type="text"
                    placeholder="NY"
                    value={newStateCode}
                    onChange={(e) => setNewStateCode(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">Zip Code</label>
                  <input
                    type="text"
                    placeholder="10001"
                    value={newZipCode}
                    onChange={(e) => setNewZipCode(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="h-10 rounded-lg border border-[#CBD5E1] px-4 text-sm font-semibold text-[#475569] hover:bg-[#F1F5F9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
                  style={{ backgroundColor: "var(--brand-primary, #BC8B41)" }}
                >
                  {saving ? "Saving..." : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
