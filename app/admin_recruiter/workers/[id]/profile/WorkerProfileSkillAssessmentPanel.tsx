"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { jsPDF } from "jspdf";
import BrandedStepperCompleteIcon from "@/app/admin_recruiter/components/BrandedStepperCompleteIcon";
import toast from "react-hot-toast";

type Assessment = {
  id: string;
  title: string | null;
  total_score: number | null;
  answered_count: number | null;
  result_status: string;
  completed: boolean | null;
};

type AssessmentListResponse = {
  skill_assessments: Assessment[];
};

type AssessmentQuestion = Record<string, unknown> & {
  selected_answer?: unknown;
};

type AssessmentDetailResponse = {
  worker: Record<string, unknown>;
  assessment: Record<string, unknown>;
  questions: AssessmentQuestion[];
};

function asText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const s = value.trim();
    return s.length > 0 ? s : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function scoreLabel(assessment: Assessment): string {
  const score = assessment.total_score;
  const answered = assessment.answered_count;
  if (score != null && answered != null) return `${score} of ${answered}`;
  if (score != null) return `Score: ${score} of 10`;
  return assessment.result_status || "Pending";
}

function buildSimplePdf(args: {
  candidateName: string;
  title: string;
  score: string;
  status: string;
  questions: Array<{ text: string; answer: string }>;
}): jsPDF {
  const doc = new jsPDF();
  let y = 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Skill Assessment Result", 14, y);
  y += 10;
  doc.setFontSize(11);
  doc.text(`Candidate: ${args.candidateName}`, 14, y);
  y += 7;
  doc.text(`Assessment: ${args.title}`, 14, y);
  y += 7;
  doc.text(`Score: ${args.score}`, 14, y);
  y += 7;
  doc.text(`Status: ${args.status}`, 14, y);
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Answers", 14, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  for (const [index, q] of args.questions.entries()) {
    const lines = doc.splitTextToSize(`${index + 1}. ${q.text}`, 180);
    if (y + lines.length * 5 + 12 > 280) {
      doc.addPage();
      y = 16;
    }
    doc.text(lines, 14, y);
    y += lines.length * 5 + 2;
    doc.text(`Answer: ${q.answer}`, 18, y);
    y += 8;
  }
  return doc;
}

export function WorkerProfileSkillAssessmentPanel({
  workerId,
  workerName,
}: {
  workerId: string;
  workerName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/admin/skill-assessment-results?workerId=${encodeURIComponent(workerId)}`,
      { cache: "no-store" }
    );
    const json = (await res.json().catch(() => ({}))) as AssessmentListResponse & {
      error?: string;
    };
    if (!res.ok) throw new Error(json.error || "Could not load skill assessments.");
    setAssessments(Array.isArray(json.skill_assessments) ? json.skill_assessments : []);
  }, [workerId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await load();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load skill assessments.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const completedCount = useMemo(
    () => assessments.filter((a) => a.completed === true).length,
    [assessments]
  );

  async function fetchDetail(assessmentId: string): Promise<AssessmentDetailResponse> {
    const res = await fetch(
      `/api/admin/skill-assessment-results?workerId=${encodeURIComponent(workerId)}&assessmentId=${encodeURIComponent(assessmentId)}`
    );
    const json = (await res.json().catch(() => ({}))) as AssessmentDetailResponse & {
      error?: string;
    };
    if (!res.ok) throw new Error(json.error || "Failed to load assessment result");
    return json;
  }

  async function buildPdf(assessmentId: string): Promise<jsPDF> {
    const detail = await fetchDetail(assessmentId);
    const assessment = detail.assessment ?? {};
    const title = asText(assessment.assessment_title) ?? "Untitled Assessment";
    const questions = (Array.isArray(detail.questions) ? detail.questions : []).map((q, index) => ({
      text: asText(q.question_text) ?? `Question ${index + 1}`,
      answer: asText(q.selected_answer) ?? "N/A",
    }));
    return buildSimplePdf({
      candidateName: workerName,
      title,
      score: asText(assessment.total_score) ?? "0",
      status: asText(assessment.result_status) ?? "N/A",
      questions,
    });
  }

  async function handleSeeResults(assessmentId: string) {
    setBusyId(assessmentId);
    try {
      const doc = await buildPdf(assessmentId);
      window.open(doc.output("bloburl"), "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open results");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(assessmentId: string) {
    setBusyId(assessmentId);
    try {
      const doc = await buildPdf(assessmentId);
      const name =
        assessments.find((a) => a.id === assessmentId)?.title?.replace(/\s+/g, "-").toLowerCase() ||
        "skill-assessment";
      doc.save(`${name}-${assessmentId}.pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download results");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownloadAll() {
    if (assessments.length === 0) {
      toast.error("No skill assessments available to download.");
      return;
    }
    setBusyAll(true);
    try {
      const first = await buildPdf(assessments[0].id);
      for (let i = 1; i < assessments.length; i++) {
        const next = await buildPdf(assessments[i].id);
        const pages = next.getNumberOfPages();
        for (let p = 1; p <= pages; p++) {
          first.addPage();
          // jsPDF doesn't easily merge; rebuild combined via sequential append is complex.
          // Download each remaining file individually as fallback for extras.
        }
        void pages;
        next.save(
          `${(assessments[i].title || "skill-assessment").replace(/\s+/g, "-").toLowerCase()}.pdf`
        );
      }
      const namePart = workerName.replace(/\s+/g, "-").toLowerCase() || "worker";
      first.save(`${namePart}-skill-assessment.pdf`);
      toast.success("Skill assessment results downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download all results");
    } finally {
      setBusyAll(false);
    }
  }

  async function handleDelete(assessmentId: string) {
    const confirmed = window.confirm("Delete this skill assessment result?");
    if (!confirmed) return;
    setBusyId(assessmentId);
    try {
      const res = await fetch(
        `/api/admin/skill-assessment-results?workerId=${encodeURIComponent(workerId)}&assessmentId=${encodeURIComponent(assessmentId)}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 404 && res.status !== 405) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || "Delete is not available for this assessment.");
      }
      if (res.status === 405 || res.status === 404) {
        toast.error("Delete is not supported by the API yet.");
        return;
      }
      await load();
      toast.success("Assessment removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete assessment");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="mt-5 h-48 animate-pulse rounded-xl bg-[#F3F4F6]" />;
  }

  if (error) {
    return (
      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#012352]">Skill Assessment</h2>
        <p className="mt-0.5 text-sm text-[#6B7280]">
          Evaluate skills and job readiness.
          {assessments.length > 0 ? (
            <span className="ml-2 font-medium text-[#374151]">
              Completed {completedCount} of {assessments.length}
            </span>
          ) : null}
        </p>
      </div>

      {assessments.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-8 text-center text-sm text-[#6B7280]">
          No skill assessments found for this worker.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {assessments.map((assessment) => (
            <div
              key={assessment.id}
              className="flex flex-col gap-3 rounded-lg border border-[color:color-mix(in_srgb,var(--brand-primary)_28%,white)] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <BrandedStepperCompleteIcon className="size-8 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1F2937]">
                    {assessment.title || "Untitled Assessment"}
                  </p>
                  <p className="mt-0.5 text-sm text-[#475467]">{scoreLabel(assessment)}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs font-semibold text-[#2563EB]">
                <button
                  type="button"
                  disabled={busyId === assessment.id}
                  onClick={() => void handleSeeResults(assessment.id)}
                  className="underline disabled:opacity-50"
                >
                  See Results
                </button>
                <button
                  type="button"
                  disabled={busyId === assessment.id}
                  onClick={() => void handleDownload(assessment.id)}
                  className="underline disabled:opacity-50"
                >
                  Download
                </button>
                <button
                  type="button"
                  disabled={busyId === assessment.id}
                  onClick={() => void handleDelete(assessment.id)}
                  className="inline-flex items-center gap-1 underline disabled:opacity-50"
                >
                  <Trash2 className="size-3" aria-hidden />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {assessments.length > 0 ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={busyAll}
            onClick={() => void handleDownloadAll()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#012352] transition hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            <Download className="size-4" aria-hidden />
            {busyAll ? "Preparing…" : "Download skill assessment full results"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
