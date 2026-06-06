
ALTER TABLE public.imports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'imported',
  ADD COLUMN IF NOT EXISTS skipped_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_required_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_report jsonb,
  ADD COLUMN IF NOT EXISTS detected_columns jsonb,
  ADD COLUMN IF NOT EXISTS template_match_score numeric,
  ADD COLUMN IF NOT EXISTS duplicate_mode text NOT NULL DEFAULT 'skip',
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.mapping_templates
  ADD COLUMN IF NOT EXISTS sample_values jsonb;

DROP TRIGGER IF EXISTS imports_set_updated_at ON public.imports;
CREATE TRIGGER imports_set_updated_at BEFORE UPDATE ON public.imports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
