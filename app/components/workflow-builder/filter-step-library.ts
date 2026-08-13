import type { StepCategory, StepDefinition } from "./types";

export function flattenStepLibrary(categories: StepCategory[]): StepDefinition[] {
  return categories.flatMap((category) => category.steps);
}

function matchesQuery(text: string | undefined, query: string): boolean {
  return Boolean(text && text.toLowerCase().includes(query));
}

export function stepMatchesSearch(
  step: StepDefinition,
  query: string,
  categoryLabel?: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (matchesQuery(step.label, q)) return true;
  if (matchesQuery(step.description, q)) return true;
  if (matchesQuery(step.id, q)) return true;
  if (matchesQuery(step.id.replace(/[-_]/g, " "), q)) return true;
  if (matchesQuery(categoryLabel, q)) return true;
  if (step.keywords?.some((keyword) => matchesQuery(keyword, q))) return true;
  return false;
}

export function filterStepLibrary(
  categories: StepCategory[],
  query: string
): StepCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return categories;

  return categories
    .map((category) => ({
      ...category,
      steps: category.steps.filter((step) =>
        stepMatchesSearch(step, q, category.label)
      ),
    }))
    .filter((category) => category.steps.length > 0);
}

export function findCustomStepDefinition(
  categories: StepCategory[]
): StepDefinition | null {
  for (const category of categories) {
    const match = category.steps.find((step) => step.id === "custom-step");
    if (match) return match;
  }
  return flattenStepLibrary(categories).find((step) =>
    step.label.toLowerCase().includes("custom step")
  ) ?? null;
}
