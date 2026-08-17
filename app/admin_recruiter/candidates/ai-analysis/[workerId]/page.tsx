import { CandidatesAiAnalysisClient } from "./CandidatesAiAnalysisClient";

type CandidateAiAnalysisPageProps = {
  params: Promise<{ workerId: string }>;
};

export default async function CandidateAiAnalysisPage({ params }: CandidateAiAnalysisPageProps) {
  const { workerId } = await params;
  return <CandidatesAiAnalysisClient workerId={workerId} />;
}
