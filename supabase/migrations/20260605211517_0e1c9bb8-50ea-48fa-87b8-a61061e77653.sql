
-- Integrations & sync tables
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'not_connected',
  auth_type text NOT NULL DEFAULT 'webhook',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_reference text,
  is_enabled boolean NOT NULL DEFAULT true,
  last_tested_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO anon, authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open integrations" ON public.integrations FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.integration_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  source_field text NOT NULL,
  target_object text NOT NULL DEFAULT 'Contact',
  target_field text NOT NULL,
  transformation text NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_mappings TO anon, authenticated;
GRANT ALL ON public.integration_mappings TO service_role;
ALTER TABLE public.integration_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open mappings" ON public.integration_mappings FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_integration_mappings_updated_at BEFORE UPDATE ON public.integration_mappings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sync_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'manual',
  audience_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_direction text NOT NULL DEFAULT 'leadforge_to_crm',
  create_or_update_behavior text NOT NULL DEFAULT 'create_or_update',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_rules TO anon, authenticated;
GRANT ALL ON public.sync_rules TO service_role;
ALTER TABLE public.sync_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open sync_rules" ON public.sync_rules FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_sync_rules_updated_at BEFORE UPDATE ON public.sync_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  target_object text NOT NULL DEFAULT 'Contact',
  action text NOT NULL DEFAULT 'create',
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb,
  status_code integer,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sync_jobs_status_idx ON public.sync_jobs(status, scheduled_at);
CREATE INDEX sync_jobs_integration_idx ON public.sync_jobs(integration_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_jobs TO anon, authenticated;
GRANT ALL ON public.sync_jobs TO service_role;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open sync_jobs" ON public.sync_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_sync_jobs_updated_at BEFORE UPDATE ON public.sync_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id uuid REFERENCES public.sync_jobs(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_events TO anon, authenticated;
GRANT ALL ON public.sync_events TO service_role;
ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open sync_events" ON public.sync_events FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.external_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_object_type text NOT NULL,
  external_record_id text NOT NULL,
  external_url text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, business_id, external_object_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_records TO anon, authenticated;
GRANT ALL ON public.external_records TO service_role;
ALTER TABLE public.external_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open external_records" ON public.external_records FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_external_records_updated_at BEFORE UPDATE ON public.external_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
