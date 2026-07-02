/**
 * Hostname-scoped browser storage keys so tenant data never leaks across subdomains.
 */
export function hostnameStorageKey(baseKey: string): string {
  const host =
    typeof window !== "undefined"
      ? window.location.hostname.trim().toLowerCase()
      : "server";
  return `brasshr:${host}:${baseKey}`;
}

export function readHostnameScopedItem(baseKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(hostnameStorageKey(baseKey));
  } catch {
    return null;
  }
}

export function writeHostnameScopedItem(baseKey: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(hostnameStorageKey(baseKey), value);
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function removeHostnameScopedItem(baseKey: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(hostnameStorageKey(baseKey));
  } catch {
    /* ignore */
  }
}

const APPLICANT_ID_KEY = "applicantId";

export function getScopedApplicantId(): string | null {
  const scoped = readHostnameScopedItem(APPLICANT_ID_KEY)?.trim();
  if (scoped) return scoped;

  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(APPLICANT_ID_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function setScopedApplicantId(applicantId: string): void {
  const value = applicantId.trim();
  writeHostnameScopedItem(APPLICANT_ID_KEY, value);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APPLICANT_ID_KEY, value);
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function clearScopedApplicantId(): void {
  removeHostnameScopedItem(APPLICANT_ID_KEY);
}
