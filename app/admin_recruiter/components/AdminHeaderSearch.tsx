"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  adminHeaderSearchShortcuts,
  candidatesResultsHref,
  searchAdminHeaderPages,
  type AdminHeaderSearchItem,
} from "@/lib/admin/admin-header-search";

const HEADER_SEARCH_ICON = "/icons/admin-recruiter/header/search.svg";

export default function AdminHeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remotePeople, setRemotePeople] = useState<AdminHeaderSearchItem[]>([]);
  const [remoteJobs, setRemoteJobs] = useState<AdminHeaderSearchItem[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pageResults = useMemo(() => searchAdminHeaderPages(query, 6), [query]);
  const shortcuts = useMemo(() => adminHeaderSearchShortcuts(query), [query]);

  const flatResults = useMemo(() => {
    const items: AdminHeaderSearchItem[] = [];
    const seen = new Set<string>();
    for (const item of [...remotePeople, ...remoteJobs, ...pageResults, ...shortcuts]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    return items.slice(0, 12);
  }, [pageResults, remoteJobs, remotePeople, shortcuts]);

  useEffect(() => {
    setActiveIndex(0);
  }, [flatResults]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemotePeople([]);
      setRemoteJobs([]);
      setLoadingRemote(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoadingRemote(true);
      void fetch(`/api/admin/header-search?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (res) => {
          const payload = (await res.json().catch(() => ({}))) as {
            people?: AdminHeaderSearchItem[];
            jobs?: AdminHeaderSearchItem[];
          };
          if (!res.ok) throw new Error("search failed");
          setRemotePeople(Array.isArray(payload.people) ? payload.people : []);
          setRemoteJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setRemotePeople([]);
          setRemoteJobs([]);
          void err;
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingRemote(false);
        });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const navigateTo = useCallback(
    (item: AdminHeaderSearchItem) => {
      setOpen(false);
      setQuery("");
      router.push(item.href);
    },
    [router]
  );

  const submitSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (flatResults[activeIndex]) {
      navigateTo(flatResults[activeIndex]);
      return;
    }
    setOpen(false);
    router.push(candidatesResultsHref(trimmed));
    setQuery("");
  }, [activeIndex, flatResults, navigateTo, query, router]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        flatResults.length === 0 ? 0 : Math.min(current + 1, flatResults.length - 1)
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submitSearch();
    }
  }

  return (
    <div ref={rootRef} className="relative hidden min-w-0 flex-1 md:block">
      <label className="flex h-9 min-w-0 w-full cursor-text items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2.5 transition focus-within:border-[color:var(--brand-primary)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HEADER_SEARCH_ICON}
          alt=""
          width={14}
          height={14}
          className="size-3.5 shrink-0"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search anything"
          aria-label="Search anything"
          aria-expanded={open}
          aria-controls="admin-header-search-results"
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] leading-4 font-normal text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:ring-0"
        />
      </label>

      {open ? (
        <div
          id="admin-header-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[130] max-h-[min(420px,70vh)] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
        >
          <div className="max-h-[min(380px,65vh)] overflow-y-auto py-1">
            {flatResults.length === 0 ? (
              <p className="px-3 py-3 text-sm text-[#64748B]">
                {query.trim()
                  ? loadingRemote
                    ? "Searching…"
                    : "No matches found."
                  : "Type to search pages, people, or jobs."}
              </p>
            ) : (
              flatResults.map((item, index) => {
                const active = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigateTo(item)}
                    className={`flex w-full min-w-0 flex-col gap-0.5 px-3 py-2.5 text-left transition ${
                      active ? "bg-[#F8FAFC]" : "bg-white hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <span className="truncate text-sm font-semibold text-[#0F172A]">
                      {item.label}
                    </span>
                    <span className="truncate text-xs text-[#64748B]">
                      {item.kind === "person"
                        ? `Person · ${item.description}`
                        : item.kind === "job"
                          ? `Job · ${item.description}`
                          : item.description}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-[#F1F5F9] px-3 py-2 text-[11px] text-[#94A3B8]">
            Enter to open · Esc to close
            {loadingRemote ? " · Searching records…" : ""}
          </div>
        </div>
      ) : null}
    </div>
  );
}
