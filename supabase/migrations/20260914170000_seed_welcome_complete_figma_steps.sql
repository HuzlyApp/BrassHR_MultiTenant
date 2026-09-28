-- Align Welcome & Complete with Figma (Post-hire only).
UPDATE public.onboarding_step_library
SET
  category_id = 'communication-notification',
  category_label = 'Welcome & Complete',
  title = CASE step_key
    WHEN 'welcome-email' THEN 'Send Message'
    WHEN 'manager-welcome-call' THEN 'Welcome Call'
    WHEN 'final-onboarding-call' THEN 'Final Onboarding Call'
    WHEN 'buddy-mentor-assignment' THEN 'Buddy / Mentor Assignment'
    WHEN 'completion-milestone' THEN 'Onboarding Complete'
    ELSE title
  END,
  description = CASE step_key
    WHEN 'welcome-email' THEN 'Send a welcome or onboarding message to the new hire.'
    WHEN 'manager-welcome-call' THEN 'Schedule or track a welcome call.'
    WHEN 'final-onboarding-call' THEN 'Schedule or track the final onboarding call.'
    WHEN 'buddy-mentor-assignment' THEN 'Assign a buddy or mentor to the new hire.'
    WHEN 'completion-milestone' THEN 'Mark onboarding complete.'
    ELSE description
  END,
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"post_hire"}'::jsonb,
  sort_order = CASE step_key
    WHEN 'welcome-email' THEN 1
    WHEN 'manager-welcome-call' THEN 2
    WHEN 'final-onboarding-call' THEN 3
    WHEN 'buddy-mentor-assignment' THEN 4
    WHEN 'completion-milestone' THEN 5
    ELSE sort_order
  END
WHERE tenant_id IS NULL
  AND step_key IN (
    'welcome-email',
    'manager-welcome-call',
    'final-onboarding-call',
    'buddy-mentor-assignment',
    'completion-milestone'
  );
