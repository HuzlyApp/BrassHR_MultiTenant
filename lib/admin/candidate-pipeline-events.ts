export const CANDIDATE_PIPELINE_REFRESH_EVENT = "brasshr:candidate-pipeline-refresh";

export type CandidatePipelineRefreshDetail = {
  workerId: string;
  statusName?: string;
  statusId?: string;
};

export function dispatchCandidatePipelineRefresh(workerId: string, status?: { statusName: string; statusId: string }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CandidatePipelineRefreshDetail>(CANDIDATE_PIPELINE_REFRESH_EVENT, {
      detail: { workerId, ...status },
    })
  );
}
