
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS rating_label text,
  ADD COLUMN IF NOT EXISTS opening_status text,
  ADD COLUMN IF NOT EXISTS closing_time text,
  ADD COLUMN IF NOT EXISTS review_snippet text;

ALTER TABLE public.imports
  ADD COLUMN IF NOT EXISTS imported_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mapping_template_id uuid;

CREATE TABLE IF NOT EXISTS public.mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  raw_headers jsonb NOT NULL DEFAULT '[]'::jsonb,
  normalized_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprints jsonb NOT NULL DEFAULT '{}'::jsonb,
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapping_templates TO anon, authenticated;
GRANT ALL ON public.mapping_templates TO service_role;

ALTER TABLE public.mapping_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all_mapping_templates" ON public.mapping_templates
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER mapping_templates_set_updated_at
  BEFORE UPDATE ON public.mapping_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
