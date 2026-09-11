/**
 * Builds the payload applied when the user clicks Search / presses Enter.
 * Skills and free-text stay separate (server ANDs them when both are set).
 */
export function buildCandidatesSearchApplyPayload(input: {
  query: string;
  skillTags: string[];
}): { query: string; skillsFilter: string } {
  return {
    query: input.query.trim(),
    skillsFilter: input.skillTags.map((s) => s.trim()).filter(Boolean).join(", "),
  };
}

export function isCandidatesSearchDirty(input: {
  draftQuery: string;
  appliedQuery: string;
  draftSkillsKey: string;
  appliedSkillsKey: string;
}): boolean {
  return (
    input.draftQuery.trim() !== input.appliedQuery.trim() ||
    input.draftSkillsKey !== input.appliedSkillsKey
  );
}
