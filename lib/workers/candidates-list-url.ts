import {
  CANDIDATE_LIST_SORTABLE_COLUMNS,
  type CandidateListSortColumn,
  type CandidateListSortDirection,
} from "@/lib/admin/candidate-list-sort";
import {
  CANDIDATES_PAGE_SIZE_OPTIONS,
  DEFAULT_CANDIDATES_PAGE_SIZE,
} from "@/lib/workers/candidate-list-params";

export type CandidatesListUrlState = {
  q: string;
  skills: string;
  jobRole: string;
  location: string;
  appliedFrom: string;
  appliedTo: string;
  status: string;
  progressStatusId: string;
  jobTitle: string;
  stage: string;
  matchScore: string;
  clientName: string;
  assignee: string;
  sortColumn: CandidateListSortColumn | null;
  sortDir: CandidateListSortDirection;
  page: number;
  pageSize: number;
  multiJob: boolean;
};

const SORT_COLUMNS = new Set<string>(CANDIDATE_LIST_SORTABLE_COLUMNS);
const PAGE_SIZES = new Set<number>(CANDIDATES_PAGE_SIZE_OPTIONS);

export function emptyCandidatesListUrlState(): CandidatesListUrlState {
  return {
    q: "",
    skills: "",
    jobRole: "",
    location: "",
    appliedFrom: "",
    appliedTo: "",
    status: "",
    progressStatusId: "",
    jobTitle: "",
    stage: "",
    matchScore: "",
    clientName: "",
    assignee: "",
    sortColumn: null,
    sortDir: "desc",
    page: 1,
    pageSize: DEFAULT_CANDIDATES_PAGE_SIZE,
    multiJob: false,
  };
}

function readPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export function parseCandidatesListUrlState(params: URLSearchParams): CandidatesListUrlState {
  const sortRaw = (params.get("sort") ?? "").trim();
  const sortColumn = SORT_COLUMNS.has(sortRaw) ? (sortRaw as CandidateListSortColumn) : null;
  const sortDirRaw = (params.get("sortDir") ?? "desc").trim().toLowerCase();
  const pageSize = readPositiveInt(params.get("pageSize"), DEFAULT_CANDIDATES_PAGE_SIZE);

  return {
    q: (params.get("q") ?? "").trim(),
    skills: (params.get("skills") ?? "").trim(),
    jobRole: (params.get("jobRole") ?? "").trim(),
    location: (params.get("location") ?? "").trim(),
    appliedFrom: (params.get("appliedFrom") ?? "").trim(),
    appliedTo: (params.get("appliedTo") ?? "").trim(),
    status: (params.get("status") ?? "").trim(),
    progressStatusId: (params.get("progressStatusId") ?? "").trim(),
    jobTitle: (params.get("jobTitle") ?? "").trim(),
    stage: (params.get("stage") ?? "").trim(),
    matchScore: (params.get("matchScore") ?? "").trim(),
    clientName: (params.get("clientName") ?? "").trim(),
    assignee: (params.get("assignee") ?? "").trim(),
    sortColumn,
    sortDir: sortDirRaw === "asc" ? "asc" : "desc",
    page: readPositiveInt(params.get("page"), 1),
    pageSize: PAGE_SIZES.has(pageSize) ? pageSize : DEFAULT_CANDIDATES_PAGE_SIZE,
    multiJob: params.get("multiJob") === "1",
  };
}

/** Stable query string without a leading `?`. Defaults are omitted. */
export function serializeCandidatesListUrlState(state: CandidatesListUrlState): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => {
    if (value.trim()) params.set(key, value.trim());
  };
  set("q", state.q);
  set("skills", state.skills);
  set("jobRole", state.jobRole);
  set("location", state.location);
  set("appliedFrom", state.appliedFrom);
  set("appliedTo", state.appliedTo);
  set("status", state.status);
  set("progressStatusId", state.progressStatusId);
  set("jobTitle", state.jobTitle);
  set("stage", state.stage);
  set("matchScore", state.matchScore);
  set("clientName", state.clientName);
  set("assignee", state.assignee);
  if (state.sortColumn) {
    params.set("sort", state.sortColumn);
    if (state.sortDir === "asc") params.set("sortDir", "asc");
  }
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_CANDIDATES_PAGE_SIZE) {
    params.set("pageSize", String(state.pageSize));
  }
  if (state.multiJob) params.set("multiJob", "1");
  return params.toString();
}

export function candidatesListPath(state: CandidatesListUrlState): string {
  const query = serializeCandidatesListUrlState(state);
  return query ? `/admin_recruiter/candidates?${query}` : "/admin_recruiter/candidates";
}
