ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS cleanup_status text NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS merged_from jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS businesses_cleanup_status_idx ON public.businesses(cleanup_status);