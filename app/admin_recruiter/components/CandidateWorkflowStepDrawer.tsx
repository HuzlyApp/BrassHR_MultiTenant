"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { WorkflowStepInspection } from "@/lib/onboarding/candidate-workflow-step-inspection";
import { displayStatusLabel } from "@/lib/onboarding/assigned-workflow-steps";
import { lifecyclePhaseLabel } from "@/lib/onboarding/workflow-phase-groups";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAnswer(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="break-words text-sm text-slate-800">{value?.trim() || "—"}</dd>
    </div>
  );
}

export default function CandidateWorkflowStepDrawer({
  open,
  onOpenChange,
  loading,
  error,
  inspection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  error?: string | null;
  inspection: WorkflowStepInspection | null;
}) {
  const title = inspection?.step.title ?? "Step details";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40 data-[state=open]:animate-in fade-in" />
        <Dialog.Content
          className="fixed inset-0 z-[101] flex h-[100dvh] w-full flex-col bg-white shadow-xl outline-none md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[min(32rem,100vw)] md:border-l md:border-slate-200"
          aria-describedby="workflow-step-inspection-desc"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-lg font-semibold text-[#111827]">{title}</Dialog.Title>
              <Dialog.Description id="workflow-step-inspection-desc" className="mt-0.5 text-xs text-slate-500">
                Read-only submission for this candidate workflow step.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-primary)]"
              aria-label="Close step details"
            >
              <X className="h-4 w-4" aria-hidden />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <p className="text-sm text-slate-600">Loading step details…</p>
            ) : error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            ) : !inspection ? (
              <p className="text-sm text-slate-600">No submission details are available for this step.</p>
            ) : (
              <div className="space-y-5">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Meta label="Step name" value={inspection.step.title} />
                  <Meta label="Phase" value={lifecyclePhaseLabel(inspection.phase)} />
                  <Meta label="Step type" value={inspection.step.stepType.replaceAll("-", " ")} />
                  <Meta label="Required" value={inspection.step.required ? "Required" : "Optional"} />
                  <Meta label="Status" value={displayStatusLabel(inspection.step.displayStatus)} />
                  <Meta label="Assigned date" value={formatDateTime(inspection.assignedAt)} />
                  <Meta label="Started date" value={formatDateTime(inspection.startedAt)} />
                  <Meta label="Submitted date" value={formatDateTime(inspection.submittedAt)} />
                  <Meta label="Completed date" value={formatDateTime(inspection.completedAt)} />
                  <Meta
                    label="Approved or rejected date"
                    value={formatDateTime(inspection.approvedOrRejectedAt)}
                  />
                  <Meta label="Completed by" value={inspection.completedBy} />
                  <Meta label="Approved or rejected by" value={inspection.approvedOrRejectedBy} />
                  <Meta label="Workflow" value={inspection.workflowName} />
                  <Meta label="Workflow version" value={inspection.workflowVersion} />
                  {inspection.notes ? (
                    <div className="sm:col-span-2">
                      <Meta label="Notes or rejection reason" value={inspection.notes} />
                    </div>
                  ) : null}
                </dl>

                {inspection.emptyState ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {inspection.emptyState}
                  </p>
                ) : null}

                {inspection.documents.length > 0 ? (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-[#111827]">Uploaded documents</h3>
                    <ul className="space-y-3">
                      {inspection.documents.map((doc) => (
                        <li key={doc.id} className="rounded-md border border-slate-200 px-3 py-2">
                          <p className="break-words text-sm font-medium text-[#111827]">
                            {doc.originalFileName || "Uploaded file"}
                          </p>
                          <dl className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                            <div>Type: {doc.documentType || "—"}</div>
                            <div>Size: {formatBytes(doc.fileSize)}</div>
                            <div>Uploaded: {formatDateTime(doc.uploadedAt)}</div>
                            <div>Uploaded by: {doc.uploadedBy || "—"}</div>
                            <div>Verification: {doc.verificationStatus || "—"}</div>
                            <div>Reviewed: {formatDateTime(doc.approvedOrRejectedAt)}</div>
                          </dl>
                          {doc.reviewNotes ? (
                            <p className="mt-1 text-xs text-rose-700">{doc.reviewNotes}</p>
                          ) : null}
                          {doc.fileUnavailable ? (
                            <p className="mt-2 text-xs text-amber-800">File unavailable.</p>
                          ) : doc.previewUrl ? (
                            <div className="mt-2 flex flex-wrap gap-3">
                              <a
                                href={doc.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-[color:var(--brand-primary)]"
                              >
                                Preview
                              </a>
                              <a
                                href={doc.downloadUrl ?? doc.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-[color:var(--brand-primary)]"
                              >
                                Download
                              </a>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {inspection.form?.questions.length ? (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-[#111827]">Form responses</h3>
                    <ul className="space-y-3">
                      {inspection.form.questions.map((question, index) => (
                        <li key={`${question.label}-${index}`} className="rounded-md border border-slate-200 px-3 py-2">
                          <p className="text-sm font-medium text-[#111827]">{question.label}</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {formatAnswer(question.answer)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {question.fieldType} · {formatDateTime(question.submittedAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {inspection.assessment ? (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-[#111827]">Skill assessment</h3>
                    <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <Meta label="Assessment name" value={inspection.assessment.name} />
                      <Meta
                        label="Score"
                        value={
                          inspection.assessment.score != null ? String(inspection.assessment.score) : "—"
                        }
                      />
                      <Meta label="Passing requirement" value={inspection.assessment.passingRequirement} />
                      <Meta
                        label="Attempt"
                        value={
                          inspection.assessment.attemptNumber != null
                            ? String(inspection.assessment.attemptNumber)
                            : "—"
                        }
                      />
                      <Meta label="Started" value={formatDateTime(inspection.assessment.startedAt)} />
                      <Meta label="Completed" value={formatDateTime(inspection.assessment.completedAt)} />
                      <Meta label="Review status" value={inspection.assessment.reviewStatus} />
                    </dl>
                    {inspection.assessment.responses.length ? (
                      <ul className="mt-3 space-y-2">
                        {inspection.assessment.responses.map((response, index) => (
                          <li key={`${response.question}-${index}`} className="rounded-md bg-slate-50 px-3 py-2">
                            <p className="text-xs font-medium text-slate-600">{response.question}</p>
                            <p className="whitespace-pre-wrap break-words text-sm text-slate-800">
                              {formatAnswer(response.answer)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">No assessment responses are available.</p>
                    )}
                  </section>
                ) : null}

                {inspection.references.length ? (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-[#111827]">References</h3>
                    <ul className="space-y-3">
                      {inspection.references.map((reference) => (
                        <li key={reference.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                          <p className="font-medium text-[#111827]">{reference.name}</p>
                          <p className="text-slate-600">{reference.relationship || "—"}</p>
                          <p className="break-words text-slate-600">
                            {reference.email || "—"}
                            {reference.phone ? ` · ${reference.phone}` : ""}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Submitted {formatDateTime(reference.submittedAt)}
                          </p>
                          {reference.recruiterNotes ? (
                            <p className="mt-1 text-xs text-slate-700">{reference.recruiterNotes}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {inspection.agreement ? (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-[#111827]">eSignature</h3>
                    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Meta label="Agreement" value={inspection.agreement.documentName} />
                      <Meta label="Signature status" value={inspection.agreement.signatureStatus} />
                      <Meta label="Sent date" value={formatDateTime(inspection.agreement.sentAt)} />
                      <Meta label="Viewed date" value={formatDateTime(inspection.agreement.viewedAt)} />
                      <Meta label="Signed date" value={formatDateTime(inspection.agreement.signedAt)} />
                      <Meta label="Signer" value={inspection.agreement.signerIdentity} />
                    </dl>
                    {inspection.agreement.completedDocumentUrl ? (
                      <a
                        href={inspection.agreement.completedDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-[color:var(--brand-primary)]"
                      >
                        View completed document
                      </a>
                    ) : null}
                  </section>
                ) : null}

                {inspection.authorization && inspection.kind === "background_check" ? (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-[#111827]">Authorization</h3>
                    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Meta label="Authorization status" value={inspection.authorization.authorizationStatus} />
                      <Meta
                        label="Consent timestamp"
                        value={formatDateTime(inspection.authorization.consentTimestamp)}
                      />
                      <Meta label="Provider status" value={inspection.authorization.providerSafeStatus} />
                      <Meta label="Review status" value={inspection.authorization.reviewStatus} />
                    </dl>
                  </section>
                ) : null}

                {inspection.finalReview ? (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-[#111827]">Final review</h3>
                    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Meta label="Submitted date" value={formatDateTime(inspection.finalReview.submittedAt)} />
                      <Meta label="Candidate confirmation" value={inspection.finalReview.confirmation} />
                      <Meta label="Reviewer" value={inspection.finalReview.reviewer} />
                      <Meta label="Decision" value={inspection.finalReview.decision} />
                    </dl>
                    {inspection.finalReview.missingRequirements.length ? (
                      <p className="mt-2 text-sm text-amber-800">
                        Missing at submission: {inspection.finalReview.missingRequirements.join(", ")}
                      </p>
                    ) : null}
                    {inspection.finalReview.stepsIncluded.length ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Steps included: {inspection.finalReview.stepsIncluded.join(", ")}
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
