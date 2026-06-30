"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Mail } from "lucide-react";
import toast from "react-hot-toast";
import CandidateEmailInboxPanel from "@/app/admin_recruiter/components/CandidateEmailInboxPanel";
import { MailComposePanel } from "@/app/admin_recruiter/components/MailComposePanel";
import { EmailIntegrationPanel } from "@/app/admin_recruiter/components/EmailIntegrationPanel";
import {
  EmailInboxSidebar,
  type EmailInboxFolder,
} from "@/app/admin_recruiter/components/EmailInboxSidebar";
import {
  buildMailInboxListItems,
  buildMailSentListItems,
  countInboundMessages,
  countOutboundMessages,
} from "@/lib/communication/mail-list-items";
import type { TenantMailInboxItem } from "@/lib/communication/list-tenant-mail-inbox";
import type { MailDraftListItem } from "@/lib/communication/mail-drafts";
import type { CommunicationThread } from "@/lib/communication/conversation-client";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { MailFolderListRow } from "@/app/admin_recruiter/components/MailFolderListRow";
import { MailDraftListRow } from "@/app/admin_recruiter/components/MailDraftListRow";

type MailApiResponse = {
  items?: TenantMailInboxItem[];
  emailConfigured?: boolean;
  error?: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatMailTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

export default function AdminRecruiterMailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workerFromUrl = searchParams.get("workerId")?.trim() || null;
  const composeFromUrl =
    searchParams.get("compose") === "1" || searchParams.get("compose") === "true";

  const [folder, setFolder] = useState<EmailInboxFolder>(() =>
    composeFromUrl && workerFromUrl ? "compose" : "inbox"
  );
  const [items, setItems] = useState<TenantMailInboxItem[]>([]);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(workerFromUrl);
  const [composeWorkerId, setComposeWorkerId] = useState<string | null>(
    composeFromUrl && workerFromUrl ? workerFromUrl : null
  );
  const [activeDraft, setActiveDraft] = useState<MailDraftListItem | null>(null);
  const [drafts, setDrafts] = useState<MailDraftListItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [workerThreads, setWorkerThreads] = useState<CommunicationThread[]>([]);
  const [workerContact, setWorkerContact] = useState<{
    name: string;
    email: string | null;
    phone: string | null;
  } | null>(null);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mail", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as MailApiResponse;
      if (!res.ok) {
        setError(json.error || `Could not load mail (${res.status})`);
        setItems([]);
        setEmailConfigured(false);
        return;
      }
      setItems(json.items ?? []);
      setEmailConfigured(Boolean(json.emailConfigured));
    } catch {
      setError("Network error. Please try again.");
      setItems([]);
      setEmailConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkerMail = useCallback(async (workerId: string) => {
    setWorkerLoading(true);
    setWorkerError(null);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/communications`,
        { cache: "no-store", headers: await authHeaders() }
      );
      const json = (await res.json().catch(() => ({}))) as {
        threads?: CommunicationThread[];
        contact?: { name?: string; email?: string | null; phone?: string | null };
        error?: string;
      };
      if (!res.ok) {
        setWorkerError(json.error || `Could not load email (${res.status})`);
        setWorkerThreads([]);
        return;
      }
      setWorkerThreads((json.threads ?? []).filter((thread) => thread.channel === "email"));
      const contact = json.contact;
      setWorkerContact({
        name: contact?.name?.trim() || "Applicant",
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
      });
    } catch {
      setWorkerError("Network error. Please try again.");
      setWorkerThreads([]);
    } finally {
      setWorkerLoading(false);
    }
  }, []);

  const activeWorkerId = selectedWorkerId;

  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const res = await fetch("/api/admin/mail/drafts", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as {
        drafts?: MailDraftListItem[];
        error?: string;
      };
      if (!res.ok) {
        setDrafts([]);
        return;
      }
      setDrafts(json.drafts ?? []);
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  const refreshMail = useCallback(async () => {
    await loadInbox();
    await loadDrafts();
    if (selectedWorkerId) await loadWorkerMail(selectedWorkerId);
  }, [loadInbox, loadDrafts, loadWorkerMail, selectedWorkerId]);

  useEffect(() => {
    void loadInbox();
    void loadDrafts();
  }, [loadInbox, loadDrafts]);

  useEffect(() => {
    if (!selectedWorkerId) {
      setWorkerThreads([]);
      setWorkerContact(null);
      setWorkerError(null);
      return;
    }
    void loadWorkerMail(selectedWorkerId);
  }, [selectedWorkerId, loadWorkerMail]);

  useEffect(() => {
    if (!workerFromUrl) return;
    setSelectedWorkerId(workerFromUrl);
    if (composeFromUrl) {
      setFolder("compose");
      setComposeWorkerId(workerFromUrl);
    }
  }, [workerFromUrl, composeFromUrl]);

  useEffect(() => {
    if (emailConfigured === false && folder !== "integration") {
      setFolder("integration");
    }
  }, [emailConfigured, folder]);

  const inboxCount = useMemo(() => countInboundMessages(items), [items]);
  const sentCount = useMemo(() => countOutboundMessages(items), [items]);
  const inboxListItems = useMemo(() => buildMailInboxListItems(items), [items]);
  const sentListItems = useMemo(() => buildMailSentListItems(items), [items]);

  const selectedItem = useMemo(
    () => items.find((item) => item.workerId === selectedWorkerId) ?? null,
    [items, selectedWorkerId]
  );

  function clearSelectedWorker() {
    setSelectedWorkerId(null);
    setComposeWorkerId(null);
    router.replace("/admin_recruiter/mail", { scroll: false });
  }

  function selectWorker(workerId: string, openFolder: "inbox" | "sent" = "inbox") {
    setSelectedWorkerId(workerId);
    setComposeWorkerId(null);
    setFolder(openFolder);
    router.replace(`/admin_recruiter/mail?workerId=${encodeURIComponent(workerId)}`, {
      scroll: false,
    });
  }

  function openCompose(draft?: MailDraftListItem | null) {
    setError(null);
    setActiveDraft(draft ?? null);
    if (draft) {
      setComposeWorkerId(draft.workerId);
      setSelectedWorkerId(draft.workerId);
      router.replace(
        `/admin_recruiter/mail?workerId=${encodeURIComponent(draft.workerId)}&compose=1`,
        { scroll: false }
      );
    } else if (selectedWorkerId) {
      setComposeWorkerId(selectedWorkerId);
      router.replace(
        `/admin_recruiter/mail?workerId=${encodeURIComponent(selectedWorkerId)}&compose=1`,
        { scroll: false }
      );
    } else {
      setComposeWorkerId(null);
      router.replace("/admin_recruiter/mail?compose=1", { scroll: false });
    }
    setFolder("compose");
  }

  function openDraft(draft: MailDraftListItem) {
    openCompose(draft);
  }

  const deleteDraft = useCallback(
    async (draft: MailDraftListItem) => {
      const label = draft.candidateName.trim() || "this draft";
      const confirmed = window.confirm(`Delete draft for ${label}? This cannot be undone.`);
      if (!confirmed) return;

      setDeletingDraftId(draft.id);
      try {
        const res = await fetch("/api/admin/mail/drafts", {
          method: "DELETE",
          headers: {
            ...(await authHeaders()),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ draftId: draft.id }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Could not delete draft (${res.status})`);
        }

        setDrafts((current) => current.filter((item) => item.id !== draft.id));
        if (activeDraft?.id === draft.id) {
          setActiveDraft(null);
          setComposeWorkerId(null);
          if (folder === "compose") setFolder("drafts");
        }
        toast.success("Draft deleted.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete draft.");
      } finally {
        setDeletingDraftId(null);
      }
    },
    [activeDraft?.id, folder]
  );

  const mainContent = (() => {
    if (loading && emailConfigured === null) {
      return null;
    }

    if (folder === "integration" || emailConfigured === false) {
      return <EmailIntegrationPanel emailConfigured={Boolean(emailConfigured)} />;
    }

    if (folder === "drafts") {
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-[#E5E7EB] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#1F2937]">Drafts</h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              {drafts.length} draft{drafts.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {draftsLoading ? null : drafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <Archive className="mb-3 h-10 w-10 text-[#CBD5E1]" />
                <p className="text-sm font-medium text-[#374151]">No drafts</p>
                <p className="mt-1 max-w-xs text-xs text-[#6B7280]">
                  Emails you write will save here automatically.
                </p>
              </div>
            ) : (
              <ul>
                {drafts.map((draft) => (
                  <li key={draft.id}>
                    <MailDraftListRow
                      candidateName={draft.candidateName}
                      profilePhotoUrl={draft.profilePhotoUrl}
                      subject={draft.subject}
                      preview={draft.body}
                      timeLabel={formatMailTime(draft.updatedAt)}
                      deleting={deletingDraftId === draft.id}
                      onOpen={() => openDraft(draft)}
                      onDelete={() => void deleteDraft(draft)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      );
    }

    if (activeWorkerId && (folder === "inbox" || folder === "sent")) {
      const item = items.find((entry) => entry.workerId === activeWorkerId) ?? selectedItem;
      const fallbackThreads = item ? [item.thread] : [];
      return (
        <CandidateEmailInboxPanel
          hideSidebar
          workerId={activeWorkerId}
          candidateName={workerContact?.name ?? item?.candidateName ?? "Applicant"}
          contact={
            workerContact ?? {
              name: item?.candidateName ?? "Applicant",
              email: item?.contactEmail ?? null,
              phone: item?.contactPhone ?? null,
            }
          }
          emailThreads={workerThreads.length > 0 ? workerThreads : fallbackThreads}
          loading={workerLoading}
          error={workerError ?? error}
          initialFolder={folder === "sent" ? "sent" : "inbox"}
          onRefresh={refreshMail}
          onBack={clearSelectedWorker}
        />
      );
    }

    if (folder === "compose") {
      return (
        <MailComposePanel
          initialWorkerId={composeWorkerId ?? selectedWorkerId}
          initialDraft={activeDraft}
          inboxCandidates={items}
          onBack={() => {
            setComposeWorkerId(null);
            setActiveDraft(null);
            setFolder("inbox");
            if (selectedWorkerId) {
              router.replace(
                `/admin_recruiter/mail?workerId=${encodeURIComponent(selectedWorkerId)}`,
                { scroll: false }
              );
            } else {
              router.replace("/admin_recruiter/mail", { scroll: false });
            }
          }}
          onSent={refreshMail}
          onDraftSaved={loadDrafts}
          onDraftDeleted={() => {
            setActiveDraft(null);
            setComposeWorkerId(null);
            void loadDrafts();
            setFolder("drafts");
          }}
        />
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[#E5E7EB] px-5 py-3">
          <h2 className="text-sm font-semibold text-[#1F2937]">
            {folder === "sent" ? "Sent" : "Inbox"}
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B]">
            {folder === "sent" ? sentCount : inboxCount}{" "}
            {folder === "sent" ? "sent email" : "received email"}
            {(folder === "sent" ? sentCount : inboxCount) === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <p className="px-5 py-6 text-sm text-red-600">{error}</p>
          ) : folder === "sent" ? (
            sentListItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <Mail className="mb-3 h-10 w-10 text-[#CBD5E1]" />
                <p className="text-sm font-medium text-[#374151]">No sent emails yet</p>
                <p className="mt-1 max-w-xs text-xs text-[#6B7280]">
                  Emails you send to candidates will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E5E7EB]">
                {sentListItems.map((item) => (
                  <li key={item.id}>
                    <MailFolderListRow
                      candidateName={item.candidateName}
                      profilePhotoUrl={item.profilePhotoUrl}
                      subject={item.subject}
                      preview={item.preview}
                      timeLabel={formatMailTime(item.sentAt)}
                      active={item.workerId === selectedWorkerId}
                      onClick={() => selectWorker(item.workerId, "sent")}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : inboxListItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Mail className="mb-3 h-10 w-10 text-[#CBD5E1]" />
              <p className="text-sm font-medium text-[#374151]">No received emails yet</p>
              <p className="mt-1 max-w-xs text-xs text-[#6B7280]">
                When candidates reply, their messages will show here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {inboxListItems.map((item) => (
                <li key={item.workerId}>
                  <MailFolderListRow
                    candidateName={item.candidateName}
                    profilePhotoUrl={item.profilePhotoUrl}
                    subject={item.subject}
                    preview={item.preview}
                    timeLabel={formatMailTime(item.latestAt)}
                    active={item.workerId === selectedWorkerId}
                    onClick={() => selectWorker(item.workerId, "inbox")}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  })();

  return (
    <div className="admin-recruiter-page-pad">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-[#0F172A]">Mail</h1>
        <p className="mt-1 text-sm text-[#64748B]">Email with candidates in one place.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#D1D5DB] bg-white">
        <div className="grid min-h-[520px] grid-cols-12">
          <EmailInboxSidebar
            folder={folder}
            inboxCount={inboxCount}
            sentCount={sentCount}
            draftsCount={drafts.length}
            emailConfigured={Boolean(emailConfigured)}
            composeDisabled={!emailConfigured}
            onCompose={() => openCompose()}
            onFolderChange={(next) => {
              setError(null);
              setComposeWorkerId(null);
              setActiveDraft(null);
              if (next === "inbox" || next === "sent" || next === "drafts" || next === "integration") {
                setSelectedWorkerId(null);
                router.replace("/admin_recruiter/mail", { scroll: false });
              }
              setFolder(next);
            }}
          />
          <main className="col-span-12 flex min-w-0 flex-col bg-white md:col-span-9">
            {mainContent}
          </main>
        </div>
      </div>
    </div>
  );
}
