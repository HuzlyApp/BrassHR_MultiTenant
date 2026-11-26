"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plane,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import {
  SchedulingSubNav,
  type ScheduleViewMode,
} from "@/app/admin_recruiter/scheduling/SchedulingSubNav";
import type { OffRecord } from "@/app/api/admin/scheduling/who-is-off/route";
import SettingsSelect from "@/app/admin_recruiter/settings/SettingsSelect";
import { adminWorkerProfileHref } from "@/app/admin_recruiter/workers/worker-profile-links";
import {
  addEasternDays,
  easternDateString,
  easternWallClockToDate,
  startOfEasternDay,
  startOfEasternWeek,
} from "@/lib/datetime/eastern";
import {
  formatEmployeeShiftOverlapMessage,
  formatShiftRange,
  shiftsOverlap,
  shiftIntervalMinutes,
  parseEmployeeScheduleShiftInput,
  calendarViewRange,
  matchesScheduleEmployeeFilters,
  type CalendarRangeView,
  type ScheduleEmployeeFilters,
  type EmployeeScheduleEmployee,
  type EmployeeScheduleShift,
  type EmployeeScheduleWeekResponse,
} from "@/lib/scheduling/employee-schedule";

const MAX_RANGE_DAYS = 31;

type RangePreset = "this_week" | "next_7" | "next_14" | "next_30" | "custom";

function employeeJobHref(employee: EmployeeScheduleEmployee): string {
  if (employee.jobId) {
    return `/admin_recruiter/jobs/${encodeURIComponent(employee.jobId)}`;
  }
  return `/admin_recruiter/jobs?q=${encodeURIComponent(employee.jobRole)}`;
}

function parseEasternDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [year, month, day] = trimmed.split("-").map(Number);
  if (!year || !month || !day) return null;
  return easternWallClockToDate(year, month, day);
}

function inclusiveDayCount(start: Date, end: Date): number {
  let count = 0;
  let cursor = startOfEasternDay(start);
  const last = startOfEasternDay(end);
  while (cursor.getTime() <= last.getTime() && count <= MAX_RANGE_DAYS + 1) {
    count += 1;
    cursor = addEasternDays(cursor, 1);
  }
  return count;
}

function buildDayRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfEasternDay(start);
  const last = startOfEasternDay(end);
  while (cursor.getTime() <= last.getTime() && days.length < MAX_RANGE_DAYS) {
    days.push(cursor);
    cursor = addEasternDays(cursor, 1);
  }
  return days;
}

function formatRangeLabel(start: Date, end: Date): string {
  const m1 = start.toLocaleDateString("en-US", { month: "short" });
  const m2 = end.toLocaleDateString("en-US", { month: "short" });
  const y1 = start.getFullYear();
  const y2 = end.getFullYear();
  if (y1 === y2 && m1 === m2) {
    return `${m1} ${start.getDate()} - ${end.getDate()}, ${y1}`;
  }
  if (y1 === y2) {
    return `${m1} ${start.getDate()} - ${m2} ${end.getDate()}, ${y1}`;
  }
  return `${m1} ${start.getDate()}, ${y1} - ${m2} ${end.getDate()}, ${y2}`;
}

function defaultWeekRange(from = new Date()): { start: Date; end: Date } {
  const start = startOfEasternWeek(from);
  return { start, end: addEasternDays(start, 6) };
}

const controlClassName =
  "h-[30px] rounded-[8px] border border-[#CBD5E1] bg-white text-[10px] leading-[15px] text-[#0F172A] outline-none transition hover:border-[#94A3B8] focus-visible:border-[color:var(--brand-primary,#012352)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary,#012352)_16%,transparent)]";

const modalFieldClassName =
  "h-10 w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#012352)] focus:ring-1 focus:ring-[color:var(--brand-primary,#012352)]";

const modalPickerFieldClassName = `${modalFieldClassName} cursor-pointer`;

const modalTextFieldClassName = `${modalFieldClassName} cursor-text`;

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

function toTimeInputValue(value: string): string {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 5);
  return trimmed;
}

function formatShiftDateLabel(value: string): string {
  const date = parseEasternDateInput(value.slice(0, 10));
  if (!date) return value.slice(0, 10);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPayRate(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `$${rate.toFixed(rate % 1 === 0 ? 0 : 2)}/hr`;
}

function formatListDayLabel(day: Date): string {
  const dayNum = day.getDate();
  const month = day.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const weekday = day.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  return `${dayNum} ${month}, ${weekday}`;
}

type ListEntryKind = "shift" | "pto";

type ListDayEntry = {
  id: string;
  kind: ListEntryKind;
  title: string;
  detail: string;
  bg: string;
  text: string;
  shift?: EmployeeScheduleShift;
};

const LIST_SHIFT_THEMES = [
  { bg: "#EFF6FF", text: "#1D4ED8" },
  { bg: "#F5F3FF", text: "#6D28D9" },
  { bg: "#F0F9FF", text: "#0284C7" },
  { bg: "#EEF2FF", text: "#4338CA" },
  { bg: "#F0FDF4", text: "#15803D" },
] as const;

const PTO_THEME = { bg: "#FFFBEB", text: "#D97706" };

type DepartmentOption = {
  id: string;
  name: string;
};

export default function SchedulePageClient() {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin_recruiter/calendar/shifts";
  const searchParams = useSearchParams();
  const urlView: ScheduleViewMode = searchParams.get("view") === "list" ? "list" : "calendar";
  const [scheduleView, setScheduleView] = useState<ScheduleViewMode>(urlView);
  const initialRange = useMemo(() => defaultWeekRange(), []);
  const [rangeStart, setRangeStart] = useState<Date>(() => initialRange.start);
  const [rangeEnd, setRangeEnd] = useState<Date>(() => initialRange.end);
  const [rangePreset, setRangePreset] = useState<RangePreset>("this_week");
  const [calendarRangeView, setCalendarRangeView] = useState<CalendarRangeView>("week");
  const [employeeFilters, setEmployeeFilters] = useState<ScheduleEmployeeFilters>({ worker: "all", client: "all", position: "all", location: "all", status: "all" });
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(() => easternDateString(initialRange.start));
  const [draftEnd, setDraftEnd] = useState(() => easternDateString(initialRange.end));
  const [rangeMenuStyle, setRangeMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const [rangeBrandPrimary, setRangeBrandPrimary] = useState("#BC8B41");
  const rangeTriggerRef = useRef<HTMLButtonElement>(null);
  const rangeMenuRef = useRef<HTMLDivElement>(null);
  const rangeListId = useId();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeScheduleEmployee[]>([]);
  const [shifts, setShifts] = useState<EmployeeScheduleShift[]>([]);
  const [offRecords, setOffRecords] = useState<OffRecord[]>([]);
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>("all");
  const [addShiftOpen, setAddShiftOpen] = useState(false);
  const [savingShift, setSavingShift] = useState(false);
  const [createShiftError, setCreateShiftError] = useState<string | null>(null);
  const [deletingShift, setDeletingShift] = useState(false);
  const [selectedShift, setSelectedShift] = useState<EmployeeScheduleShift | null>(null);
  const [shiftModalMode, setShiftModalMode] = useState<"view" | "edit">("view");
  const [savingEditShift, setSavingEditShift] = useState(false);

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

  // Edit shift form state
  const [editShiftTitle, setEditShiftTitle] = useState("");
  const [editShiftFacilityId, setEditShiftFacilityId] = useState("");
  const [editShiftDepartmentId, setEditShiftDepartmentId] = useState("");
  const [editShiftWorkerId, setEditShiftWorkerId] = useState("");
  const [editShiftDate, setEditShiftDate] = useState("");
  const [editShiftStartTime, setEditShiftStartTime] = useState("08:00");
  const [editShiftEndTime, setEditShiftEndTime] = useState("17:00");
  const [editShiftRate, setEditShiftRate] = useState("");
  const [editShiftNotes, setEditShiftNotes] = useState("");

  const rangeDays = useMemo(
    () => buildDayRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );

  const rangeLabel = useMemo(
    () => formatRangeLabel(rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );

  const rangeLength = rangeDays.length || 1;
  const startDateStr = easternDateString(rangeStart);
  const endDateStr = easternDateString(rangeEnd);

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
      const offParams = new URLSearchParams({
        start: startDateStr,
        end: endDateStr,
        page: "1",
        limit: "200",
      });
      if (selectedFacility !== "all") offParams.set("facility", selectedFacility);

      const [weekRes, offRes] = await Promise.all([
        fetch(`/api/admin/scheduling/week?${params.toString()}`),
        fetch(`/api/admin/scheduling/who-is-off?${offParams.toString()}`),
      ]);

      if (!weekRes.ok) {
        setEmployees([]);
        setShifts([]);
      } else {
        const data = (await weekRes.json().catch(() => ({}))) as EmployeeScheduleWeekResponse;
        setEmployees(
          (data.employees ?? []).map((employee) => ({
            ...employee,
            jobId: employee.jobId ?? null,
          }))
        );
        setShifts(data.shifts ?? []);
      }

      if (!offRes.ok) {
        setOffRecords([]);
      } else {
        const offData = (await offRes.json().catch(() => ({}))) as { records?: OffRecord[] };
        setOffRecords(Array.isArray(offData.records) ? offData.records : []);
      }
    } catch {
      setEmployees([]);
      setShifts([]);
      setOffRecords([]);
    } finally {
      setLoading(false);
    }
  }, [startDateStr, endDateStr, selectedFacility]);

  useEffect(() => {
    setScheduleView(urlView);
  }, [urlView]);

  const handleScheduleViewChange = useCallback(
    (view: ScheduleViewMode) => {
      setScheduleView(view);
      const params = new URLSearchParams(searchParams.toString());
      if (view === "list") params.set("view", "list");
      else params.delete("view");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    void loadFacilities();
    void loadDepartments();
  }, [loadFacilities, loadDepartments]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const updateRangeMenuPosition = useCallback(() => {
    const trigger = rangeTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 260;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const primary =
      getComputedStyle(trigger).getPropertyValue("--brand-primary").trim() ||
      getComputedStyle(document.documentElement).getPropertyValue("--brand-primary").trim() ||
      "#BC8B41";
    setRangeBrandPrimary(primary);
    setRangeMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left,
      width,
      visibility: "visible",
      pointerEvents: "auto",
      zIndex: 300,
      ["--brand-primary" as string]: primary,
    });
  }, []);

  useLayoutEffect(() => {
    if (!rangeMenuOpen) return;
    updateRangeMenuPosition();
  }, [rangeMenuOpen, updateRangeMenuPosition]);

  useEffect(() => {
    if (!rangeMenuOpen) return;
    window.addEventListener("resize", updateRangeMenuPosition);
    window.addEventListener("scroll", updateRangeMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateRangeMenuPosition);
      window.removeEventListener("scroll", updateRangeMenuPosition, true);
    };
  }, [rangeMenuOpen, updateRangeMenuPosition]);

  useEffect(() => {
    if (!rangeMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rangeTriggerRef.current?.contains(target)) return;
      if (rangeMenuRef.current?.contains(target)) return;
      setRangeMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRangeMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [rangeMenuOpen]);

  const filteredEmployees = useMemo(() => employees.filter((employee) => matchesScheduleEmployeeFilters(employee, employeeFilters)), [employees, employeeFilters]);
  const openOnly = searchParams.get("open") === "1";
  const filteredShifts = useMemo(() => {
    const ids = new Set(filteredEmployees.map((employee) => employee.id));
    const hasEmployeeFilters = Object.values(employeeFilters).some((value) => value !== "all");
    return shifts.filter((shift) => shift.workerId ? !openOnly && ids.has(shift.workerId) : !hasEmployeeFilters);
  }, [filteredEmployees, shifts, employeeFilters, openOnly]);
  const visibleEmployees = useMemo(() => {
    const scheduledIds = new Set(filteredShifts.map((shift) => shift.workerId));
    const rows = filteredEmployees.filter((employee) => scheduledIds.has(employee.id));
    if (scheduledIds.has("")) rows.unshift({ id: "", name: "Open shifts", jobRole: "Unassigned", jobId: null });
    return rows;
  }, [filteredEmployees, filteredShifts]);

  const scheduledHours = useMemo(() => filteredShifts.reduce((minutes, shift) => {
    const interval = shiftIntervalMinutes({ ...shift, workDate: shift.workDate.slice(0, 10) });
    return minutes + (interval ? interval.end - interval.start : 0);
  }, 0) / 60, [filteredShifts]);

  const shiftGrid = useMemo(() => {
    const grid = new Map<string, EmployeeScheduleShift[]>();
    for (const shift of filteredShifts) {
      const key = `${shift.workerId}_${shift.workDate.slice(0, 10)}`;
      const existing = grid.get(key) ?? [];
      existing.push(shift);
      grid.set(key, existing);
    }
    return grid;
  }, [filteredShifts]);

  const listDays = useMemo(() => {
    const employeeNameById = new Map(employees.map((employee) => [employee.id, employee.name]));
    const filteredWorkerIds = new Set(filteredEmployees.flatMap((employee) => [employee.id, employee.profileId]));
    const hasFilters = Object.values(employeeFilters).some((value) => value !== "all");
    return rangeDays.map((day, dayIndex) => {
      const dateKey = easternDateString(day);
      const entries: ListDayEntry[] = [];

      const dayShifts = filteredShifts
        .filter((shift) => shift.workDate.slice(0, 10) === dateKey)
        .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));

      for (const [shiftIndex, shift] of dayShifts.entries()) {
        const theme = LIST_SHIFT_THEMES[(dayIndex + shiftIndex) % LIST_SHIFT_THEMES.length];
        const workerName = employeeNameById.get(shift.workerId);
        entries.push({
          id: `shift-${shift.id}`,
          kind: "shift",
          title: formatShiftRange(shift.startTime, shift.endTime),
          detail: workerName
            ? `${workerName} · ${shift.department || shift.title || "Working hours"}`
            : `Unassigned · ${shift.department || shift.title || "Working hours"}`,
          bg: theme.bg,
          text: theme.text,
          shift,
        });
      }

      for (const record of openOnly ? [] : offRecords) {
        if (hasFilters && !filteredWorkerIds.has(record.workerId)) continue;
        if (dateKey < record.startDate.slice(0, 10) || dateKey > record.endDate.slice(0, 10)) {
          continue;
        }
        entries.push({
          id: `pto-${record.id}-${dateKey}`,
          kind: "pto",
          title: record.offType || "PTO",
          detail: record.name || "Time off",
          bg: PTO_THEME.bg,
          text: PTO_THEME.text,
        });
      }

      return { day, dateKey, label: formatListDayLabel(day), entries };
    });
  }, [rangeDays, filteredShifts, offRecords, employees, filteredEmployees, employeeFilters, openOnly]);

  const applyRange = useCallback((start: Date, end: Date, preset: RangePreset) => {
    const normalizedStart = startOfEasternDay(start);
    const normalizedEnd = startOfEasternDay(end);
    if (normalizedStart.getTime() > normalizedEnd.getTime()) {
      toast.error("Start date must be on or before end date.");
      return false;
    }
    const days = inclusiveDayCount(normalizedStart, normalizedEnd);
    if (days > MAX_RANGE_DAYS) {
      toast.error(`Date range can be at most ${MAX_RANGE_DAYS} days.`);
      return false;
    }
    setRangeStart(normalizedStart);
    setRangeEnd(normalizedEnd);
    setRangePreset(preset);
    setCalendarRangeView(preset === "this_week" ? "week" : "custom");
    setDraftStart(easternDateString(normalizedStart));
    setDraftEnd(easternDateString(normalizedEnd));
    setRangeMenuOpen(false);
    return true;
  }, []);

  const applyCalendarView = (view: Exclude<CalendarRangeView, "custom">, anchor = rangeStart) => {
    const range = calendarViewRange(view, anchor);
    applyRange(range.start, range.end, view === "week" ? "this_week" : "custom");
    setCalendarRangeView(view);
  };

  const applyPreset = useCallback(
    (preset: RangePreset) => {
      const today = startOfEasternDay(new Date());
      if (preset === "this_week") {
        const week = defaultWeekRange(today);
        applyRange(week.start, week.end, "this_week");
        return;
      }
      if (preset === "next_7") {
        applyRange(today, addEasternDays(today, 6), "next_7");
        return;
      }
      if (preset === "next_14") {
        applyRange(today, addEasternDays(today, 13), "next_14");
        return;
      }
      if (preset === "next_30") {
        applyRange(today, addEasternDays(today, 29), "next_30");
      }
    },
    [applyRange]
  );

  const applyCustomRange = () => {
    const start = parseEasternDateInput(draftStart);
    const end = parseEasternDateInput(draftEnd);
    if (!start || !end) {
      toast.error("Enter a valid start and end date.");
      return;
    }
    applyRange(start, end, "custom");
  };

  const handlePrevRange = () => {
    if (calendarRangeView === "month") { applyCalendarView("month", addEasternDays(rangeStart, -1)); return; }
    const nextStart = addEasternDays(rangeStart, -rangeLength);
    const nextEnd = addEasternDays(rangeEnd, -rangeLength);
    setRangeStart(nextStart);
    setRangeEnd(nextEnd);
    setRangePreset("custom");
    setDraftStart(easternDateString(nextStart));
    setDraftEnd(easternDateString(nextEnd));
  };

  const handleNextRange = () => {
    if (calendarRangeView === "month") { applyCalendarView("month", addEasternDays(rangeEnd, 1)); return; }
    const nextStart = addEasternDays(rangeStart, rangeLength);
    const nextEnd = addEasternDays(rangeEnd, rangeLength);
    setRangeStart(nextStart);
    setRangeEnd(nextEnd);
    setRangePreset("custom");
    setDraftStart(easternDateString(nextStart));
    setDraftEnd(easternDateString(nextEnd));
  };

  const handleExport = () => {
    if (filteredShifts.length === 0) {
      toast.error("No shifts to export for this date range.");
      return;
    }
    const header = [
      "Employee",
      "Job Role",
      "Date",
      "Start",
      "End",
      "Title",
      "Department",
      "Facility",
      "Rate",
      "Notes",
    ];
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const rows = filteredShifts.map((shift) => {
      const employee = employeeById.get(shift.workerId);
      return [
        employee?.name ?? "",
        employee?.jobRole ?? "",
        shift.workDate.slice(0, 10),
        shift.startTime,
        shift.endTime,
        shift.title,
        shift.department ?? "",
        shift.facility,
        shift.ratePerHour == null ? "" : String(shift.ratePerHour),
        shift.notes ?? "",
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `schedules-${startDateStr}-to-${endDateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Schedule exported.");
  };

  const findLoadedOverlap = (
    workerId: string,
    workDate: string,
    startTime: string,
    endTime: string,
    excludeShiftId?: string | null
  ) => {
    if (!workerId) return undefined;
    const excludeId = excludeShiftId?.trim() || "";
    return shifts.find((shift) => {
      if (shift.workerId !== workerId) return false;
      if (excludeId && shift.id === excludeId) return false;
      return shiftsOverlap(
        { workDate, startTime, endTime },
        {
          workDate: shift.workDate.slice(0, 10),
          startTime: shift.startTime,
          endTime: shift.endTime,
        }
      );
    });
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      title: newShiftTitle.trim(), facilityId: newShiftFacilityId || null,
      departmentId: newShiftDepartmentId || null, workerId: newShiftWorkerId,
      workDate: newShiftDate, startTime: newShiftStartTime, endTime: newShiftEndTime,
      ratePerHour: newShiftRate ? Number(newShiftRate) : null, notes: newShiftNotes.trim() || null,
    };
    const validation = parseEmployeeScheduleShiftInput(input);
    if (!validation.ok) { setCreateShiftError(validation.error); return; }
    setCreateShiftError(null);
    const isPastDate = newShiftDate < easternDateString(new Date());
    if (isPastDate && !window.confirm("This shift date is in the past. Create it anyway?")) return;
    if (newShiftEndTime < newShiftStartTime && !window.confirm("This overnight shift ends on the following day. Create it anyway?")) return;

    const localConflict = findLoadedOverlap(
      newShiftWorkerId,
      newShiftDate,
      newShiftStartTime,
      newShiftEndTime
    );
    if (localConflict) {
      toast.error(
        formatEmployeeShiftOverlapMessage({
          title: localConflict.title,
          workDate: localConflict.workDate.slice(0, 10),
          startTime: localConflict.startTime,
          endTime: localConflict.endTime,
        })
      );
      return;
    }

    setSavingShift(true);
    try {
      const res = await fetch("/api/admin/scheduling/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, confirmPastDate: isPastDate }),
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
      setCreateShiftError(err instanceof Error ? err.message : "Error creating shift.");
    } finally {
      setSavingShift(false);
    }
  };

  const openShiftModal = (shift: EmployeeScheduleShift, mode: "view" | "edit" = "view") => {
    setSelectedShift(shift);
    setShiftModalMode(mode);
    setEditShiftTitle(shift.title);
    setEditShiftFacilityId(shift.facilityId ?? "");
    setEditShiftDepartmentId(shift.departmentId ?? "");
    setEditShiftWorkerId(shift.workerId);
    setEditShiftDate(shift.workDate.slice(0, 10));
    setEditShiftStartTime(toTimeInputValue(shift.startTime));
    setEditShiftEndTime(toTimeInputValue(shift.endTime));
    setEditShiftRate(shift.ratePerHour == null ? "" : String(shift.ratePerHour));
    setEditShiftNotes(shift.notes ?? "");
  };

  const closeShiftModal = () => {
    setSelectedShift(null);
    setShiftModalMode("view");
    setSavingEditShift(false);
  };

  const handleDeleteShift = async () => {
    if (!selectedShift || deletingShift || !window.confirm(`Delete shift "${selectedShift.title}"? This cannot be undone.`)) return;
    setDeletingShift(true);
    try {
      const response = await fetch("/api/admin/scheduling/week", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedShift.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Failed to delete shift.");
      closeShiftModal();
      await loadSchedule();
      toast.success("Shift deleted.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to delete shift."); }
    finally { setDeletingShift(false); }
  };

  const selectedShiftEmployee = useMemo(() => {
    if (!selectedShift) return null;
    return employees.find((employee) => employee.id === selectedShift.workerId) ?? null;
  }, [employees, selectedShift]);

  const handleUpdateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift) return;
    if (!editShiftTitle.trim()) {
      toast.error("Please enter a shift title / job role.");
      return;
    }
    if (!editShiftWorkerId) {
      toast.error("Select an employee for this shift.");
      return;
    }
    if (!editShiftDate) {
      toast.error("Please select a date for the shift.");
      return;
    }

    const localConflict = findLoadedOverlap(
      editShiftWorkerId,
      editShiftDate,
      editShiftStartTime,
      editShiftEndTime,
      selectedShift.id
    );
    if (localConflict) {
      toast.error(
        formatEmployeeShiftOverlapMessage({
          title: localConflict.title,
          workDate: localConflict.workDate.slice(0, 10),
          startTime: localConflict.startTime,
          endTime: localConflict.endTime,
        })
      );
      return;
    }

    setSavingEditShift(true);
    try {
      const res = await fetch("/api/admin/scheduling/week", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedShift.id,
          title: editShiftTitle.trim(),
          facilityId: editShiftFacilityId || null,
          departmentId: editShiftDepartmentId || null,
          workerId: editShiftWorkerId,
          workDate: editShiftDate,
          startTime: editShiftStartTime,
          endTime: editShiftEndTime,
          ratePerHour: editShiftRate ? parseFloat(editShiftRate) : null,
          notes: editShiftNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update shift.");
      }

      const payload = (await res.json().catch(() => ({}))) as { shift?: EmployeeScheduleShift };
      toast.success("Shift updated successfully!");
      if (payload.shift) {
        openShiftModal(payload.shift, "view");
      } else {
        setShiftModalMode("view");
      }
      await loadSchedule();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating shift.");
    } finally {
      setSavingEditShift(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 md:px-8">
      <label className="mb-3 flex items-center gap-2 text-xs text-[#334155]">
        <input type="checkbox" checked={openOnly} onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.checked) params.set("open", "1"); else params.delete("open");
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }} />
        Open shifts only
      </label>
      <p role="status" className="mb-2 text-xs text-[#64748B]">{filteredShifts.length} shifts in this range · {filteredEmployees.length} employees · {scheduledHours.toLocaleString("en-US", { maximumFractionDigits: 2 })} scheduled hours</p>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-8 tracking-tight text-[#0F172A]">
            Schedules
          </h1>
          <p className="mt-1 text-xs leading-4 text-[#6B7280]">
            View and manage employee schedules across all facilities
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setNewShiftDate(startDateStr);
              setNewShiftWorkerId("");
              setCreateShiftError(null);
              setAddShiftOpen(true);
            }}
            className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[color:var(--brand-secondary,#012352)] px-3 text-xs font-semibold text-white transition hover:brightness-95"
          >
            Post a Shift
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[color:var(--brand-secondary,#012352)] bg-white px-3 text-xs font-semibold text-[color:var(--brand-secondary,#012352)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-secondary,#012352)_6%,white)]"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Export
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-3.5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <SchedulingSubNav
            activeView={scheduleView}
            onViewChange={handleScheduleViewChange}
          />

          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:gap-2.5 md:justify-end">
            <select aria-label="Calendar range view" value={calendarRangeView} onChange={(event) => {
              if (event.target.value !== "custom") applyCalendarView(event.target.value as "day" | "week" | "month");
            }} className="h-[30px] min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-2 text-xs sm:flex-none">
              <option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="custom" disabled>Custom range</option>
            </select>
            <button type="button" onClick={() => applyCalendarView(calendarRangeView === "custom" ? "week" : calendarRangeView, new Date())} className="h-[30px] rounded-lg border border-[#CBD5E1] px-3 text-xs font-semibold">Today</button>
            {([
              { key: "worker", label: "Worker", options: employees.map((employee) => ({ value: employee.id, label: employee.name })) },
              { key: "client", label: "Client", options: Array.from(new Set(employees.map((employee) => employee.client).filter(Boolean))).map((value) => ({ value: value!, label: value! })) },
              { key: "position", label: "Position", options: Array.from(new Set(employees.map((employee) => employee.jobRole).filter(Boolean))).map((value) => ({ value, label: value })) },
              { key: "location", label: "Location", options: Array.from(new Set(employees.map((employee) => employee.location).filter(Boolean))).map((value) => ({ value: value!, label: value! })) },
              { key: "status", label: "Status", options: Array.from(new Set(employees.map((employee) => employee.status).filter(Boolean))).map((value) => ({ value: value!, label: value! })) },
            ] as const).map((filter) => <select key={filter.key} aria-label={`Filter by ${filter.label.toLowerCase()}`} value={employeeFilters[filter.key]} onChange={(event) => setEmployeeFilters((current) => ({ ...current, [filter.key]: event.target.value }))} className="h-[30px] w-full max-w-none rounded-lg border border-[#CBD5E1] bg-white px-2 text-xs sm:w-auto sm:max-w-[180px]">
              <option value="all">All {filter.label === "Status" ? "statuses" : `${filter.label.toLowerCase()}s`}</option>
              {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>)}
            <SettingsSelect
              aria-label="Filter by facility"
              value={selectedFacility}
              onChange={setSelectedFacility}
              className="w-full sm:w-[140px] md:w-[160px]"
              size="sm"
              triggerClassName="h-[30px] rounded-[8px] border-[#CBD5E1] px-2.5 text-[10px] leading-[15px] cursor-pointer"
              options={[
                { value: "all", label: "All Facilities" },
                ...facilities.map((f) => ({
                  value: f.id,
                  label: f.name,
                })),
              ]}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevRange}
                className="inline-flex h-[30px] w-8 cursor-pointer items-center justify-center rounded-[8px] border border-[#CBD5E1] bg-white text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                aria-label="Previous date range"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>

              <div className="relative">
                <button
                  ref={rangeTriggerRef}
                  type="button"
                  onClick={() => {
                    setDraftStart(startDateStr);
                    setDraftEnd(endDateStr);
                    setRangeMenuOpen((open) => !open);
                  }}
                  aria-label="Select date range"
                  aria-haspopup="dialog"
                  aria-expanded={rangeMenuOpen}
                  aria-controls={rangeListId}
                  className={`${controlClassName} inline-flex min-w-[160px] cursor-pointer items-center gap-2 px-2.5`}
                >
                  <Calendar className="h-3 w-3 shrink-0 text-[#94A3B8]" aria-hidden />
                  <span className="truncate font-normal text-[#0F172A]">{rangeLabel}</span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
                </button>

                {rangeMenuOpen && typeof document !== "undefined"
                  ? createPortal(
                      <div
                        ref={rangeMenuRef}
                        id={rangeListId}
                        role="dialog"
                        aria-label="Date range options"
                        style={rangeMenuStyle}
                        className="rounded-[8px] border border-[#CBD5E1] bg-white p-2 shadow-lg"
                      >
                        <div className="space-y-0.5">
                          {(
                            [
                              { id: "this_week", label: "This week (7 days)" },
                              { id: "next_7", label: "Next 7 days" },
                              { id: "next_14", label: "Next 14 days" },
                              { id: "next_30", label: "Next 30 days" },
                            ] as const
                          ).map((preset) => {
                            const active = rangePreset === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyPreset(preset.id)}
                                style={
                                  active
                                    ? {
                                        color: rangeBrandPrimary,
                                        borderColor: rangeBrandPrimary,
                                      }
                                    : undefined
                                }
                                className={`flex w-full cursor-pointer rounded-[6px] px-2.5 py-2 text-left text-[11px] transition ${
                                  active
                                    ? "border bg-white font-semibold"
                                    : "border border-transparent text-[#0F172A] hover:bg-[#F8FAFC]"
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-2 border-t border-[#F1F5F9] pt-2">
                          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                            Custom range
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="space-y-1">
                              <span className="block px-0.5 text-[10px] text-[#64748B]">Start</span>
                              <input
                                type="date"
                                value={draftStart}
                                onChange={(event) => {
                                  setDraftStart(event.target.value);
                                  setRangePreset("custom");
                                }}
                                className="h-[30px] w-full cursor-pointer rounded-[8px] border border-[#CBD5E1] px-2 text-[10px] text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="block px-0.5 text-[10px] text-[#64748B]">End</span>
                              <input
                                type="date"
                                value={draftEnd}
                                onChange={(event) => {
                                  setDraftEnd(event.target.value);
                                  setRangePreset("custom");
                                }}
                                className="h-[30px] w-full cursor-pointer rounded-[8px] border border-[#CBD5E1] px-2 text-[10px] text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                              />
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={applyCustomRange}
                            style={{ backgroundColor: rangeBrandPrimary }}
                            className="mt-2 inline-flex h-[30px] w-full cursor-pointer items-center justify-center rounded-[8px] text-[10px] font-semibold text-white transition hover:brightness-95"
                          >
                            Apply range
                          </button>
                          <p className="mt-1.5 px-0.5 text-[10px] text-[#94A3B8]">
                            Up to {MAX_RANGE_DAYS} days.
                          </p>
                        </div>
                      </div>,
                      document.body
                    )
                  : null}
              </div>

              <button
                type="button"
                onClick={handleNextRange}
                className="inline-flex h-[30px] w-8 cursor-pointer items-center justify-center rounded-[8px] border border-[#CBD5E1] bg-white text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                aria-label="Next date range"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {scheduleView === "list" ? (
          <div className="px-4 py-4 sm:px-5">
            {loading ? (
              <div className="py-12">
                <DashboardPageLoader />
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {listDays.map((dayRow) => (
                    <div
                      key={dayRow.dateKey}
                      className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4"
                    >
                      <div className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748B] sm:pt-2">
                        {dayRow.label}
                      </div>
                      <div className="min-w-0 space-y-2">
                        {dayRow.entries.length === 0 ? (
                          <div className="flex h-10 items-center text-[#CBD5E1]">
                            <span className="block h-px w-8 bg-[#CBD5E1]" aria-hidden />
                          </div>
                        ) : (
                          dayRow.entries.map((entry) => {
                            const content = (
                              <>
                                <span className="inline-flex min-w-0 items-center gap-2">
                                  {entry.kind === "pto" ? (
                                    <Plane className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  ) : (
                                    <span
                                      className="h-2 w-2 shrink-0 rounded-full"
                                      style={{ backgroundColor: entry.text }}
                                      aria-hidden
                                    />
                                  )}
                                  <span className="truncate font-semibold">{entry.title}</span>
                                </span>
                                <span className="truncate text-right font-medium opacity-90">
                                  {entry.detail}
                                </span>
                              </>
                            );

                            if (entry.kind === "shift" && entry.shift) {
                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  onClick={() => openShiftModal(entry.shift!, "view")}
                                  className="flex h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-[8px] px-3 text-left text-[11px] transition hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-secondary,#012352)]"
                                  style={{ backgroundColor: entry.bg, color: entry.text }}
                                >
                                  {content}
                                </button>
                              );
                            }

                            return (
                              <div
                                key={entry.id}
                                className="flex h-10 w-full items-center justify-between gap-3 rounded-[8px] px-3 text-[11px]"
                                style={{ backgroundColor: entry.bg, color: entry.text }}
                              >
                                {content}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[#F1F5F9] pt-4 text-[10px] text-[#64748B]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#1D4ED8]" aria-hidden />
                    <span className="h-2 w-2 rounded-full bg-[#6D28D9]" aria-hidden />
                    Work Shift
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#D97706]" aria-hidden />
                    PTO
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <p className="px-3 pt-2 text-[10px] text-[#94A3B8] md:hidden">
              Swipe sideways to see the full week calendar, or switch to List view.
            </p>
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="sticky left-0 z-10 w-[140px] bg-[#F8FAFC] px-3 py-3 text-left text-xs font-semibold text-[#64748B] sm:w-[180px]">
                    Employees
                  </th>
                  {rangeDays.map((d, index) => {
                    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                    const monthDay = d.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <th
                        key={`${easternDateString(d)}-${index}`}
                        className="min-w-[120px] px-2 py-3 text-center text-xs font-semibold text-[#64748B]"
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
                    <td colSpan={rangeDays.length + 1} className="py-12 text-center">
                      <DashboardPageLoader />
                    </td>
                  </tr>
                ) : visibleEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={rangeDays.length + 1}
                      className="py-12 text-center text-sm text-[#64748B]"
                    >
                      {employees.length === 0
                        ? "No employees to schedule yet. Employees appear here after a candidate is converted."
                        : "No scheduled shifts for this date range."}
                    </td>
                  </tr>
                ) : (
                  visibleEmployees.map((emp, empIdx) => {
                    const maxShiftsInRow = Math.max(
                      1,
                      ...rangeDays.map((day) => {
                        const key = `${emp.id}_${easternDateString(day)}`;
                        return shiftGrid.get(key)?.length ?? 0;
                      })
                    );
                    const rowMinHeight = maxShiftsInRow * 58 + Math.max(0, maxShiftsInRow - 1) * 6;

                    return (
                      <tr key={emp.id} className="transition-colors hover:bg-[#F8FAFC]/60">
                        <td
                          className="sticky left-0 z-10 w-[140px] bg-white px-3 py-2.5 align-middle sm:w-[180px]"
                          style={{ minHeight: rowMinHeight }}
                        >
                          {emp.id ? <Link
                            href={adminWorkerProfileHref(emp.profileId || emp.id)}
                            className="block text-sm font-semibold text-[#0F172A] transition-colors hover:text-[color:var(--brand-primary)] hover:underline"
                            title={emp.name}
                          >
                            {emp.name}
                          </Link> : <span className="block text-sm font-semibold text-[#0F172A]">{emp.name}</span>}
                          {emp.id ? <Link
                            href={employeeJobHref(emp)}
                            className="mt-0.5 block truncate text-xs text-[#64748B] hover:text-[color:var(--brand-primary,#012352)] hover:underline"
                            title={emp.jobRole}
                          >
                            {emp.jobRole}
                          </Link> : <span className="text-xs text-[#64748B]">Unassigned</span>}
                        </td>

                        {rangeDays.map((day, dayIdx) => {
                          const dateKey = easternDateString(day);
                          const key = `${emp.id}_${dateKey}`;
                          const shiftsForDay = shiftGrid.get(key) || [];
                          const theme = getThemeForShift(empIdx);

                          return (
                            <td
                              key={dayIdx}
                              className="min-w-[120px] p-1.5 align-middle text-center"
                              style={{ minHeight: rowMinHeight }}
                            >
                              {shiftsForDay.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                  {shiftsForDay.map((shift, sIdx) => (
                                    <button
                                      key={shift.id || sIdx}
                                      type="button"
                                      onClick={() => openShiftModal(shift, "view")}
                                      className="w-full min-h-[52px] cursor-pointer rounded-[6px] p-2 text-left text-[10px] leading-[15px] transition hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary,#012352)]"
                                      style={{
                                        backgroundColor: theme.bg,
                                        border: `1px solid ${theme.border}`,
                                      }}
                                      aria-label={`View shift ${formatShiftRange(shift.startTime, shift.endTime)}`}
                                    >
                                      <div
                                        className="font-semibold leading-tight"
                                        style={{ color: theme.text }}
                                      >
                                        {formatShiftRange(shift.startTime, shift.endTime)}
                                      </div>
                                      <div className="mt-0.5 font-medium text-[#334155]">
                                        {shift.department || shift.title}
                                      </div>
                                      <div className="text-[10px] text-[#64748B]">
                                        {shift.facility}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div
                                  className="flex items-center justify-center text-xs font-medium text-[#94A3B8]"
                                  style={{ minHeight: Math.max(52, rowMinHeight - 12) }}
                                >
                                  OFF
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedShift ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl transition-all">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  {shiftModalMode === "edit" ? "Edit Shift" : "View Shift"}
                </h3>
                <p className="text-xs text-[#64748B]">
                  {shiftModalMode === "edit"
                    ? "Update shift details and save changes"
                    : "Shift details for this employee"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeShiftModal}
                className="cursor-pointer rounded-lg p-1 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {shiftModalMode === "view" ? (
              <div className="space-y-4 px-6 py-5">
                <div className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Time
                  </p>
                  <p className="mt-1 text-base font-semibold text-[#0F172A]">
                    {formatShiftRange(selectedShift.startTime, selectedShift.endTime)}
                  </p>
                  <p className="mt-0.5 text-sm text-[#475569]">
                    {formatShiftDateLabel(selectedShift.workDate)}
                  </p>
                </div>

                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      Employee
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[#0F172A]">
                      {selectedShiftEmployee?.name || "Unassigned"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      Title / Role
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[#0F172A]">{selectedShift.title}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      Facility
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[#0F172A]">
                      {selectedShift.facility || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      Department
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[#0F172A]">
                      {selectedShift.department || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      Pay Rate
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[#0F172A]">
                      {formatPayRate(selectedShift.ratePerHour)}
                    </dd>
                  </div>
                </dl>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                    Notes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">
                    {selectedShift.notes?.trim() || "No notes"}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-3">
                  <button
                    type="button"
                    onClick={closeShiftModal}
                    className="h-10 cursor-pointer rounded-[8px] border border-[#CBD5E1] px-4 text-sm font-semibold text-[#475569] hover:bg-[#F1F5F9]"
                  >
                    Close
                  </button>
                  <button type="button" disabled={deletingShift} onClick={() => void handleDeleteShift()}
                    className="mr-auto h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-50">
                    {deletingShift ? "Deleting…" : "Delete Shift"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftModalMode("edit")}
                    className="flex h-10 cursor-pointer items-center justify-center rounded-[8px] bg-[color:var(--brand-primary,#012352)] px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
                  >
                    Edit Shift
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateShift} className="space-y-4 px-6 py-5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">
                    Shift Title / Role <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editShiftTitle}
                    onChange={(e) => setEditShiftTitle(e.target.value)}
                    className={modalTextFieldClassName}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#334155]">Facility</label>
                    <SettingsSelect
                      aria-label="Select facility"
                      value={editShiftFacilityId}
                      onChange={setEditShiftFacilityId}
                      placeholder="Select Facility"
                      triggerClassName="cursor-pointer rounded-[8px] border-[#CBD5E1]"
                      options={[
                        { value: "", label: "Select Facility" },
                        ...facilities.map((f) => ({
                          value: f.id,
                          label: f.name,
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#334155]">
                      Employee (optional)
                    </label>
                    <SettingsSelect
                      aria-label="Select employee"
                      value={editShiftWorkerId}
                      onChange={setEditShiftWorkerId}
                      placeholder="Open shift (unassigned)"
                      searchable
                      searchPlaceholder="Search employees..."
                      triggerClassName="cursor-pointer rounded-[8px] border-[#CBD5E1]"
                      options={[
                        { value: "", label: "Open shift (unassigned)" },
                        ...employees.map((employee) => ({
                          value: employee.id,
                          label: employee.name,
                        })),
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">Department</label>
                  <SettingsSelect
                    aria-label="Select department"
                    value={editShiftDepartmentId}
                    onChange={setEditShiftDepartmentId}
                    placeholder="No department"
                    triggerClassName="cursor-pointer rounded-[8px] border-[#CBD5E1]"
                    options={[
                      { value: "", label: "No department" },
                      ...departments.map((department) => ({
                        value: department.id,
                        label: department.name,
                      })),
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#334155]">
                      Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={editShiftDate}
                      onChange={(e) => setEditShiftDate(e.target.value)}
                      className={modalPickerFieldClassName}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#334155]">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={editShiftStartTime}
                      onChange={(e) => setEditShiftStartTime(e.target.value)}
                      className={`${modalPickerFieldClassName} [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#334155]">End Time</label>
                    <input
                      type="time"
                      value={editShiftEndTime}
                      onChange={(e) => setEditShiftEndTime(e.target.value)}
                      className={`${modalPickerFieldClassName} [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">
                    Rate per Hour ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 25.00"
                    value={editShiftRate}
                    onChange={(e) => setEditShiftRate(e.target.value)}
                    className={modalTextFieldClassName}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">
                    Notes / Instructions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional shift notes"
                    value={editShiftNotes}
                    onChange={(e) => setEditShiftNotes(e.target.value)}
                    className="w-full cursor-text rounded-[8px] border border-[#CBD5E1] p-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#012352)] focus:ring-1 focus:ring-[color:var(--brand-primary,#012352)]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-3">
                  <button
                    type="button"
                    onClick={() => openShiftModal(selectedShift, "view")}
                    className="h-10 cursor-pointer rounded-[8px] border border-[#CBD5E1] px-4 text-sm font-semibold text-[#475569] hover:bg-[#F1F5F9]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEditShift}
                    className="flex h-10 cursor-pointer items-center justify-center rounded-[8px] bg-[color:var(--brand-primary,#012352)] px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingEditShift ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {addShiftOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl transition-all">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Post a Shift</h3>
                <p className="text-xs text-[#64748B]">Create an open shift or assign an employee</p>
              </div>
              <button
                type="button"
                onClick={() => setAddShiftOpen(false)}
                className="cursor-pointer rounded-lg p-1 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleCreateShift} className="space-y-4 px-6 py-5">
              {createShiftError ? <p role="alert" className="text-sm text-red-600">{createShiftError}</p> : null}
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
                  className={modalTextFieldClassName}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">Facility</label>
                  <SettingsSelect
                    aria-label="Select facility"
                    value={newShiftFacilityId}
                    onChange={setNewShiftFacilityId}
                    placeholder="Select Facility"
                    triggerClassName="cursor-pointer rounded-[8px] border-[#CBD5E1]"
                    options={[
                      { value: "", label: "Select Facility" },
                      ...facilities.map((f) => ({
                        value: f.id,
                        label: f.name,
                      })),
                    ]}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">
                    Employee (optional)
                  </label>
                  <SettingsSelect
                    aria-label="Select employee"
                    value={newShiftWorkerId}
                    onChange={setNewShiftWorkerId}
                    placeholder="Open shift (unassigned)"
                    searchable
                    searchPlaceholder="Search employees..."
                    triggerClassName="cursor-pointer rounded-[8px] border-[#CBD5E1]"
                    options={[
                      { value: "", label: "Open shift (unassigned)" },
                      ...employees.map((employee) => ({
                        value: employee.id,
                        label: employee.name,
                      })),
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">Department</label>
                <SettingsSelect
                  aria-label="Select department"
                  value={newShiftDepartmentId}
                  onChange={setNewShiftDepartmentId}
                  placeholder="No department"
                  triggerClassName="cursor-pointer rounded-[8px] border-[#CBD5E1]"
                  options={[
                    { value: "", label: "No department" },
                    ...departments.map((department) => ({
                      value: department.id,
                      label: department.name,
                    })),
                  ]}
                />
              </div>

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
                    className={modalPickerFieldClassName}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">Start Time</label>
                  <input
                    type="time"
                    value={newShiftStartTime}
                    onChange={(e) => setNewShiftStartTime(e.target.value)}
                    className={`${modalPickerFieldClassName} [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#334155]">End Time</label>
                  <input
                    type="time"
                    value={newShiftEndTime}
                    onChange={(e) => setNewShiftEndTime(e.target.value)}
                    className={`${modalPickerFieldClassName} [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                  />
                </div>
              </div>

              {newShiftEndTime < newShiftStartTime ? <p role="status" className="text-xs text-[#475569]">Overnight shift: ends the following day.</p> : null}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">
                  Rate per Hour ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 25.00"
                  value={newShiftRate}
                  onChange={(e) => setNewShiftRate(e.target.value)}
                  className={modalTextFieldClassName}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">
                  Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional shift notes"
                  value={newShiftNotes}
                  onChange={(e) => setNewShiftNotes(e.target.value)}
                  className="w-full cursor-text rounded-[8px] border border-[#CBD5E1] p-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#012352)] focus:ring-1 focus:ring-[color:var(--brand-primary,#012352)]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  onClick={() => setAddShiftOpen(false)}
                  className="h-10 cursor-pointer rounded-[8px] border border-[#CBD5E1] px-4 text-sm font-semibold text-[#475569] hover:bg-[#F1F5F9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingShift}
                  className="flex h-10 cursor-pointer items-center justify-center rounded-[8px] bg-[color:var(--brand-primary,#012352)] px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingShift ? "Saving..." : "Create Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
