import type { AssessmentOption } from "@/app/admin_recruiter/settings/AddCustomProfessionModal";
import type { SkillAssessmentCatalog } from "@/lib/skill-assessment/types";

/** Unique active assessment categories for the Add Position multi-select. Prefer shared templates. */
export function assessmentOptionsFromCatalog(
  catalog: SkillAssessmentCatalog
): { options: AssessmentOption[]; labelsByProfession: Record<string, string> } {
  const labelsByProfession: Record<string, string> = {};
  const byName = new Map<string, { option: AssessmentOption; isShared: boolean }>();

  for (const category of catalog.categories) {
    if (!category.isActive) continue;
    const name = category.name?.trim();
    if (!name) continue;
    const professionId = category.professionId?.trim() || null;
    if (professionId && !labelsByProfession[professionId]) {
      labelsByProfession[professionId] = name;
    }
    const key = name.toLowerCase();
    const isShared = !professionId;
    const existing = byName.get(key);
    // Prefer shared (professionId null) templates; otherwise keep first unique name.
    if (!existing || (isShared && !existing.isShared)) {
      byName.set(key, { option: { id: category.id, name }, isShared });
    }
  }

  return {
    options: Array.from(byName.values()).map((entry) => entry.option),
    labelsByProfession,
  };
}
