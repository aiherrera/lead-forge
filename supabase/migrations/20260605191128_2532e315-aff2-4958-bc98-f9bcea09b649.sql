CREATE TABLE IF NOT EXISTS public.saved_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_exported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_segments TO anon, authenticated;
GRANT ALL ON public.saved_segments TO service_role;
ALTER TABLE public.saved_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_saved_segments" ON public.saved_segments FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER saved_segments_updated_at BEFORE UPDATE ON public.saved_segments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL,
  segment_id uuid REFERENCES public.saved_segments(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  record_count integer NOT NULL DEFAULT 0,
  format text NOT NULL DEFAULT 'csv',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  filters_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exports TO anon, authenticated;
GRANT ALL ON public.exports TO service_role;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_exports" ON public.exports FOR ALL USING (true) WITH CHECK (true);