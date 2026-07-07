-- Supporting catalog / messaging tables that predate tracked migrations.
-- Required before skill seed (20260507200000), FAQ/support (20260617180000),
-- and group chat RLS (20260617120000).

-- ---------------------------------------------------------------------------
-- Skill assessment catalog (seeded in 20260507200000)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skill_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  order_number integer,
  slug text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS skill_categories_slug_uidx
  ON public.skill_categories (slug)
  WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.skill_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.skill_categories (id) ON DELETE CASCADE,
  question text NOT NULL,
  quiz_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS skill_questions_category_id_quiz_number_uidx
  ON public.skill_questions (category_id, quiz_number);

ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_questions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.skill_categories TO anon, authenticated;
GRANT SELECT ON public.skill_questions TO anon, authenticated;
GRANT ALL ON public.skill_categories TO service_role;
GRANT ALL ON public.skill_questions TO service_role;

-- ---------------------------------------------------------------------------
-- FAQs (seeded in 20260617190000)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  category text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faqs_tenant_category_idx
  ON public.faqs (tenant_id, category);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.faqs TO authenticated;
GRANT ALL ON public.faqs TO service_role;

-- ---------------------------------------------------------------------------
-- Support tickets (altered in 20260617180000 / 20260620120000)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'Open',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

-- ---------------------------------------------------------------------------
-- Recruiter group chat (RLS/indexes in 20260617120000)
-- group_members.user_id stores worker.id (see admin/messages/groups route)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  sender_id text,
  sender_name text,
  content text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS group_members_group_user_uq
  ON public.group_members (group_id, user_id);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.groups TO service_role;
GRANT ALL ON public.group_members TO service_role;
GRANT ALL ON public.group_messages TO service_role;
