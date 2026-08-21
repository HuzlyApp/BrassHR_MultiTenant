export type CandidateKpiIcon = {
  src: string;
  bg: string;
  leafWidth: number;
  leafHeight: number;
};

export type CandidateKpiCard = {
  label: string;
  value: number;
  trendPercent: number;
  icon: CandidateKpiIcon;
};

type CandidateKpiSource = {
  status: string;
  createdAt: string | null;
};

const ICONS = "/icons/candidates-icons";
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 30 * DAY_MS;

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

function isHiredStatus(status: string): boolean {
  const s = normalizeStatus(status);
  return s === "converted" || s === "hired" || s === "onboarded";
}

function isRejectedStatus(status: string): boolean {
  const s = normalizeStatus(status);
  return s === "disapproved" || s === "rejected";
}

function isActiveStatus(status: string): boolean {
  return !isHiredStatus(status) && !isRejectedStatus(status);
}

function createdAtTime(createdAt: string | null): number | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  return Number.isNaN(t) ? null : t;
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function countInWindow(
  rows: CandidateKpiSource[],
  start: number,
  end: number,
  predicate: (row: CandidateKpiSource) => boolean
): number {
  return rows.reduce((total, row) => {
    if (!predicate(row)) return total;
    const t = createdAtTime(row.createdAt);
    if (t === null || t < start || t >= end) return total;
    return total + 1;
  }, 0);
}

export function buildCandidateKpis(rows: CandidateKpiSource[]): CandidateKpiCard[] {
  const now = Date.now();
  const currentStart = now - WINDOW_MS;
  const previousStart = now - WINDOW_MS * 2;

  const newCurrent = countInWindow(rows, currentStart, now, () => true);
  const newPrevious = countInWindow(rows, previousStart, currentStart, () => true);
  const activeCurrent = countInWindow(rows, currentStart, now, (row) => isActiveStatus(row.status));
  const activePrevious = countInWindow(rows, previousStart, currentStart, (row) => isActiveStatus(row.status));
  const hiredCurrent = countInWindow(rows, currentStart, now, (row) => isHiredStatus(row.status));
  const hiredPrevious = countInWindow(rows, previousStart, currentStart, (row) => isHiredStatus(row.status));

  return [
    {
      label: "New Candidates",
      value: newCurrent,
      trendPercent: percentChange(newCurrent, newPrevious),
      icon: { src: `${ICONS}/kpi-group.svg`, bg: "#e2d8ff", leafWidth: 25, leafHeight: 26.02 },
    },
    {
      label: "Active Candidates",
      value: rows.filter((row) => isActiveStatus(row.status)).length,
      trendPercent: percentChange(activeCurrent, activePrevious),
      icon: { src: `${ICONS}/kpi-person-clock.svg`, bg: "#f2f6ff", leafWidth: 30, leafHeight: 30 },
    },
    {
      label: "Analyzed",
      value: 0,
      trendPercent: 0,
      icon: { src: `${ICONS}/kpi-ai-line.svg`, bg: "#fbe9ff", leafWidth: 30, leafHeight: 30 },
    },
    {
      label: "Hired",
      value: rows.filter((row) => isHiredStatus(row.status)).length,
      trendPercent: percentChange(hiredCurrent, hiredPrevious),
      icon: { src: `${ICONS}/kpi-person-check.svg`, bg: "#c7fff8", leafWidth: 24.67, leafHeight: 27.5 },
    },
  ];
}
