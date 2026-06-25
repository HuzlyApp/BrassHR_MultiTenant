const fs = require("fs");
const src = fs.readFileSync("lib/onboarding/workflow-step-library-data.ts", "utf8");
const match = src.match(/export const WORKFLOW_STEP_LIBRARY_DATA[^=]*=\s*(\[[\s\S]*\]);/);
if (!match) {
  console.error("no match");
  process.exit(1);
}
const data = eval(match[1]);
const lines = [
  "-- Seed global onboarding step library",
  "DELETE FROM public.onboarding_step_library WHERE tenant_id IS NULL;",
];
for (const cat of data) {
  let ord = 0;
  for (const step of cat.steps) {
    ord += 1;
    const esc = (s) => String(s ?? "").replace(/'/g, "''");
    lines.push(
      `INSERT INTO public.onboarding_step_library (tenant_id, category_id, category_label, step_key, step_type, title, description, icon_key, sort_order) VALUES (NULL, '${esc(cat.id)}', '${esc(cat.label)}', '${esc(step.id)}', '${esc(step.stepType)}', '${esc(step.label)}', '${esc(step.description)}', '${esc(step.iconKey)}', ${ord});`
    );
  }
}
fs.writeFileSync("supabase/migrations/20260625180100_seed_onboarding_step_library.sql", lines.join("\n"));
console.log("wrote", lines.length, "lines");
