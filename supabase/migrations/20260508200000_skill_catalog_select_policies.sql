-- skill_categories / skill_questions: RLS enabled but no policies ⇒ anon REST returns [].
-- Allow read for onboarding clients (anon + authenticated).

grant select on table public.skill_categories to anon, authenticated;
grant select on table public.skill_questions to anon, authenticated;

drop policy if exists "public read categories" on public.skill_categories;
create policy "public read categories"
  on public.skill_categories
  for select
  to public
  using (true);

drop policy if exists "public read questions" on public.skill_questions;
create policy "public read questions"
  on public.skill_questions
  for select
  to public
  using (true);
