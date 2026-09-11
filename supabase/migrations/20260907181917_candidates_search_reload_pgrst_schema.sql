-- Ensure PostgREST picks up list_candidate_ids_page after CREATE OR REPLACE.
NOTIFY pgrst, 'reload schema';
