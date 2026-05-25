"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CARD_BORDER,
  GOLD,
  GOLD_GRADIENT,
  ICON_BOX_BG,
  PAGE_BG,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../constants";

type FlowStatus = "published" | "unpublished";

type OnboardingFlow = {
  id: string;
  name: string;
  status: FlowStatus;
};

const INITIAL_PUBLISHED: OnboardingFlow[] = [
  { id: "pre-offer", name: "Pre-Offer (ATS)", status: "published" },
  { id: "post-offer", name: "Post-Offer", status: "published" },
  { id: "final-offer", name: "Final Offer", status: "published" },
  { id: "employee-account", name: "Employee Account Setup", status: "published" },
  { id: "new-hire-orientation", name: "New Hire Orientation", status: "published" },
  { id: "hr-doc-verification", name: "HR Document Verification", status: "published" },
  { id: "it-equipment", name: "IT Equipment Provisioning", status: "published" },
  { id: "payroll-enrollment", name: "Payroll Enrollment", status: "published" },
  { id: "background-check", name: "Background Check Approval", status: "published" },
  { id: "department-intro", name: "Department Introduction", status: "published" },
  { id: "training-compliance", name: "Training & Compliance", status: "published" },
  { id: "benefits-registration", name: "Benefits Registration", status: "published" },
];

const INITIAL_UNPUBLISHED: OnboardingFlow[] = [
  { id: "manager-approval", name: "Manager Approval", status: "unpublished" },
  { id: "facility-assignment", name: "Facility Assignment", status: "unpublished" },
];

type FilterTab = "published" | "unpublished";
type FlowSaveStatus = "published" | "draft";

type SelectOption = { id: string; label: string };

const FLOW_TEMPLATE_OPTIONS: SelectOption[] = [
  { id: "employee-checklist", label: "New Employee Checklist" },
  { id: "orientation", label: "Orientation Template" },
  { id: "compliance", label: "Compliance Template" },
];

const FLOW_FOLDER_OPTIONS: SelectOption[] = [
  { id: "onboarding", label: "Onboarding Flows" },
  { id: "marketing", label: "Marketing Flows" },
  { id: "uncategorized", label: "Uncategorized" },
];

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 6L8 10L12 6"
        stroke={TEXT_SECONDARY}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 10L8 6L12 10"
        stroke={TEXT_SECONDARY}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke={TEXT_MUTED} strokeWidth="1.5" />
      <path d="M10 10L13 13" stroke={TEXT_MUTED} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2 5L4.25 7.25L8 3.25"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderOutlineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2.5 6.5C2.5 5.395 3.395 4.5 4.5 4.5H7.1L8.25 6H13.5C14.605 6 15.5 6.895 15.5 8V13.5C15.5 14.605 14.605 15.5 13.5 15.5H4.5C3.395 15.5 2.5 14.605 2.5 13.5V6.5Z"
        stroke="#98a2b3"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TemplateOutlineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="3" y="2.5" width="12" height="13" rx="1.5" stroke="#98a2b3" strokeWidth="1.35" />
      <path d="M6 6H12M6 9H12M6 12H9.5" stroke="#98a2b3" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

type SearchCheckboxSelectProps = {
  id: string;
  triggerPlaceholder: string;
  searchPlaceholder: string;
  options: SelectOption[];
  selectedId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  iconType?: "folder" | "template";
};

function SearchCheckboxSelect({
  id,
  triggerPlaceholder,
  searchPlaceholder,
  options,
  selectedId,
  onChange,
  disabled = false,
  iconType = "folder",
}: SearchCheckboxSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  const selectedLabel = options.find((o) => o.id === selectedId)?.label;
  const ItemIcon = iconType === "folder" ? FolderOutlineIcon : TemplateOutlineIcon;

  return (
    <div ref={containerRef}>
      <div className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => !disabled && setOpen((v) => !v)}
          className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3.5 text-left text-sm outline-none transition focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/25 disabled:cursor-not-allowed disabled:opacity-60 ${
            open ? "rounded-b-none border-b-0" : ""
          }`}
          style={{
            borderColor: CARD_BORDER,
            color: selectedLabel ? TEXT_PRIMARY : TEXT_MUTED,
          }}
        >
          <span className="truncate">{selectedLabel ?? triggerPlaceholder}</span>
          <span className="shrink-0">{open ? <ChevronUpIcon /> : <ChevronDownIcon />}</span>
        </button>

        {open && !disabled ? (
          <div
            className="absolute left-0 right-0 top-full z-20 overflow-hidden rounded-b-lg border border-t-0 bg-white shadow-sm"
            style={{ borderColor: CARD_BORDER }}
          >
            <div className="border-b px-3 py-2.5" style={{ borderColor: CARD_BORDER }}>
              <div className="relative">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-md border-0 bg-transparent py-2 pl-1 pr-9 text-sm outline-none"
                  style={{ color: TEXT_PRIMARY }}
                  aria-label={searchPlaceholder}
                />
                <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2">
                  <SearchIcon />
                </span>
              </div>
            </div>

            <ul
              id={listboxId}
              role="listbox"
              aria-label={searchPlaceholder}
              className="max-h-[160px] overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3.5 py-3 text-sm" style={{ color: TEXT_MUTED }}>
                  No results found
                </li>
              ) : (
                filtered.map((opt) => {
                  const checked = selectedId === opt.id;
                  return (
                    <li key={opt.id} role="option" aria-selected={checked}>
                      <button
                        type="button"
                        onClick={() => onChange(checked ? "" : opt.id)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition hover:bg-[#f9fafb]"
                        style={{
                          backgroundColor: checked ? "#f2f4f7" : undefined,
                          color: TEXT_PRIMARY,
                        }}
                      >
                        <ItemIcon />
                        <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                        <span
                          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition ${
                            checked ? "border-[#012352] bg-[#012352]" : "border-[#d0d5dd] bg-white"
                          }`}
                          aria-hidden
                        >
                          {checked ? <CheckIcon /> : null}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {selectedId ? (
        <p className="mt-1.5 text-right text-xs leading-[18px]" style={{ color: TEXT_MUTED }}>
          1 added
        </p>
      ) : null}
    </div>
  );
}

/** Figma modal header: flowchart nodes icon */
function FlowChartHeaderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="1" y="8" width="6" height="6" rx="1.5" stroke={GOLD} strokeWidth="1.5" />
      <rect x="15" y="1" width="6" height="6" rx="1.5" stroke={GOLD} strokeWidth="1.5" />
      <rect x="15" y="15" width="6" height="6" rx="1.5" stroke={GOLD} strokeWidth="1.5" />
      <path d="M7 11H11M11 11V4M11 11V18" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3L5 8L10 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CreateFlowPlusIcon() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/40">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <path d="M5 2V8M2 5H8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Figma: stacked rounded rectangles flow icon in gold */
function FlowListIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V8C21 8.53043 20.7893 9.03914 20.4142 9.41421C20.0391 9.78929 19.5304 10 19 10H5C4.46957 10 3.96086 9.78929 3.58579 9.41421C3.21071 9.03914 3 8.53043 3 8V5ZM3 16C3 15.4696 3.21071 14.9609 3.58579 14.5858C3.96086 14.2107 4.46957 14 5 14H19C19.5304 14 20.0391 14.2107 20.4142 14.5858C20.7893 14.9609 21 15.4696 21 16V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V16Z"
        stroke={GOLD}
        strokeWidth="2"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M8.7501 7.00008C8.7501 7.96658 7.9666 8.75008 7.0001 8.75008C6.0336 8.75008 5.2501 7.96658 5.2501 7.00008C5.2501 6.03358 6.0336 5.25008 7.0001 5.25008C7.9666 5.25008 8.7501 6.03358 8.7501 7.00008Z"
        stroke={GOLD}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.43408 7.00006C2.17741 4.63343 4.38841 2.91675 7.00036 2.91675C9.61232 2.91675 11.8233 4.63345 12.5666 7.0001C11.8233 9.36674 9.61232 11.0834 7.00037 11.0834C4.38841 11.0834 2.1774 9.36672 1.43408 7.00006Z"
        stroke={GOLD}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M8.88544 3.05214L10.9478 5.11453M9.76044 2.17714C10.33 1.60762 11.2533 1.60762 11.8228 2.17714C12.3923 2.74665 12.3923 3.67002 11.8228 4.23953L3.79167 12.2707H1.75V10.1876L9.76044 2.17714Z"
        stroke={GOLD}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PublishedBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-[18px]"
      style={{
        color: "#012352",
        border: "1px solid #012352",
        backgroundColor: "#ffffff",
      }}
    >
      Published
    </span>
  );
}

function UnpublishedBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-[18px]"
      style={{
        color: "#ffffff",
        border: "1px solid #94A3B8",
        backgroundColor: "#94A3B8",
      }}
    >
      Unpublished
    </span>
  );
}

type FlowCardProps = {
  flow: OnboardingFlow;
};

type CreateNewFlowModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (flow: OnboardingFlow) => void;
};

function CreateNewFlowModal({ open, onClose, onCreated }: CreateNewFlowModalProps) {
  const [flowName, setFlowName] = useState("New Employee Checklist");
  const [template, setTemplate] = useState("");
  const [templateName, setTemplateName] = useState("New Employee Checklist Template");
  const [createAsBlank, setCreateAsBlank] = useState(false);
  const [folder, setFolder] = useState("onboarding");
  const [saveStatus, setSaveStatus] = useState<FlowSaveStatus>("published");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setFlowName("New Employee Checklist");
    setTemplate("");
    setTemplateName("New Employee Checklist Template");
    setCreateAsBlank(false);
    setFolder("onboarding");
    setSaveStatus("published");
  }, [open]);

  const handleCreate = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const name = flowName.trim() || "New Employee Checklist";
      const status: FlowStatus = saveStatus === "published" ? "published" : "unpublished";
      onCreated({
        id: `flow-${Date.now()}`,
        name,
        status,
      });
      onClose();
    },
    [flowName, onCreated, onClose, saveStatus]
  );

  if (!open) return null;

  const fieldClassName =
    "h-11 w-full appearance-none rounded-lg border bg-white px-3.5 text-sm outline-none transition focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/25";
  const fieldStyle = { borderColor: CARD_BORDER, color: TEXT_PRIMARY };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-flow-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[480px] rounded-2xl bg-white p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-[#101828] transition hover:brightness-110"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#faf6ef" }}
          >
            <FlowChartHeaderIcon />
          </div>
          <h2
            id="create-flow-title"
            className="text-xl font-semibold leading-7"
            style={{ color: TEXT_PRIMARY }}
          >
            Create a new flow
          </h2>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleCreate}>
          <div>
            <label
              htmlFor="flow-name"
              className="mb-1.5 block text-sm font-medium leading-5"
              style={{ color: TEXT_PRIMARY }}
            >
              Flow Name
            </label>
            <input
              id="flow-name"
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className={fieldClassName}
              style={fieldStyle}
            />
          </div>

          <div>
            <label
              htmlFor="flow-template"
              className="mb-1.5 block text-sm font-medium leading-5"
              style={{ color: TEXT_PRIMARY }}
            >
              Select Template
            </label>
            <SearchCheckboxSelect
              id="flow-template"
              triggerPlaceholder="Select a template"
              searchPlaceholder="Search template"
              options={FLOW_TEMPLATE_OPTIONS}
              selectedId={template}
              onChange={setTemplate}
              disabled={createAsBlank}
              iconType="template"
            />
          </div>

          <div className="relative flex items-center py-1">
            <div className="h-px flex-1" style={{ backgroundColor: CARD_BORDER }} />
            <span
              className="px-3 text-xs font-semibold uppercase tracking-wide"
              style={{ color: TEXT_MUTED }}
            >
              OR
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: CARD_BORDER }} />
          </div>

          <label
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border transition"
            style={{
              borderColor: createAsBlank ? GOLD : CARD_BORDER,
              backgroundColor: createAsBlank ? "#faf6ef" : undefined,
            }}
          >
            <input
              type="checkbox"
              checked={createAsBlank}
              onChange={(e) => {
                const checked = e.target.checked;
                setCreateAsBlank(checked);
                if (checked) {
                  setTemplate("");
                }
              }}
              className="h-4 w-4 rounded border-[#d0d5dd] accent-[#012352]"
            />
            <span className="text-sm font-medium leading-5" style={{ color: TEXT_SECONDARY }}>
              Create as blank
            </span>
          </label>

          {createAsBlank ? (
            <div>
              <label
                htmlFor="template-name"
                className="mb-1.5 block text-sm font-medium leading-5"
                style={{ color: TEXT_PRIMARY }}
              >
                Template Name
              </label>
              <input
                id="template-name"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className={fieldClassName}
                style={fieldStyle}
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="flow-folder"
              className="mb-1.5 block text-sm font-medium leading-5"
              style={{ color: TEXT_PRIMARY }}
            >
              Add flow to folder
            </label>
            <SearchCheckboxSelect
              id="flow-folder"
              triggerPlaceholder="Select folder"
              searchPlaceholder="Search folder"
              options={FLOW_FOLDER_OPTIONS}
              selectedId={folder}
              onChange={setFolder}
              iconType="folder"
            />
          </div>

          <fieldset className="flex flex-wrap items-center gap-6">
            <legend className="sr-only">Flow status</legend>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="radio"
                name="flow-status"
                value="published"
                checked={saveStatus === "published"}
                onChange={() => setSaveStatus("published")}
                className="h-[18px] w-[18px] border-[#d0d5dd] accent-[#012352]"
              />
              <span className="text-sm font-medium leading-5" style={{ color: TEXT_SECONDARY }}>
                Published
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="radio"
                name="flow-status"
                value="draft"
                checked={saveStatus === "draft"}
                onChange={() => setSaveStatus("draft")}
                className="h-[18px] w-[18px] border-[#d0d5dd] accent-[#012352]"
              />
              <span className="text-sm font-medium leading-5" style={{ color: TEXT_SECONDARY }}>
                Save as draft
              </span>
            </label>
          </fieldset>

          <button
            type="submit"
            className="mt-1 h-11 w-full rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97]"
            style={{ background: GOLD_GRADIENT }}
          >
            Create
          </button>
        </form>
      </div>
    </div>
  );
}

function FlowCard({ flow }: FlowCardProps) {
  const published = flow.status === "published";

  return (
    <article
      className="group relative flex items-center gap-4 rounded-xl border bg-white px-4 py-4 transition"
      style={{
        borderColor: CARD_BORDER,
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = GOLD;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = CARD_BORDER;
      }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: ICON_BOX_BG }}
      >
        <FlowListIcon />
      </div>

      <div className="min-w-0 flex-1 pr-16">
        <h3
          className="truncate text-[15px] font-semibold leading-6"
          style={{ color: TEXT_PRIMARY }}
        >
          {flow.name}
        </h3>
        <div className="mt-1.5">
          {published ? <PublishedBadge /> : <UnpublishedBadge />}
        </div>
      </div>

      <div className="absolute right-4 top-1/2 flex h-[14px] w-[36px] -translate-y-1/2 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="flex h-[14px] w-[14px] items-center justify-center transition hover:opacity-80"
          aria-label={`View ${flow.name}`}
        >
          <EyeIcon />
        </button>
        <button
          type="button"
          className="flex h-[14px] w-[14px] items-center justify-center transition hover:opacity-80"
          aria-label={`Edit ${flow.name}`}
        >
          <EditIcon />
        </button>
      </div>
    </article>
  );
}

export default function OnboardingFlowsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("published");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [publishedFlows, setPublishedFlows] = useState(INITIAL_PUBLISHED);
  const [unpublishedFlows, setUnpublishedFlows] = useState(INITIAL_UNPUBLISHED);

  const publishedCount = publishedFlows.length;
  const unpublishedCount = unpublishedFlows.length;

  const visibleFlows = useMemo(
    () => (activeTab === "published" ? publishedFlows : unpublishedFlows),
    [activeTab, publishedFlows, unpublishedFlows]
  );

  const handleFlowCreated = useCallback((flow: OnboardingFlow) => {
    if (flow.status === "published") {
      setPublishedFlows((prev) => [flow, ...prev]);
      setActiveTab("published");
    } else {
      setUnpublishedFlows((prev) => [flow, ...prev]);
      setActiveTab("unpublished");
    }
  }, []);

  const sectionTitle = activeTab === "published" ? "Published Flows" : "Unpublished Flows";

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 sm:py-10">
        <Link
          href="/braas-hr/dashboard/workflowlibrary"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium leading-5 transition hover:opacity-80"
          style={{ color: TEXT_SECONDARY }}
        >
          <BackArrowIcon />
          Back
        </Link>

        <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1
              className="text-[32px] font-semibold leading-[40px] tracking-[-0.02em] sm:text-[36px] sm:leading-[44px]"
              style={{ color: TEXT_PRIMARY }}
            >
              Onboarding Flows
            </h1>
            <p className="mt-1 text-sm leading-5" style={{ color: TEXT_SECONDARY }}>
              {publishedCount} Published <span className="text-[#d0d5dd]">•</span>{" "}
              {unpublishedCount} Unpublish
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-[0.97]"
            style={{ backgroundColor: "#012352" }}
          >
            <CreateFlowPlusIcon />
            Create a new flow
          </button>
        </header>

        <div
          className="mb-8 inline-flex gap-1"
          role="tablist"
          aria-label="Flow status"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "published"}
            onClick={() => setActiveTab("published")}
            className="rounded-full px-5 py-2 text-sm font-semibold leading-5 transition"
            style={{
              background: activeTab === "published" ? GOLD_GRADIENT : "transparent",
              color: activeTab === "published" ? "#ffffff" : TEXT_SECONDARY,
            }}
          >
            Published
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "unpublished"}
            onClick={() => setActiveTab("unpublished")}
            className="rounded-full px-5 py-2 text-sm font-semibold leading-5 transition"
            style={{
              background: activeTab === "unpublished" ? GOLD_GRADIENT : "transparent",
              color: activeTab === "unpublished" ? "#ffffff" : TEXT_SECONDARY,
            }}
          >
            Unpublished
          </button>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <h2
            className="text-lg font-semibold leading-7"
            style={{ color: TEXT_PRIMARY }}
          >
            {sectionTitle}
          </h2>
          <span className="text-sm leading-5" style={{ color: TEXT_MUTED }}>
            {visibleFlows.length}
          </span>
        </div>

        {visibleFlows.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: TEXT_MUTED }}>
            No flows found
          </p>
        ) : (
          <section
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            aria-label={sectionTitle}
          >
            {visibleFlows.map((flow) => (
              <FlowCard key={flow.id} flow={flow} />
            ))}
          </section>
        )}
      </div>

      <CreateNewFlowModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleFlowCreated}
      />
    </div>
  );
}
