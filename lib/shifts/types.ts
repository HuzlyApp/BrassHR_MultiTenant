export type ShiftCalendarStatus = "active" | "cancelled" | "pending" | "confirmed";

export type ShiftCalendarEvent = {
  id: string;
  shiftId: string;
  title: string;
  startDate: string;
  endDate: string;
  startHour: number;
  endHour: number;
  workerName: string;
  workerId: string | null;
  jobRole: string;
  facility: string;
  facilityId: string | null;
  status: ShiftCalendarStatus;
};

export type ShiftCalendarFilterOptions = {
  workers: Array<{ id: string; name: string }>;
  jobRoles: string[];
  facilities: Array<{ id: string; name: string }>;
  statuses: ShiftCalendarStatus[];
};

export type ShiftCalendarResponse = {
  events: ShiftCalendarEvent[];
  filterOptions: ShiftCalendarFilterOptions;
  meta: {
    tenantId: string;
    start: string;
    end: string;
    total: number;
  };
};
