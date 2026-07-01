export const CANDIDATE_PIPELINE_REFRESH_EVENT = "brasshr:candidate-pipeline-refresh";

export type CandidatePipelineRefreshDetail = {
  workerId: string;
};

export function dispatchCandidatePipelineRefresh(workerId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CandidatePipelineRefreshDetail>(CANDIDATE_PIPELINE_REFRESH_EVENT, {
      detail: { workerId },
    })
  );
}
