import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStaffListSessionCache,
  invalidateJobsListCache,
  invalidateStaffListCache,
  readJobsListCache,
  readStaffListCache,
  resetStaffListCacheForTests,
  setStaffListCacheClockForTests,
  STAFF_LIST_CACHE_MAX_AGE_MS,
  writeJobsListCache,
  writeStaffListCache,
} from "@/lib/lists/staff-list-session-cache";
import { toPersistedCandidateRow, toPersistedJobListRow } from "@/lib/lists/staff-list-cache-rows";

describe("staff list session cache", () => {
  afterEach(() => {
    resetStaffListCacheForTests();
    vi.unstubAllGlobals();
  });

  function installSessionStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      get length() {
        return store.size;
      },
      key(index: number) {
        return [...store.keys()][index] ?? null;
      },
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (value.includes("quota")) throw new Error("quota");
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    });
    return store;
  }

  it("keeps candidates and jobs entries for the same user apart", () => {
    writeStaffListCache("candidates", "user-a:tenant-a", "page=1", [{ id: "c" }], 1);
    writeJobsListCache("user-a:tenant-a", [{ id: "j" }], 1);
    expect(readStaffListCache("candidates", "user-a:tenant-a", "page=1")?.rows).toEqual([{ id: "c" }]);
    expect(readJobsListCache("user-a:tenant-a")?.rows).toEqual([{ id: "j" }]);
    expect(readStaffListCache("jobs", "user-a:tenant-a", "page=1")).toBeNull();
  });

  it("does not return another user or tenant", () => {
    writeJobsListCache("user-a:tenant-a", [{ id: "1" }], 1);
    expect(readJobsListCache("user-b:tenant-a")).toBeNull();
    expect(readJobsListCache("user-a:tenant-b")).toBeNull();
    expect(readJobsListCache(":")).toBeNull();
    expect(readJobsListCache("user-a:")).toBeNull();
  });

  it("expires entries past the max age", () => {
    installSessionStorage();
    let current = 1_000_000;
    setStaffListCacheClockForTests(() => current);
    writeJobsListCache("user-a:tenant-a", [{ id: "1" }], 1);
    current += STAFF_LIST_CACHE_MAX_AGE_MS + 5;
    expect(readJobsListCache("user-a:tenant-a")).toBeNull();
  });

  it("ignores corrupt session JSON", () => {
    const store = installSessionStorage();
    writeJobsListCache("user-a:tenant-a", [{ id: "1" }], 1);
    const saved = [...store.entries()].filter(([key]) => !key.includes("invalidated"));
    expect(saved.length).toBe(1);
    resetStaffListCacheForTests();
    installSessionStorage();
    sessionStorage.setItem(saved[0][0], "{not-json");
    expect(readJobsListCache("user-a:tenant-a")).toBeNull();
  });

  it("keeps the memory copy when sessionStorage throws", () => {
    installSessionStorage();
    writeStaffListCache("candidates", "user-a:tenant-a", "page=1", [{ id: "quota" }], 1, {
      sessionRows: [{ id: "quota" }],
    });
    expect(readStaffListCache("candidates", "user-a:tenant-a", "page=1")?.rows).toEqual([
      { id: "quota" },
    ]);
  });

  it("stores slim session rows and full rows in memory", () => {
    installSessionStorage();
    writeStaffListCache("jobs", "user-a:tenant-a", "all", [{ id: "1", token: "secret" }], 1, {
      sessionRows: [{ id: "1" }],
    });
    expect(readJobsListCache("user-a:tenant-a")?.rows).toEqual([{ id: "1", token: "secret" }]);
    const saved = new Map<string, string>();
    for (let i = 0; i < sessionStorage.length; i++) {
      const storageName = sessionStorage.key(i);
      if (!storageName || storageName.includes("invalidated")) continue;
      const value = sessionStorage.getItem(storageName);
      if (value != null) saved.set(storageName, value);
    }
    resetStaffListCacheForTests();
    for (const [storageName, value] of saved) sessionStorage.setItem(storageName, value);
    expect(readJobsListCache("user-a:tenant-a")?.rows).toEqual([{ id: "1" }]);
  });

  it("clears both routes on logout and only the jobs route after a job edit", () => {
    writeStaffListCache("candidates", "user-a:tenant-a", "page=1", [{ id: "c" }], 1);
    writeJobsListCache("user-a:tenant-a", [{ id: "j" }], 1);
    invalidateJobsListCache();
    expect(readJobsListCache("user-a:tenant-a")).toBeNull();
    expect(readStaffListCache("candidates", "user-a:tenant-a", "page=1")?.rows).toEqual([{ id: "c" }]);

    writeJobsListCache("user-a:tenant-a", [{ id: "j2" }], 1);
    clearStaffListSessionCache();
    expect(readJobsListCache("user-a:tenant-a")).toBeNull();
    expect(readStaffListCache("candidates", "user-a:tenant-a", "page=1")).toBeNull();
    invalidateStaffListCache("candidates");
  });
});

describe("persisted list rows", () => {
  it("drops signed photo URLs from candidate rows", () => {
    expect(
      toPersistedCandidateRow({
        id: "1",
        name: "Ada",
        email: "ada@example.com",
        profilePhotoUrl: "https://signed.example/photo?token=secret",
        assignedRecruiterPhotoUrl: "https://signed.example/recruiter?token=secret",
      })
    ).toEqual({
      id: "1",
      name: "Ada",
      email: "ada@example.com",
      profilePhotoUrl: null,
      assignedRecruiterPhotoUrl: null,
    });
  });

  it("drops job body text, public tokens, and creator photo URLs", () => {
    expect(
      toPersistedJobListRow({
        id: "job-1",
        public_title: "RN",
        public_job_token: "token-secret",
        public_description: "<p>long</p>",
        qualifications: "ICU",
        createdBy: { id: "u", name: "Sam", profilePhotoUrl: "https://signed.example/a" },
      })
    ).toEqual({
      id: "job-1",
      public_title: "RN",
      createdBy: { id: "u", name: "Sam" },
    });
  });
});
