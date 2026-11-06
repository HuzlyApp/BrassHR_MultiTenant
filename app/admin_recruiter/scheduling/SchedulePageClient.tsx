"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar, X } from "lucide-react";
import toast from "react-hot-toast";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import { SchedulingSubNav } from "@/app/admin_recruiter/scheduling/SchedulingSubNav";
import {
  addEasternDays,
  easternDateString,
  startOfEasternWeek,
} from "@/lib/datetime/eastern";
import {
  formatShiftRange,
  type EmployeeScheduleEmployee,
  type EmployeeScheduleShift,
  type EmployeeScheduleWeekResponse,
} from "@/lib/scheduling/employee-schedule";

type ShiftPillTheme = {
  bg: string;
  border: string;
  text: string;
};

const THEMES: ShiftPillTheme[] = [
  { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" }, // Blue
  { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" }, // Green
  { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" }, // Orange/Peach
  { bg: "#FFF1F2", border: "#FECDD3", text: "#BE123C" }, // Coral/Pink
  { bg: "#FAF5FF", border: "#E9D5FF", text: "#7E22CE" }, // Purple
  { bg: "#FEFCE8", border: "#FEF08A", text: "#A16207" }, // Amber
  { bg: "#F0FDFA", border: "#99F6E4", text: "#0F766E" }, // Teal
];

function getThemeForShift(index: number): ShiftPillTheme {
  return THEMES[index % THEMES.length];
}

type DepartmentOption = {
  id: string;
  name: string;
};

export default function SchedulePageClient() {
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeScheduleEmployee[]>([]);
  const [shifts, setShifts] = useState<EmployeeScheduleShift[]>([]);
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>("all");
  const [addShiftOpen, setAddShiftOpen] = useState(false);
  const [savingShift, setSavingShift] = useState(false);

  // New shift form state
  const [newShiftTitle, setNewShiftTitle] = useState("");
  const [newShiftFacilityId, setNewShiftFacilityId] = useState("");
  const [newShiftDepartmentId, setNewShiftDepartmentId] = useState("");
  const [newShiftWorkerId, setNewShiftWorkerId] = useState("");
  const [newShiftDate, setNewShiftDate] = useState("");
  const [newShiftStartTime, setNewShiftStartTime] = useState("08:00");
  const [newShiftEndTime, setNewShiftEndTime] = useState("17:00");
  const [newShiftRate, setNewShiftRate] = useState("");
  const [newShiftNotes, setNewShiftNotes] = useState("");

  // Calculate the 7 days of the current week (Monday through Sunday)
  const weekDays = useMemo(() => {
    const monday = startOfEasternWeek(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addEasternDays(monday, i));
  }, [anchorDate]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return "";
    const first = weekDays[0];
    const last = weekDays[6];
    const m1 = first.toLocaleDateString("en-US", { month: "short" });
    const m2 = last.toLocaleDateString("en-US", { month: "short" });
    const y = first.getFullYear();
    if (m1 === m2) {
      return `${m1} ${first.getDate()} - ${last.getDate()}, ${y}`;
    }
    return `${m1} ${first.getDate()} - ${m2} ${last.getDate()}, ${y}`;
  }, [weekDays]);

  const startDateStr = easternDateString(weekDays[0]);
  const endDateStr = easternDateString(weekDays[6]);

  // Load facilities for dropdown
  const loadFacilities = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/facilities");
      if (!res.ok) return;
      const data = await res.json();
      const list = (data?.facilities ?? data ?? []).map((f: { id: string; name: string }) => ({
        id: String(f.id),
        name: f.name || "Facility",
      }));
      setFacilities(list);
      if (list.length > 0 && !newShiftFacilityId) {
        setNewShiftFacilityId(list[0].id);
      }
    } catch (e) {
      console.error("[Schedule] error loading facilities", e);
    }
  }, [newShiftFacilityId]);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/departments");
      if (!res.ok) return;
      const data = await res.json();
      const list = (data?.departments ?? []).map((department: { id: string; name: string }) => ({
        id: String(department.id),
        name: department.name || "Department",
      }));
      setDepartments(list);
    } catch (e) {
      console.error("[Schedule] error loading departments", e);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: startDateStr, end: endDateStr });
      if (selectedFacility !== "all") params.set("facilityId", selectedFacility);
      const res = await fetch(`/api/admin/scheduling/week?${params.toString()}`);
      if (!res.ok) {
        setEmployees([]);
        setShifts([]);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as EmployeeScheduleWeekResponse;
      setEmployees(data.employees ?? []);
      setShifts(data.shifts ?? []);
    } catch {
      setEmployees([]);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [startDateStr, endDateStr, selectedFacility]);

  useEffect(() => {
    void loadFacilities();
    void loadDepartments();
  }, [loadFacilities, loadDepartments]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const visibleEmployees = useMemo(() => {
    if (selectedFacility === "all") return employees;
    const scheduled = new Set(shifts.map((shift) => shift.workerId));
    return employees.filter((employee) => scheduled.has(employee.id));
  }, [employees, shifts, selectedFacility]);

  const shiftGrid = useMemo(() => {
    const grid = new Map<string, EmployeeScheduleShift[]>();
    for (const shift of shifts) {
      const key = `${shift.workerId}_${shift.workDate.slice(0, 10)}`;
      const existing = grid.get(key) ?? [];
      existing.push(shift);
      grid.set(key, existing);
    }
    return grid;
  }, [shifts]);

  const handlePrevWeek = () => {
    setAnchorDate((prev) => addEasternDays(prev, -7));
  };

  const handleNextWeek = () => {
    setAnchorDate((prev) => addEasternDays(prev, 7));
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftTitle.trim()) {
      toast.error("Please enter a shift title / job role.");
      return;
    }
    if (!newShiftWorkerId) {
      toast.error("Select an employee for this shift.");
      return;
    }
    if (!newShiftDate) {
      toast.error("Please select a date for the shift.");
      return;
    }

    setSavingShift(true);
    try {
      const res = await fetch("/api/admin/scheduling/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newShiftTitle.trim(),
          facilityId: newShiftFacilityId || null,
          departmentId: newShiftDepartmentId || null,
          workerId: newShiftWorkerId,
          workDate: newShiftDate,
          startTime: newShiftStartTime,
          endTime: newShiftEndTime,
          ratePerHour: newShiftRate ? parseFloat(newShiftRate) : null,
          notes: newShiftNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create shift.");
      }

      toast.success("Shift created successfully!");
      setAddShiftOpen(false);
      setNewShiftTitle("");
      setNewShiftNotes("");
      setNewShiftRate("");
      await loadSchedule();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creating shift.");
    } finally {
      setSavingShift(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 md:px-8">
      {/* Sub navigation between Week View and Who is off */}
      <SchedulingSubNav />

      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Schedules</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            View and manage employee schedules across all facilities
          </p>
        </div>

        {/* Right side controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Facility filter */}
          <div className="relative">
            <select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              className="h-10 cursor-pointer appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3.5 pr-8 text-sm font-medium text-[#334155] shadow-sm outline-none transition hover:border-[#CBD5E1] focus:border-[color:var(--brand-primary,#BC8B41)]"
            >
              <option value="all">All Facilities</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Navigation */}
          <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 px-3 text-sm font-medium text-[#1E293B]">
              <Calendar className="h-4 w-4 text-[#94A3B8]" />
              <span>{weekRangeLabel}</span>
            </div>

            <button
              type="button"
              onClick={handleNextWeek}
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* + Add Shift Button */}
          <button
            type="button"
            onClick={() => {
              setNewShiftDate(startDateStr);
              setAddShiftOpen(true);
            }}
            className="flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[0.98]"
            style={{ backgroundColor: "var(--brand-primary, #BC8B41)" }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>Add Shift</span>
          </button>
        </div>
      </div>

      {/* Main Schedule Matrix */}
      <div className="w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="w-[200px] px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Employees
                </th>
                {weekDays.map((d, index) => {
                  const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <th
                      key={index}
                      className="min-w-[120px] px-3 py-3.5 text-center text-xs font-semibold text-[#64748B]"
                    >
                      <div className="font-medium text-[#1E293B]">{dayName}</div>
                      <div className="text-[11px] font-normal text-[#94A3B8]">{monthDay}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F1F5F9]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <DashboardPageLoader />
                  </td>
                </tr>
              ) : visibleEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-[#64748B]">
                    {employees.length === 0
                      ? "No employees to schedule yet. Employees appear here after a candidate is converted."
                      : "No shifts at this facility for this week."}
                  </td>
                </tr>
              ) : (
                visibleEmployees.map((emp, empIdx) => (
                  <tr key={emp.id} className="transition-colors hover:bg-[#F8FAFC]/60">
                    {/* Employee Info Col */}
                    <td className="w-[200px] px-4 py-4 align-top">
                      <div className="font-semibold text-sm text-[#0F172A]">{emp.name}</div>
                      <div className="text-xs text-[#64748B]">{emp.jobRole}</div>
                    </td>

                    {/* 7 Days Cols */}
                    {weekDays.map((day, dayIdx) => {
                      const dateKey = easternDateString(day);
                      const key = `${emp.id}_${dateKey}`;
                      const shiftsForDay = shiftGrid.get(key) || [];
                      const theme = getThemeForShift(empIdx);

                      return (
                        <td key={dayIdx} className="min-w-[120px] p-2 align-middle text-center">
                          {shiftsForDay.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {shiftsForDay.map((shift, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="rounded-lg p-2.5 text-left text-xs shadow-xs transition hover:brightness-98"
                                  style={{
                                    backgroundColor: theme.bg,
                                    border: `1px solid ${theme.border}`,
                                  }}
                                >
                                  <div
                                    className="font-bold leading-tight"
                                    style={{ color: theme.text }}
                                  >
                                    {formatShiftRange(shift.startTime, shift.endTime)}
                                  </div>
                                  <div className="mt-1 font-medium text-[#334155]">
                                    {shift.department || shift.title}
                                  </div>
                                  <div className="text-[11px] text-[#64748B]">
                                    {shift.facility}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex h-14 items-center justify-center text-xs font-medium text-[#94A3B8]">
                              OFF
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Shift Modal */}
      {addShiftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl transition-all">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Add Shift</h3>
                <p className="text-xs text-[#64748B]">Schedule a new shift for an employee</p>
              </div>
              <button
                type="button"
                onClick={() => setAddShiftOpen(false)}
                className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="space-y-4 px-6 py-5">
              {/* Shift Title / Role */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">
                  Shift Title / Role <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Warehouse Staff, Morning Shift"
                  value={newShiftTitle}
                  onChange={(e) => setNewShiftTitle(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)] focus:ring-1 focus:ring-[color:var(--brand-primary,#BC8B41)]"
                />
              </div>

              {/* Facility & Worker */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">Facility</label>
                  <select
                    value={newShiftFacilityId}
                    onChange={(e) => setNewShiftFacilityId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                  >
                    <option value="">Select Facility</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">
                    Employee <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newShiftWorkerId}
                    onChange={(e) => setNewShiftWorkerId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                  >
                    <option value="">Select Employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} ({employee.jobRole})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">Department</label>
                <select
                  value={newShiftDepartmentId}
                  onChange={(e) => setNewShiftDepartmentId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                >
                  <option value="">No department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Shift Times */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newShiftDate}
                    onChange={(e) => setNewShiftDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">Start Time</label>
                  <input
                    type="time"
                    value={newShiftStartTime}
                    onChange={(e) => setNewShiftStartTime(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">End Time</label>
                  <input
                    type="time"
                    value={newShiftEndTime}
                    onChange={(e) => setNewShiftEndTime(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                  />
                </div>
              </div>

              {/* Rate per hour */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">Rate per Hour ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 25.00"
                  value={newShiftRate}
                  onChange={(e) => setNewShiftRate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">Notes / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Optional shift notes"
                  value={newShiftNotes}
                  onChange={(e) => setNewShiftNotes(e.target.value)}
                  className="w-full rounded-lg border border-[#CBD5E1] p-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setAddShiftOpen(false)}
                  className="h-10 rounded-lg border border-[#CBD5E1] px-4 text-sm font-semibold text-[#475569] hover:bg-[#F1F5F9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingShift}
                  className="flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
                  style={{ backgroundColor: "var(--brand-primary, #BC8B41)" }}
                >
                  {savingShift ? "Saving..." : "Create Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
